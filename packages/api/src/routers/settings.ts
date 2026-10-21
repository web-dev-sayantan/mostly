import type { Database } from "@mostly/db";
import { user } from "@mostly/db/schema/auth";
import { userSettingVersion } from "@mostly/db/schema/settings";
import {
  addLogicalDays,
  logicalDate,
  planSettingChange,
  resolveSettingsForNow,
  settingsForDate,
  skippedDatesForTimeZoneChange,
  skippedDatesOf,
} from "@mostly/domain";
import type { SettingValues } from "@mostly/domain";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gt } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../procedures";

type SettingRow = typeof userSettingVersion.$inferSelect;

const DEFAULT_WEEK_STARTS_ON = 1;
const DEFAULT_DAY_ROLLOVER_HOUR = 4;
const FALLBACK_TIME_ZONE = "UTC";

const isTimeZone = (timeZone: string): boolean => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone });
    return formatter.resolvedOptions().timeZone.length > 0;
  } catch {
    return false;
  }
};

const timeZoneSchema = z
  .string()
  .max(64)
  .refine(isTimeZone, "Unknown timezone");

export const loadHistory = (db: Database, userId: string) =>
  db
    .select()
    .from(userSettingVersion)
    .where(eq(userSettingVersion.userId, userId))
    .orderBy(
      asc(userSettingVersion.effectiveFrom),
      asc(userSettingVersion.createdAt)
    );

export const loadCache = async (
  db: Database,
  userId: string
): Promise<SettingValues | null> => {
  const [row] = await db
    .select({
      timeZone: user.timeZone,
      weekStartsOn: user.weekStartsOn,
      dayRolloverHour: user.dayRolloverHour,
    })
    .from(user)
    .where(eq(user.id, userId));

  if (!row?.timeZone) {
    return null;
  }

  return {
    timeZone: row.timeZone,
    weekStartsOn: row.weekStartsOn,
    dayRolloverHour: row.dayRolloverHour,
  };
};

const syncCache = async (
  db: Database,
  userId: string,
  cached: SettingValues | null,
  current: SettingValues
) => {
  if (
    cached?.timeZone === current.timeZone &&
    cached.weekStartsOn === current.weekStartsOn &&
    cached.dayRolloverHour === current.dayRolloverHour
  ) {
    return;
  }

  await db
    .update(user)
    .set({
      timeZone: current.timeZone,
      weekStartsOn: current.weekStartsOn,
      dayRolloverHour: current.dayRolloverHour,
    })
    .where(eq(user.id, userId));
};

