import { addLogicalDays, isWithinLastLogicalDays } from "./logical-day";
import type { ScheduleVersion } from "./schedule";
import { isExpectedOn, resolveSchedule } from "./schedule";
import type { Mood } from "./sync";
import type { WeekSettingsVersion } from "./weeks";
import { weekSegmentFor } from "./weeks";

export interface DayGoal {
  id: string;
  startDate: string;
  archivedOn: string | null;
  scheduleVersions: readonly ScheduleVersion[];
}

export interface DaySession {
  id: string;
  goalId: string;
  logicalDate: string;
  minutes: number | null;
  note: string | null;
  mood: Mood | null;
}

export type DayExpectationStatus = "done" | "missed" | "no_session";

export type WeeklyOutcome = "met" | "missed" | "in_progress" | "not_scored";

export interface DayExpectation<Goal extends DayGoal = DayGoal> {
  goal: Goal;
  status: DayExpectationStatus;
  session: DaySession | null;
}

export interface DayExtra<Goal extends DayGoal = DayGoal> {
  goal: Goal;
  session: DaySession;
}

export interface WeeklySummary<Goal extends DayGoal = DayGoal> {
  goal: Goal;
  weekStart: string;
  weekEnd: string;
  target: number;
  sessions: number;
  activeDays: number;
  status: WeeklyOutcome;
}

export interface DayWeeklySummary<
  Goal extends DayGoal = DayGoal,
> extends WeeklySummary<Goal> {
  /** The session logged on the viewed day, if any. */
  session: DaySession | null;
}

export interface DayResolution<Goal extends DayGoal = DayGoal> {
  date: string;
  today: string;
  readOnly: boolean;
  /** The timezone jump skipped this date: no expectations and no data. */
  skipped: boolean;
  expectations: DayExpectation<Goal>[];
  extras: DayExtra<Goal>[];
  weekly: DayWeeklySummary<Goal>[];
  /** Goals active on the day that were not expected: the "Log something else" picker. */
  candidates: Goal[];
}

export interface ResolveDayInput<Goal extends DayGoal> {
  date: string;
  today: string;
  weekStartsOn: number;
  goals: readonly Goal[];
  sessions: readonly DaySession[];
  /** The week-start history, so a transition week keeps its old boundaries. */
  weekStartHistory?: readonly WeekSettingsVersion[];
  skippedDates?: readonly string[];
}

type GoalLife = Pick<DayGoal, "startDate" | "archivedOn">;

/** A goal is active from its start date through its archive day. */
export const isGoalActiveOn = (goal: GoalLife, date: string): boolean =>
  date >= goal.startDate &&
  (goal.archivedOn === null || date <= goal.archivedOn);

/** The version in effect that day, falling back to the first version before the start. */
const cadenceOn = (goal: DayGoal, date: string) =>
  resolveSchedule(goal.scheduleVersions, date) ??
  resolveSchedule(goal.scheduleVersions, goal.startDate);

/** Past days inside the window stay editable until the goal archives. */
export const isDayEditable = (
  goal: GoalLife,
  date: string,
  today: string
): boolean =>
  isWithinLastLogicalDays(date, today) &&
  isGoalActiveOn(goal, date) &&
  !(goal.archivedOn !== null && goal.archivedOn < today);

export const weeklyOutcome = ({
  target,
  sessions,
  activeDays,
  weekEnd,
  today,
}: {
  target: number;
  sessions: number;
  activeDays: number;
  weekEnd: string;
  today: string;
}): WeeklyOutcome => {
  if (activeDays < target) {
    return "not_scored";
  }
  if (sessions >= target) {
    return "met";
  }
  return today > weekEnd ? "missed" : "in_progress";
};

