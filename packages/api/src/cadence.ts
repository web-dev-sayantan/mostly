import type { goalScheduleVersion } from "@mostly/db/schema/goals";
import type { Cadence, Weekday } from "@mostly/domain";

type ScheduleRow = typeof goalScheduleVersion.$inferSelect;

/** The domain cadence stored on a schedule version row. */
export const cadenceFromScheduleRow = (row: ScheduleRow): Cadence => {
  if (row.cadenceType === "weekdays") {
    return { type: "weekdays", weekdays: (row.weekdays ?? []) as Weekday[] };
  }
  if (row.cadenceType === "weekly_target") {
    return { type: "weekly_target", target: row.weeklyTarget ?? 1 };
  }
  return { type: "daily" };
};
