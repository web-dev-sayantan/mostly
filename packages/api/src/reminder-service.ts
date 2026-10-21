// oxlint-disable eslint/no-await-in-loop -- delivery claims and retries are intentionally sequential per user.
import type { Database } from "@mostly/db";
import { user } from "@mostly/db/schema/auth";
import { goal, goalScheduleVersion } from "@mostly/db/schema/goals";
import {
  pushSubscription,
  reminderDelivery,
} from "@mostly/db/schema/reminders";
import { session } from "@mostly/db/schema/sessions";
import type {
  Cadence,
  ReminderGoal,
  ReminderSettings,
  Weekday,
} from "@mostly/domain";
import {
  countOpenItems,
  isReminderDue,
  logicalDate,
  reminderPayload,
  reminderPlan,
  weekStartOf,
} from "@mostly/domain";
import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";

import type { PushSender, PushSubscriptionRecord } from "./push";
import { PushSendError } from "./push";
import { loadHistory, resolveCurrent } from "./routers/settings";

type GoalRow = typeof goal.$inferSelect;
type ScheduleRow = typeof goalScheduleVersion.$inferSelect;
type SubscriptionRow = typeof pushSubscription.$inferSelect;

const toCadence = (row: ScheduleRow): Cadence => {
  if (row.cadenceType === "weekdays") {
    return { type: "weekdays", weekdays: (row.weekdays ?? []) as Weekday[] };
  }
  if (row.cadenceType === "weekly_target") {
    return { type: "weekly_target", target: row.weeklyTarget ?? 1 };
  }
  return { type: "daily" };
};

const settingsOf = (row: typeof user.$inferSelect): ReminderSettings => ({
  enabled: row.reminderEnabled,
  time: row.reminderTime,
  timeZone: row.timeZone ?? "UTC",
  rolloverHour: row.dayRolloverHour,
  weekStartsOn: row.weekStartsOn,
});

/** Use the effective setting version, not just the cache, so future-dated changes land. */
const currentSettingsOf = async (
  db: Database,
  row: typeof user.$inferSelect,
  now: Date
): Promise<ReminderSettings> => {
  const history = await loadHistory(db, row.id);
  if (history.length === 0) {
    return settingsOf(row);
  }

  const cached = row.timeZone
    ? {
        timeZone: row.timeZone,
        weekStartsOn: row.weekStartsOn,
        dayRolloverHour: row.dayRolloverHour,
      }
    : null;
  const { current } = resolveCurrent(history, now, cached);
  return {
    enabled: row.reminderEnabled,
    time: row.reminderTime,
    timeZone: current.timeZone,
    rolloverHour: current.dayRolloverHour,
    weekStartsOn: current.weekStartsOn,
  };
};

const loadSnapshot = async (
  db: Database,
  userId: string,
  date: string,
  weekStartsOn: number
): Promise<{
  goals: ReminderGoal[];
  sessions: { goalId: string; logicalDate: string }[];
}> => {
  const weekStart = weekStartOf(date, weekStartsOn);
  const [goalRows, sessionRows] = await Promise.all([
    db
      .select()
      .from(goal)
      .where(and(eq(goal.userId, userId), isNull(goal.deletedAt))),
    db
      .select({
        goalId: session.goalId,
        logicalDate: session.logicalDate,
      })
      .from(session)
      .where(
        and(
          eq(session.userId, userId),
          isNull(session.deletedAt),
          gte(session.logicalDate, weekStart),
          lte(session.logicalDate, date)
        )
      ),
  ]);

  const versions =
    goalRows.length === 0
      ? []
      : await db
          .select()
          .from(goalScheduleVersion)
          .where(
            inArray(
              goalScheduleVersion.goalId,
              goalRows.map((row) => row.id)
            )
          )
          .orderBy(asc(goalScheduleVersion.effectiveFrom));

  const versionsByGoal = new Map<string, ScheduleRow[]>();
  for (const row of versions) {
    const list = versionsByGoal.get(row.goalId) ?? [];
    list.push(row);
    versionsByGoal.set(row.goalId, list);
  }

  return {
    goals: goalRows.map((row: GoalRow) => ({
      id: row.id,
      startDate: row.startDate,
      archivedOn: row.archivedOn,
      scheduleVersions: (versionsByGoal.get(row.id) ?? []).map((version) => ({
        effectiveFrom: version.effectiveFrom,
        cadence: toCadence(version),
      })),
    })),
    sessions: sessionRows,
  };
};

