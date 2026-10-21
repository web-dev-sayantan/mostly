import type { Database } from "@mostly/db";
import {
  account as authAccount,
  authSession,
  user,
} from "@mostly/db/schema/auth";
import { goal, goalScheduleVersion } from "@mostly/db/schema/goals";
import { session } from "@mostly/db/schema/sessions";
import { userSettingVersion } from "@mostly/db/schema/settings";
import type { Cadence, SettingVersion, Weekday } from "@mostly/domain";
import {
  deriveOutcomes,
  EXPORT_SCHEMA_VERSION,
  logicalDate,
  settingsForDate,
} from "@mostly/domain";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../procedures";

type SettingRow = typeof userSettingVersion.$inferSelect;
type GoalRow = typeof goal.$inferSelect;
type ScheduleRow = typeof goalScheduleVersion.$inferSelect;
type SessionRow = typeof session.$inferSelect;

const BACKUP_RETENTION_DAYS = 30;

const cadenceOf = (row: ScheduleRow): Cadence => {
  if (row.cadenceType === "weekdays") {
    return {
      type: "weekdays",
      weekdays: (row.weekdays ?? []) as Weekday[],
    };
  }
  if (row.cadenceType === "weekly_target") {
    return { type: "weekly_target", target: row.weeklyTarget ?? 1 };
  }
  return { type: "daily" };
};

const settingValues = (row: SettingRow): SettingVersion => ({
  effectiveFrom: row.effectiveFrom,
  timeZone: row.timeZone,
  weekStartsOn: row.weekStartsOn,
  dayRolloverHour: row.dayRolloverHour,
});

/**
 * Resolve today and the version in effect. Mirrors the settings router without
 * writing a seed row: an export should not change the account.
 */
const resolveNow = (
  history: readonly SettingVersion[],
  now: Date,
  profile: {
    timeZone: string | null;
    weekStartsOn: number;
    dayRolloverHour: number;
  }
): { today: string; current: SettingVersion } => {
  const fallback: SettingVersion = {
    effectiveFrom: logicalDate(now, {
      timeZone: profile.timeZone ?? "UTC",
      rolloverHour: profile.dayRolloverHour,
    }),
    timeZone: profile.timeZone ?? "UTC",
    weekStartsOn: profile.weekStartsOn,
    dayRolloverHour: profile.dayRolloverHour,
  };

  let today = logicalDate(now, {
    timeZone: fallback.timeZone,
    rolloverHour: fallback.dayRolloverHour,
  });
  let current = settingsForDate(history, today) ?? fallback;

  const corrected = logicalDate(now, {
    timeZone: current.timeZone,
    rolloverHour: current.dayRolloverHour,
  });
  if (corrected !== today) {
    current = settingsForDate(history, corrected) ?? current;
    today = corrected;
  }

  return { today, current };
};

const loadVersions = (db: Database, goalIds: string[]) => {
  if (goalIds.length === 0) {
    return Promise.resolve<ScheduleRow[]>([]);
  }
  return db
    .select()
    .from(goalScheduleVersion)
    .where(inArray(goalScheduleVersion.goalId, goalIds))
    .orderBy(asc(goalScheduleVersion.effectiveFrom));
};

const groupVersions = (rows: ScheduleRow[]): Map<string, ScheduleRow[]> => {
  const byGoal = new Map<string, ScheduleRow[]>();
  for (const row of rows) {
    const list = byGoal.get(row.goalId) ?? [];
    list.push(row);
    byGoal.set(row.goalId, list);
  }
  return byGoal;
};

const toGoal = (row: GoalRow, versions: ScheduleRow[], today: string) => ({
  id: row.id,
  name: row.name,
  emoji: row.emoji,
  color: row.color,
  priority: row.priority,
  startDate: row.startDate,
  archivedOn: row.archivedOn,
  status:
    row.archivedOn !== null && row.archivedOn < today
      ? ("archived" as const)
      : ("active" as const),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  scheduleVersions: versions.map((version) => ({
    id: version.id,
    effectiveFrom: version.effectiveFrom,
    cadence: cadenceOf(version),
  })),
});

