import type { Database } from "@mostly/db";
import { user } from "@mostly/db/schema/auth";
import { userSettingVersion } from "@mostly/db/schema/settings";
import { logicalDate, resolveSettingsForNow, skippedDatesOf } from "@mostly/domain";
import { asc, eq } from "drizzle-orm";

const DEFAULT_WEEK_STARTS_ON = 1;
const DEFAULT_DAY_ROLLOVER_HOUR = 4;
const FALLBACK_TIME_ZONE = "UTC";

export interface UserClock {
  today: string;
  weekStartsOn: number;
  history: { effectiveFrom: string; weekStartsOn: number }[];
  skippedDates: string[];
}

/**
 * Today and the week-start history for read-only stats. Unlike settings.get this
 * never seeds a version: a user who has not opened settings still gets defaults.
 */
export const loadUserClock = async (
  db: Database,
  userId: string,
  now: Date
): Promise<UserClock> => {
  const [cached] = await db
    .select({
      timeZone: user.timeZone,
      weekStartsOn: user.weekStartsOn,
      dayRolloverHour: user.dayRolloverHour,
    })
    .from(user)
    .where(eq(user.id, userId));

  const history = await db
    .select()
    .from(userSettingVersion)
    .where(eq(userSettingVersion.userId, userId))
    .orderBy(
      asc(userSettingVersion.effectiveFrom),
      asc(userSettingVersion.createdAt)
    );

  const [first] = history;
  if (!first) {
    const timeZone = cached?.timeZone ?? FALLBACK_TIME_ZONE;
    const weekStartsOn = cached?.weekStartsOn ?? DEFAULT_WEEK_STARTS_ON;
    const rolloverHour = cached?.dayRolloverHour ?? DEFAULT_DAY_ROLLOVER_HOUR;

    return {
      today: logicalDate(now, { timeZone, rolloverHour }),
      weekStartsOn,
      history: [{ effectiveFrom: "0000-01-01", weekStartsOn }],
      skippedDates: [],
    };
  }

  const resolved = resolveSettingsForNow(
    history,
    now,
    cached?.timeZone
      ? {
          timeZone: cached.timeZone,
          rolloverHour: cached.dayRolloverHour,
        }
      : {
          timeZone: first.timeZone,
          rolloverHour: first.dayRolloverHour,
        }
  );
  if (!resolved) {
    throw new Error("Settings history is empty");
  }

  return {
    today: resolved.today,
    weekStartsOn: resolved.current.weekStartsOn,
    history: history.map((version) => ({
      effectiveFrom: version.effectiveFrom,
      weekStartsOn: version.weekStartsOn,
    })),
    skippedDates: skippedDatesOf(history),
  };
};