const activeSubscriptions = (db: Database, userId: string) =>
  db
    .select()
    .from(pushSubscription)
    .where(
      and(
        eq(pushSubscription.userId, userId),
        isNull(pushSubscription.revokedAt)
      )
    )
    .orderBy(
      desc(pushSubscription.lastSeenAt),
      desc(pushSubscription.createdAt)
    );

const toSenderSubscription = (
  row: SubscriptionRow
): PushSubscriptionRecord => ({
  id: row.id,
  endpoint: row.endpoint,
  p256dh: row.p256dh,
  auth: row.auth,
});

const failureText = (error: unknown): string => {
  if (error instanceof PushSendError) {
    return `push_${error.statusCode}`;
  }
  if (error instanceof Error) {
    return error.message.slice(0, 200);
  }
  return "push_failed";
};

export interface ReminderRunSummary {
  due: number;
  sent: number;
  failed: number;
  suppressed: number;
}

/**
 * Check every enabled user's local reminder clock. The delivery row is claimed
 * before sending so concurrent runs and later time changes cannot duplicate it.
 */
export const runReminders = async ({
  db,
  now,
  sender,
}: {
  db: Database;
  now: Date;
  sender: PushSender | null;
}): Promise<ReminderRunSummary> => {
  const summary: ReminderRunSummary = {
    due: 0,
    sent: 0,
    failed: 0,
    suppressed: 0,
  };
  const users = await db
    .select()
    .from(user)
    .where(eq(user.reminderEnabled, true));

  for (const row of users) {
    const settings = await currentSettingsOf(db, row, now);
    const due = isReminderDue({ now, settings, deliveredDates: [] });
    if (!due.due) {
      continue;
    }
    summary.due += 1;

    const [delivered] = await db
      .select({ id: reminderDelivery.id })
      .from(reminderDelivery)
      .where(
        and(
          eq(reminderDelivery.userId, row.id),
          eq(reminderDelivery.logicalDate, due.logicalDate)
        )
      );
    if (delivered) {
      continue;
    }

    const snapshot = await loadSnapshot(
      db,
      row.id,
      due.logicalDate,
      settings.weekStartsOn
    );
    const plan = reminderPlan({
      now,
      settings,
      goals: snapshot.goals,
      sessions: snapshot.sessions,
      deliveredDates: [],
    });
    if (plan.kind === "skip") {
      continue;
    }

    if (plan.kind === "suppressed") {
      const [claimed] = await db
        .insert(reminderDelivery)
        .values({
          id: crypto.randomUUID(),
          userId: row.id,
          logicalDate: plan.logicalDate,
          sentAt: now,
          status: "suppressed",
          error: plan.reason,
        })
        .onConflictDoNothing()
        .returning({ id: reminderDelivery.id });
      if (claimed) {
        summary.suppressed += 1;
      }
      continue;
    }

    const [claimed] = await db
      .insert(reminderDelivery)
      .values({
        id: crypto.randomUUID(),
        userId: row.id,
        logicalDate: plan.logicalDate,
        sentAt: now,
        status: "failed",
        error: "sending",
      })
      .onConflictDoNothing()
      .returning({ id: reminderDelivery.id });
    if (!claimed) {
      continue;
    }

    if (!sender) {
      await db
        .update(reminderDelivery)
        .set({ status: "failed", error: "push_unconfigured" })
        .where(eq(reminderDelivery.id, claimed.id));
      summary.failed += 1;
      continue;
    }

    const subscriptions = await activeSubscriptions(db, row.id);
    if (subscriptions.length === 0) {
      await db
        .update(reminderDelivery)
        .set({ status: "failed", error: "no_subscription" })
        .where(eq(reminderDelivery.id, claimed.id));
      summary.failed += 1;
      continue;
    }

    const payload = JSON.stringify(reminderPayload(plan.openCount));
    let lastError = "push_failed";
    let sentTo: string | null = null;

    for (const subscription of subscriptions) {
      try {
        await sender.send(toSenderSubscription(subscription), payload);
        sentTo = subscription.id;
        break;
      } catch (error) {
        lastError = failureText(error);
        if (
          error instanceof PushSendError &&
          (error.statusCode === 404 || error.statusCode === 410)
        ) {
          await db
            .update(pushSubscription)
            .set({ revokedAt: now })
            .where(eq(pushSubscription.id, subscription.id));
        }
      }
    }

    if (sentTo) {
      await db
        .update(reminderDelivery)
        .set({
          status: "sent",
          subscriptionId: sentTo,
          error: null,
        })
        .where(eq(reminderDelivery.id, claimed.id));
      summary.sent += 1;
    } else {
      await db
        .update(reminderDelivery)
        .set({ status: "failed", error: lastError })
        .where(eq(reminderDelivery.id, claimed.id));
      summary.failed += 1;
    }
  }

  return summary;
};