const toSession = (row: SessionRow) => ({
  id: row.id,
  goalId: row.goalId,
  logicalDate: row.logicalDate,
  minutes: row.minutes,
  note: row.note,
  mood: row.mood,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const accountRouter = {
  export: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const now = context.now();

    const [profile] = await context.db
      .select({
        name: user.name,
        email: user.email,
        timeZone: user.timeZone,
        weekStartsOn: user.weekStartsOn,
        dayRolloverHour: user.dayRolloverHour,
      })
      .from(user)
      .where(eq(user.id, userId));

    if (!profile) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const [settings, goals, sessions] = await Promise.all([
      context.db
        .select()
        .from(userSettingVersion)
        .where(eq(userSettingVersion.userId, userId))
        .orderBy(
          asc(userSettingVersion.effectiveFrom),
          asc(userSettingVersion.createdAt)
        ),
      context.db
        .select()
        .from(goal)
        .where(and(eq(goal.userId, userId), isNull(goal.deletedAt)))
        .orderBy(asc(goal.createdAt)),
      context.db
        .select()
        .from(session)
        .where(and(eq(session.userId, userId), isNull(session.deletedAt)))
        .orderBy(asc(session.logicalDate), asc(session.createdAt)),
    ]);

    const versions = await loadVersions(
      context.db,
      goals.map((row) => row.id)
    );
    const versionsByGoal = groupVersions(versions);
    const history = settings.map(settingValues);
    const { today } = resolveNow(history, now, profile);

    return {
      schema_version: EXPORT_SCHEMA_VERSION,
      exported_at: now.toISOString(),
      user: { name: profile.name, email: profile.email },
      settings: settings.map((row) => ({
        ...settingValues(row),
        id: row.id,
        createdAt: row.createdAt.toISOString(),
      })),
      goals: goals.map((row) =>
        toGoal(row, versionsByGoal.get(row.id) ?? [], today)
      ),
      sessions: sessions.map(toSession),
      outcomes: deriveOutcomes({
        goals: goals.map((row) => ({
          id: row.id,
          startDate: row.startDate,
          archivedOn: row.archivedOn,
          scheduleVersions: (versionsByGoal.get(row.id) ?? []).map(
            (version) => ({
              effectiveFrom: version.effectiveFrom,
              cadence: cadenceOf(version),
            })
          ),
        })),
        sessions: sessions.map((row) => ({
          goalId: row.goalId,
          logicalDate: row.logicalDate,
          minutes: row.minutes,
        })),
        today,
        settings: history,
      }),
    };
  }),

  delete: protectedProcedure
    .input(z.object({ confirm: z.literal("DELETE") }))
    .handler(async ({ context }) => {
      const userId = context.session.user.id;

      await context.db.transaction(async (tx) => {
        // Ticket 12 adds push_subscription with a cascade from user, so this
        // deletion revokes every device subscription and delivery here.
        await tx.delete(session).where(eq(session.userId, userId));

        const goalIds = await tx
          .select({ id: goal.id })
          .from(goal)
          .where(eq(goal.userId, userId));

        if (goalIds.length > 0) {
          await tx.delete(goalScheduleVersion).where(
            inArray(
              goalScheduleVersion.goalId,
              goalIds.map((row) => row.id)
            )
          );
        }

        await tx.delete(goal).where(eq(goal.userId, userId));
        await tx
          .delete(userSettingVersion)
          .where(eq(userSettingVersion.userId, userId));
        await tx.delete(authSession).where(eq(authSession.userId, userId));
        await tx.delete(authAccount).where(eq(authAccount.userId, userId));
        await tx.delete(user).where(eq(user.id, userId));
      });

      return {
        deleted: true,
        backupsExpireWithinDays: BACKUP_RETENTION_DAYS,
      };
    }),
};
