import { addLogicalDays } from "./logical-day";
import type { ScheduleVersion } from "./schedule";
import { isExpectedOn, resolveSchedule } from "./schedule";
import type { SettingVersion } from "./settings";
import { weekSegments } from "./weeks";

/**
 * Export document v1. The API adds the user profile and the raw history:
 *
 * {
 *   schema_version: 1,
 *   exported_at: ISO timestamp,
 *   user: { name, email },
 *   settings: [{ id, effectiveFrom, timeZone, weekStartsOn, dayRolloverHour }],
 *   goals: [{ ...goal, status: "active" | "archived", scheduleVersions }],
 *   sessions: [live sessions only],
 *   outcomes: { daily: DailyOutcome[], weekly: WeeklyOutcome[] }
 * }
 *
 * Daily outcomes cover daily/weekday goals; weekly-target goals are scored by
 * week only. A day is missed once it is complete (date < today), so today's open
 * expectation does not count against the user.
 */
export const EXPORT_SCHEMA_VERSION = 1;

export interface ExportGoalInput {
  id: string;
  startDate: string;
  archivedOn: string | null;
  scheduleVersions: readonly ScheduleVersion[];
}

export interface ExportSessionInput {
  goalId: string;
  logicalDate: string;
  minutes: number | null;
}

export interface DailyOutcome {
  goalId: string;
  date: string;
  expected: boolean;
  done: boolean;
  extra: boolean;
  outcome: "done" | "missed" | "open" | "extra";
  sessionCount: number;
  minutes: number | null;
}

export interface WeeklyOutcome {
  goalId: string;
  weekStart: string;
  weekEnd: string;
  target: number;
  sessions: number;
  activeDays: number;
  outcome: "met" | "missed" | "in_progress" | "not_scored";
}

export interface DerivedOutcomes {
  daily: DailyOutcome[];
  weekly: WeeklyOutcome[];
}

type SessionsByDate = Map<string, ExportSessionInput[]>;

const groupSessions = (
  sessions: readonly ExportSessionInput[]
): Map<string, SessionsByDate> => {
  const byGoal = new Map<string, SessionsByDate>();

  for (const session of sessions) {
    const byDate = byGoal.get(session.goalId) ?? new Map();
    const day = byDate.get(session.logicalDate) ?? [];
    day.push(session);
    byDate.set(session.logicalDate, day);
    byGoal.set(session.goalId, byDate);
  }

  return byGoal;
};

const lastActiveDate = (goal: ExportGoalInput, today: string): string =>
  goal.archivedOn && goal.archivedOn < today ? goal.archivedOn : today;

const dailyOutcome = (
  expected: boolean,
  done: boolean,
  date: string,
  today: string
): DailyOutcome["outcome"] => {
  if (!expected) {
    return "extra";
  }
  if (done) {
    return "done";
  }
  return date < today ? "missed" : "open";
};

const sumMinutes = (day: readonly ExportSessionInput[]): number | null => {
  const minutes = day
    .map((session) => session.minutes)
    .filter((value): value is number => value !== null);
  if (minutes.length === 0) {
    return null;
  }
  return minutes.reduce((total, value) => total + value, 0);
};

const dailyRows = (
  goal: ExportGoalInput,
  today: string,
  byDate: SessionsByDate | undefined,
  skipped: ReadonlySet<string>
): DailyOutcome[] => {
  const rows: DailyOutcome[] = [];
  const end = lastActiveDate(goal, today);

  for (let date = goal.startDate; date <= end; date = addLogicalDays(date, 1)) {
    if (skipped.has(date)) {
      continue;
    }
    const cadence = resolveSchedule(goal.scheduleVersions, date);
    if (cadence?.type === "weekly_target") {
      continue;
    }

    const day = byDate?.get(date) ?? [];
    const expected = isExpectedOn(cadence, date);
    const done = day.length > 0;
    if (!(expected || done)) {
      continue;
    }

    rows.push({
      goalId: goal.id,
      date,
      expected,
      done,
      extra: done && !expected,
      outcome: dailyOutcome(expected, done, date, today),
      sessionCount: day.length,
      minutes: sumMinutes(day),
    });
  }

  return rows;
};

const weeklyOutcome = ({
  activeDays,
  complete,
  sessions,
  target,
  transitionWeek,
}: {
  activeDays: number;
  complete: boolean;
  sessions: number;
  target: number;
  transitionWeek: boolean;
}): WeeklyOutcome["outcome"] => {
  if (transitionWeek || activeDays < target) {
    return "not_scored";
  }
  if (sessions >= target) {
    return "met";
  }
  return complete ? "missed" : "in_progress";
};

const weeklyRows = (
  goal: ExportGoalInput,
  today: string,
  byDate: SessionsByDate | undefined,
  settings: readonly SettingVersion[],
  skipped: ReadonlySet<string>
): WeeklyOutcome[] => {
  const rows: WeeklyOutcome[] = [];
  const end = lastActiveDate(goal, today);

  for (const segment of weekSegments(settings, goal.startDate, end)) {
    const activeStart =
      segment.start < goal.startDate ? goal.startDate : segment.start;
    const activeEnd = segment.end > end ? end : segment.end;
    const cadence = resolveSchedule(goal.scheduleVersions, activeStart);

    if (cadence?.type === "weekly_target" && activeEnd >= activeStart) {
      let activeDays = 0;
      let sessionCount = 0;
      for (
        let date = activeStart;
        date <= activeEnd;
        date = addLogicalDays(date, 1)
      ) {
        if (skipped.has(date)) {
          continue;
        }
        activeDays += 1;
        sessionCount += byDate?.get(date)?.length ?? 0;
      }

      rows.push({
        goalId: goal.id,
        weekStart: segment.start,
        weekEnd: segment.end,
        target: cadence.target,
        sessions: sessionCount,
        activeDays,
        outcome: weeklyOutcome({
          activeDays,
          complete:
            segment.end < today ||
            (goal.archivedOn !== null && goal.archivedOn < today),
          sessions: sessionCount,
          target: cadence.target,
          transitionWeek: segment.transition,
        }),
      });
    }
  }

  return rows;
};

/** Daily and weekly outcomes for the export, using the settings history. */
export const deriveOutcomes = ({
  goals,
  sessions,
  today,
  settings,
  skippedDates = [],
}: {
  goals: readonly ExportGoalInput[];
  sessions: readonly ExportSessionInput[];
  today: string;
  settings: readonly SettingVersion[];
  skippedDates?: readonly string[];
}): DerivedOutcomes => {
  const skipped = new Set(skippedDates);
  const grouped = groupSessions(sessions);
  const daily: DailyOutcome[] = [];
  const weekly: WeeklyOutcome[] = [];

  for (const goal of goals) {
    const byDate = grouped.get(goal.id);
    daily.push(...dailyRows(goal, today, byDate, skipped));
    weekly.push(...weeklyRows(goal, today, byDate, settings, skipped));
  }

  return { daily, weekly };
};