/** The weekly target for the week containing `date`, or null for daily/weekday goals. */
export const summarizeWeek = <Goal extends DayGoal>({
  goal,
  sessions,
  date,
  today,
  weekStartsOn,
  weekStartHistory,
  skippedDates = [],
}: {
  goal: Goal;
  sessions: readonly DaySession[];
  date: string;
  today: string;
  weekStartsOn: number;
  weekStartHistory?: readonly WeekSettingsVersion[];
  skippedDates?: readonly string[];
}): WeeklySummary<Goal> | null => {
  const cadence = cadenceOn(goal, date);
  if (cadence?.type !== "weekly_target") {
    return null;
  }

  const segment = weekSegmentFor(
    weekStartHistory?.length
      ? weekStartHistory
      : [{ effectiveFrom: "0000-01-01", weekStartsOn }],
    date
  );
  const { start: weekStart, end: weekEnd } = segment;
  const skipped = new Set(skippedDates);
  let activeDays = 0;
  for (let day = weekStart; day <= weekEnd; day = addLogicalDays(day, 1)) {
    if (!skipped.has(day) && isGoalActiveOn(goal, day)) {
      activeDays += 1;
    }
  }

  const weekSessions = sessions.filter(
    (session) =>
      session.goalId === goal.id &&
      session.logicalDate >= weekStart &&
      session.logicalDate <= weekEnd &&
      !skipped.has(session.logicalDate)
  ).length;

  if (activeDays === 0 && weekSessions === 0) {
    return null;
  }

  return {
    goal,
    weekStart,
    weekEnd,
    target: cadence.target,
    sessions: weekSessions,
    activeDays,
    status: segment.transition
      ? "not_scored"
      : weeklyOutcome({
          target: cadence.target,
          sessions: weekSessions,
          activeDays,
          weekEnd,
          today,
        }),
  };
};

const statusFor = (
  logged: DaySession | null,
  date: string,
  today: string
): DayExpectationStatus => {
  if (logged) {
    return "done";
  }
  return date < today ? "missed" : "no_session";
};

/**
 * Day detail is derived on read from schedules, archives, and sessions. No miss
 * rows exist: an unmarked expected day is missed only after rollover.
 */
export const resolveDay = <Goal extends DayGoal>({
  date,
  today,
  weekStartsOn,
  goals,
  sessions,
  weekStartHistory,
  skippedDates = [],
}: ResolveDayInput<Goal>): DayResolution<Goal> => {
  if (skippedDates.includes(date)) {
    return {
      date,
      today,
      readOnly: true,
      skipped: true,
      expectations: [],
      extras: [],
      weekly: [],
      candidates: [],
    };
  }

  const goalsById = new Map(goals.map((entry) => [entry.id, entry]));
  const daySessions = sessions.filter((entry) => entry.logicalDate === date);

  const expectations: DayExpectation<Goal>[] = [];
  for (const entry of goals) {
    if (
      !isGoalActiveOn(entry, date) ||
      !isExpectedOn(cadenceOn(entry, date), date)
    ) {
      continue;
    }
    const logged =
      daySessions.find((session) => session.goalId === entry.id) ?? null;
    expectations.push({
      goal: entry,
      status: statusFor(logged, date, today),
      session: logged,
    });
  }

  const weekly: DayWeeklySummary<Goal>[] = [];
  for (const entry of goals) {
    const summary = summarizeWeek({
      goal: entry,
      sessions,
      date,
      today,
      weekStartsOn,
      weekStartHistory,
      skippedDates,
    });
    if (summary) {
      weekly.push({
        ...summary,
        session:
          daySessions.find((session) => session.goalId === entry.id) ?? null,
      });
    }
  }

  const expectedIds = new Set(expectations.map((entry) => entry.goal.id));
  const weeklyIds = new Set(weekly.map((entry) => entry.goal.id));
  const extras: DayExtra<Goal>[] = [];
  for (const logged of daySessions) {
    const entry = goalsById.get(logged.goalId);
    if (
      !entry ||
      expectedIds.has(entry.id) ||
      weeklyIds.has(entry.id) ||
      !isGoalActiveOn(entry, date) ||
      cadenceOn(entry, date)?.type === "weekly_target"
    ) {
      continue;
    }
    extras.push({ goal: entry, session: logged });
  }

  const loggedGoalIds = new Set(daySessions.map((session) => session.goalId));
  const candidates = goals.filter((entry) => {
    if (loggedGoalIds.has(entry.id) || !isDayEditable(entry, date, today)) {
      return false;
    }
    const cadence = cadenceOn(entry, date);
    return cadence !== null && !isExpectedOn(cadence, date);
  });

  return {
    date,
    today,
    readOnly: !isWithinLastLogicalDays(date, today),
    skipped: false,
    expectations,
    extras,
    weekly,
    candidates,
  };
};