const seedHistory = async (
  db: Database,
  userId: string,
  detectedTimeZone: string | undefined,
  now: Date
): Promise<SettingRow[]> => {
  const timeZone =
    detectedTimeZone && isTimeZone(detectedTimeZone)
      ? detectedTimeZone
      : FALLBACK_TIME_ZONE;
  const values = {
    timeZone,
    weekStartsOn: DEFAULT_WEEK_STARTS_ON,
    dayRolloverHour: DEFAULT_DAY_ROLLOVER_HOUR,
  };
  const [row] = await db
    .insert(userSettingVersion)
    .values({
      id: crypto.randomUUID(),
      userId,
      effectiveFrom: logicalDate(now, {
        timeZone,
        rolloverHour: DEFAULT_DAY_ROLLOVER_HOUR,
      }),
      ...values,
      createdAt: now,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to seed settings");
  }

  await db.update(user).set(values).where(eq(user.id, userId));

  return [row];
};

/**
 * Resolve today and the version in effect. The cache is a hint for the first pass because a
 * timezone change can move which logical date the same instant belongs to.
 */
export const resolveCurrent = (
  history: SettingRow[],
  now: Date,
  cached: SettingValues | null
) => {
  const resolved = resolveSettingsForNow(
    history,
    now,
    cached
      ? {
          timeZone: cached.timeZone,
          rolloverHour: cached.dayRolloverHour,
        }
      : null
  );
  if (!resolved) {
    throw new Error("Settings history is empty");
  }
  return resolved;
};

/** Today under the user's settings, with sensible defaults before history exists. */
export const currentLogicalDay = (
  history: SettingRow[],
  cached: SettingValues | null,
  now: Date
): string => {
  if (history.length > 0) {
    return resolveCurrent(history, now, cached).today;
  }

  return logicalDate(now, {
    timeZone: cached?.timeZone ?? FALLBACK_TIME_ZONE,
    rolloverHour: cached?.dayRolloverHour ?? DEFAULT_DAY_ROLLOVER_HOUR,
  });
};

const toDto = (row: SettingRow) => ({
  id: row.id,
  effectiveFrom: row.effectiveFrom,
  timeZone: row.timeZone,
  weekStartsOn: row.weekStartsOn,
  dayRolloverHour: row.dayRolloverHour,
  skippedDates: row.skippedDates ?? [],
});

export const settingsRouter = {
  get: protectedProcedure
    .input(z.object({ timeZone: z.string().optional() }).optional())
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const now = context.now();
      const cached = await loadCache(context.db, userId);
      let history = await loadHistory(context.db, userId);

      if (history.length === 0) {
        history = await seedHistory(context.db, userId, input?.timeZone, now);
      }

      const { today, current } = resolveCurrent(history, now, cached);
      await syncCache(context.db, userId, cached, current);

      return {
        today,
        current: toDto(current),
        history: history.map(toDto),
      };
    }),

  update: protectedProcedure
    .input(
      z
        .object({
          timeZone: timeZoneSchema.optional(),
          weekStartsOn: z.number().int().min(1).max(7).optional(),
          dayRolloverHour: z.number().int().min(0).max(6).optional(),
          confirmTimeZone: z.boolean().optional(),
        })
        .refine(
          (value) =>
            value.timeZone !== undefined ||
            value.weekStartsOn !== undefined ||
            value.dayRolloverHour !== undefined,
          { message: "Nothing to update" }
        )
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const now = context.now();
      const cached = await loadCache(context.db, userId);
      let history = await loadHistory(context.db, userId);

      if (history.length === 0) {
        history = await seedHistory(context.db, userId, input.timeZone, now);
      }

      const { today, current } = resolveCurrent(history, now, cached);

      if (
        input.timeZone &&
        input.timeZone !== current.timeZone &&
        input.confirmTimeZone !== true
      ) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Confirm the timezone change.",
        });
      }

      // Carry any version already effective tomorrow into the new snapshot.
      const planBase =
        settingsForDate(history, addLogicalDays(today, 1)) ?? current;
      const plan = planSettingChange(planBase, today, {
        timeZone: input.timeZone,
        weekStartsOn: input.weekStartsOn,
        dayRolloverHour: input.dayRolloverHour,
      });

      let nextHistory = history;
      if (plan.versions.length > 0) {
        const [first] = plan.versions;
        const pending = history.filter(
          (version) => version.effectiveFrom > today
        );
        const replaced = new Set(
          plan.versions.map((version) => version.effectiveFrom)
        );
        const superseded = pending.filter((version) =>
          replaced.has(version.effectiveFrom)
        );
        const retained = pending.filter(
          (version) => !replaced.has(version.effectiveFrom)
        );
        const skippedDates =
          plan.timeZoneChanged && first
            ? skippedDatesForTimeZoneChange({
                today,
                now,
                current: {
                  timeZone: current.timeZone,
                  rolloverHour: current.dayRolloverHour,
                },
                next: {
                  timeZone: first.timeZone,
                  rolloverHour: first.dayRolloverHour,
                },
              })
            : skippedDatesOf(superseded);
        // Replace the whole pending plan, never a past version. Versions the new
        // plan does not touch are re-inserted with their skipped dates intact.
        await context.db
          .delete(userSettingVersion)
          .where(
            and(
              eq(userSettingVersion.userId, userId),
              gt(userSettingVersion.effectiveFrom, today)
            )
          );

        const inserted = await context.db
          .insert(userSettingVersion)
          .values([
            ...plan.versions.map((version, index) => ({
              id: crypto.randomUUID(),
              userId,
              ...version,
              skippedDates: index === 0 ? skippedDates : null,
              createdAt: now,
            })),
            ...retained.map((version) => ({
              id: crypto.randomUUID(),
              userId,
              effectiveFrom: version.effectiveFrom,
              timeZone: version.timeZone,
              weekStartsOn: version.weekStartsOn,
              dayRolloverHour: version.dayRolloverHour,
              skippedDates: version.skippedDates,
              createdAt: now,
            })),
          ])
          .returning();

        const pendingIds = new Set(pending.map((version) => version.id));
        nextHistory = [
          ...history.filter((version) => !pendingIds.has(version.id)),
          ...inserted,
        ].toSorted((left, right) =>
          left.effectiveFrom.localeCompare(right.effectiveFrom)
        );
      }

      await syncCache(context.db, userId, cached, current);

      return {
        today,
        current: toDto(current),
        history: nextHistory.map(toDto),
        change: plan.versions.length > 0 ? plan : null,
      };
    }),
};