/** A test sends no count and writes no delivery row. */
export const sendTestReminder = async ({
  db,
  userId,
  endpoint,
  sender,
}: {
  db: Database;
  userId: string;
  endpoint?: string;
  sender: PushSender | null;
}): Promise<"sent" | "unconfigured" | "no_subscription"> => {
  if (!sender) {
    return "unconfigured";
  }

  const conditions = [
    eq(pushSubscription.userId, userId),
    isNull(pushSubscription.revokedAt),
  ];
  if (endpoint) {
    conditions.push(eq(pushSubscription.endpoint, endpoint));
  }
  const [subscription] = await db
    .select()
    .from(pushSubscription)
    .where(and(...conditions))
    .orderBy(
      desc(pushSubscription.lastSeenAt),
      desc(pushSubscription.createdAt)
    )
    .limit(1);

  if (!subscription) {
    return "no_subscription";
  }

  await sender.send(
    toSenderSubscription(subscription),
    JSON.stringify({ test: true })
  );
  return "sent";
};

export interface ReminderDeliveryDto {
  id: string;
  logicalDate: string;
  sentAt: string;
  status: "sent" | "failed" | "suppressed";
  error: string | null;
}

const toDelivery = (
  delivery: typeof reminderDelivery.$inferSelect
): ReminderDeliveryDto => ({
  id: delivery.id,
  logicalDate: delivery.logicalDate,
  sentAt: delivery.sentAt.toISOString(),
  status: delivery.status,
  error: delivery.error,
});

export const getReminderOverview = async ({
  db,
  userId,
  now,
}: {
  db: Database;
  userId: string;
  now: Date;
}) => {
  const [row] = await db.select().from(user).where(eq(user.id, userId));
  if (!row) {
    throw new Error("Reminder user not found");
  }
  const settings = await currentSettingsOf(db, row, now);
  const today = logicalDate(now, {
    timeZone: settings.timeZone,
    rolloverHour: settings.rolloverHour,
  });
  const snapshot = await loadSnapshot(db, userId, today, settings.weekStartsOn);
  const open = countOpenItems({
    date: today,
    weekStartsOn: settings.weekStartsOn,
    goals: snapshot.goals,
    sessions: snapshot.sessions,
  });

  const [delivered, deliveryRows, subscriptions] = await Promise.all([
    db
      .select()
      .from(reminderDelivery)
      .where(
        and(
          eq(reminderDelivery.userId, userId),
          eq(reminderDelivery.logicalDate, today)
        )
      )
      .limit(1),
    db
      .select()
      .from(reminderDelivery)
      .where(eq(reminderDelivery.userId, userId))
      .orderBy(desc(reminderDelivery.sentAt))
      .limit(10),
    db
      .select({ id: pushSubscription.id })
      .from(pushSubscription)
      .where(
        and(
          eq(pushSubscription.userId, userId),
          isNull(pushSubscription.revokedAt)
        )
      ),
  ]);

  return {
    enabled: settings.enabled,
    time: settings.time,
    today,
    openCount: open.openCount,
    deliveredToday: delivered[0] ? toDelivery(delivered[0]) : null,
    deliveries: deliveryRows.map(toDelivery),
    activeSubscriptions: subscriptions.length,
  };
};
