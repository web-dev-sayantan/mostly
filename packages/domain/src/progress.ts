import type { WeeklyOutcome } from "./day";
import { isGoalActiveOn, weeklyOutcome } from "./day";
import { addLogicalDays, weekStartOf } from "./logical-day";
import type { Cadence, ScheduleVersion } from "./schedule";
import { isExpectedOn, resolveSchedule } from "./schedule";
import { weekStartsOnFor } from "./settings";
import type {
  GoalConsistency,
  GoalMinutes,
  OverallConsistency,
  StreakUnit,
} from "./stats";
import { goalStats, minutesOf, overallConsistency } from "./stats";
import { weekSegments } from "./weeks";

export const PROGRESS_RANGES = [7, 30, 90] as const;
export type ProgressRange = (typeof PROGRESS_RANGES)[number];

export type ProgressPriority = "high" | "medium" | "low";

export type ProgressIntensity = "neutral" | "none" | "low" | "medium" | "full";

export interface ProgressGoal {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  priority: ProgressPriority;
  startDate: string;
  archivedOn: string | null;
  scheduleVersions: readonly ScheduleVersion[];
}

export interface ProgressSession {
  goalId: string;
  logicalDate: string;
  minutes?: number | null;
}

export interface ProgressSettingsVersion {
  effectiveFrom: string;
  weekStartsOn: number;
}

export interface ProgressHeatmapDay {
  date: string;
  expected: number;
  done: number;
  extras: number;
  intensity: ProgressIntensity;
}

export type ProgressWeekStatus = "met" | "partial" | "none" | "not_scored";

export interface ProgressWeekCell {
  weekStart: string;
  weekEnd: string;
  target: number;
  sessions: number;
  activeDays: number;
  status: ProgressWeekStatus;
  outcome: WeeklyOutcome;
}

export interface ProgressWeeklyRow {
  goalId: string;
  name: string;
  emoji: string | null;
  color: string | null;
  target: number;
  weeks: ProgressWeekCell[];
}

export type ProgressDotStatus = "done" | "missed" | "open" | "none";

export interface ProgressDot {
  date: string;
  status: ProgressDotStatus;
  extra: boolean;
}

export interface ProgressGoalCard {
  goalId: string;
  name: string;
  emoji: string | null;
  color: string | null;
  priority: ProgressPriority;
  unit: StreakUnit;
  currentStreak: number | null;
  consistency: GoalConsistency;
  days: ProgressDot[];
  weeks: ProgressWeekCell[];
}

export interface ProgressTodayGoal {
  goalId: string;
  name: string;
  emoji: string | null;
  color: string | null;
  done: boolean;
}

export interface ProgressToday {
  date: string;
  done: number;
  total: number;
  incomplete: boolean;
  goals: ProgressTodayGoal[];
}

export interface ProgressResult {
  today: string;
  range: ProgressRange;
  weekStartsOn: number;
  empty: boolean;
  todayProgress: ProgressToday;
  hero: {
    consistency: OverallConsistency;
    sessions: number;
    minutes: GoalMinutes;
  };
  heatmap: {
    weekStartsOn: number;
    days: ProgressHeatmapDay[];
  };
  weekly: ProgressWeeklyRow[];
  cards: ProgressGoalCard[];
}

export interface BuildProgressInput {
  goals: readonly ProgressGoal[];
  sessions: readonly ProgressSession[];
  settings: readonly ProgressSettingsVersion[];
  today: string;
  range: ProgressRange;
  skippedDates?: readonly string[];
}

const HEATMAP_WEEKS = 12;
const CARD_DAYS = 7;
const CARD_WEEKS = 7;

const cadenceOn = (goal: ProgressGoal, date: string): Cadence | null =>
  resolveSchedule(goal.scheduleVersions, date) ??
  resolveSchedule(goal.scheduleVersions, goal.startDate);

const unitOn = (goal: ProgressGoal, date: string): StreakUnit => {
  const cadence = cadenceOn(goal, date);
  return cadence?.type === "weekly_target" ? "week" : "day";
};

const isActiveOn = (goal: ProgressGoal, date: string): boolean =>
  isGoalActiveOn(goal, date);

const dateDistance = (start: string, end: string): number =>
  Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
      86_400_000
  ) + 1;

const activeDaysInWeek = (
  goal: ProgressGoal,
  weekStart: string,
  weekEnd: string,
  skipped: ReadonlySet<string>
): number => {
  const start = goal.startDate > weekStart ? goal.startDate : weekStart;
  const end =
    goal.archivedOn && goal.archivedOn < weekEnd ? goal.archivedOn : weekEnd;
  if (end < start) {
    return 0;
  }
  const skippedInRange = [...skipped].filter(
    (date) => date >= start && date <= end
  ).length;
  return Math.max(0, dateDistance(start, end) - skippedInRange);
};

const sessionDatesFor = (
  sessions: readonly ProgressSession[],
  skipped: ReadonlySet<string>
): Map<string, Set<string>> => {
  const byGoal = new Map<string, Set<string>>();
  for (const entry of sessions) {
    if (skipped.has(entry.logicalDate)) {
      continue;
    }
    const dates = byGoal.get(entry.goalId) ?? new Set<string>();
    dates.add(entry.logicalDate);
    byGoal.set(entry.goalId, dates);
  }
  return byGoal;
};

const countSessions = (
  dates: ReadonlySet<string> | undefined,
  start: string,
  end: string,
  skipped: ReadonlySet<string>
): number => {
  if (!dates) {
    return 0;
  }
  let count = 0;
  for (const date of dates) {
    if (date >= start && date <= end && !skipped.has(date)) {
      count += 1;
    }
  }
  return count;
};

interface UnitCounts {
  done: number;
  expected: number;
}

const dailyRangeCounts = ({
  goal,
  dates,
  rangeStart,
  rangeEnd,
  skipped,
}: {
  goal: ProgressGoal;
  dates: ReadonlySet<string> | undefined;
  rangeStart: string;
  rangeEnd: string;
  skipped: ReadonlySet<string>;
}): UnitCounts => {
  const start = goal.startDate > rangeStart ? goal.startDate : rangeStart;
  const end =
    goal.archivedOn && goal.archivedOn < rangeEnd ? goal.archivedOn : rangeEnd;
  let expected = 0;
  let done = 0;

  for (let date = start; date <= end; date = addLogicalDays(date, 1)) {
    if (skipped.has(date)) {
      continue;
    }
    const cadence = cadenceOn(goal, date);
    if (!cadence || cadence.type === "weekly_target") {
      continue;
    }
    if (!isExpectedOn(cadence, date)) {
      continue;
    }
    expected += 1;
    if (dates?.has(date)) {
      done += 1;
    }
  }

  return { done, expected };
};

const weeklyRangeCounts = ({
  goal,
  dates,
  rangeStart,
  rangeEnd,
  settings,
  skipped,
}: {
  goal: ProgressGoal;
  dates: ReadonlySet<string> | undefined;
  rangeStart: string;
  rangeEnd: string;
  settings: readonly ProgressSettingsVersion[];
  skipped: ReadonlySet<string>;
}): UnitCounts => {
  let expected = 0;
  let done = 0;

  for (const week of weekSegments(settings, rangeStart, rangeEnd)) {
    const inRange = week.end <= rangeEnd && week.end >= rangeStart;
    const cadence =
      inRange && !week.transition ? cadenceOn(goal, week.start) : null;
    if (cadence?.type === "weekly_target") {
      const activeDays = activeDaysInWeek(goal, week.start, week.end, skipped);
      if (activeDays >= cadence.target) {
        expected += 1;
        if (
          countSessions(dates, week.start, week.end, skipped) >= cadence.target
        ) {
          done += 1;
        }
      }
    }
  }

  return { done, expected };
};

const rangeConsistency = ({
  goal,
  dates,
  today,
  range,
  settings,
  skipped,
}: {
  goal: ProgressGoal;
  dates: ReadonlySet<string> | undefined;
  today: string;
  range: ProgressRange;
  settings: readonly ProgressSettingsVersion[];
  skipped: ReadonlySet<string>;
}): GoalConsistency => {
  const rangeEnd = addLogicalDays(today, -1);
  const rangeStart = addLogicalDays(today, -range);
  const unit = unitOn(goal, today);

  if (
    goal.startDate > rangeEnd ||
    (goal.archivedOn !== null && goal.archivedOn < rangeStart)
  ) {
    return { done: 0, expected: 0, percent: null, qualified: false };
  }

  const counts =
    unit === "day"
      ? dailyRangeCounts({ goal, dates, rangeStart, rangeEnd, skipped })
      : weeklyRangeCounts({
          goal,
          dates,
          rangeStart,
          rangeEnd,
          settings,
          skipped,
        });
  const qualified =
    unit === "week" ? counts.expected >= 3 : counts.expected >= 7;

  return {
    done: counts.done,
    expected: counts.expected,
    percent:
      qualified && counts.expected > 0
        ? Math.round((counts.done / counts.expected) * 100)
        : null,
    qualified,
  };
};

const heatmapDays = ({
  goals,
  datesByGoal,
  today,
  weekStartsOn,
  skipped,
}: {
  goals: readonly ProgressGoal[];
  datesByGoal: ReadonlyMap<string, ReadonlySet<string>>;
  today: string;
  weekStartsOn: number;
  skipped: ReadonlySet<string>;
}): ProgressHeatmapDay[] => {
  const start = addLogicalDays(weekStartOf(today, weekStartsOn), -77);
  const days: ProgressHeatmapDay[] = [];

  for (let date = start; date <= today; date = addLogicalDays(date, 1)) {
    let expected = 0;
    let done = 0;
    let extras = 0;
    if (!skipped.has(date)) {
      for (const goal of goals) {
        if (!isActiveOn(goal, date)) {
          continue;
        }
        const cadence = cadenceOn(goal, date);
        if (!cadence || cadence.type === "weekly_target") {
          continue;
        }
        const logged = datesByGoal.get(goal.id)?.has(date) ?? false;
        if (isExpectedOn(cadence, date)) {
          expected += 1;
          if (logged) {
            done += 1;
          }
        } else if (logged) {
          extras += 1;
        }
      }
    }

    let intensity: ProgressIntensity = "neutral";
    if (expected > 0 && done === 0) {
      intensity = "none";
    } else if (expected > 0 && done > 0) {
      const share = Math.round((done / expected) * 100);
      if (share >= 100) {
        intensity = "full";
      } else if (share >= 50) {
        intensity = "medium";
      } else {
        intensity = "low";
      }
    }

    days.push({ date, expected, done, extras, intensity });
  }

  return days;
};

const weekCells = ({
  goal,
  target,
  dates,
  today,
  settings,
  count,
  skipped,
}: {
  goal: ProgressGoal;
  target: number;
  dates: ReadonlySet<string> | undefined;
  today: string;
  settings: readonly ProgressSettingsVersion[];
  count: number;
  skipped: ReadonlySet<string>;
}): ProgressWeekCell[] => {
  const currentStart = weekStartOf(today, weekStartsOnFor(settings, today));
  const firstStart = addLogicalDays(currentStart, -(count + 2) * 7);
  const segments = weekSegments(settings, firstStart, today).slice(-count);
  const cells: ProgressWeekCell[] = [];

  for (const segment of segments) {
    const weekStart = segment.start;
    const weekEnd = segment.end;
    const cadence = cadenceOn(goal, weekStart);
    const weekTarget =
      cadence?.type === "weekly_target" ? cadence.target : target;
    const activeDays = activeDaysInWeek(goal, weekStart, weekEnd, skipped);
    const sessions = countSessions(dates, weekStart, weekEnd, skipped);
    const outcome: WeeklyOutcome =
      cadence?.type === "weekly_target" && !segment.transition
        ? weeklyOutcome({
            target: cadence.target,
            sessions,
            activeDays,
            weekEnd,
            today,
          })
        : "not_scored";

    let status: ProgressWeekStatus;
    if (outcome === "not_scored") {
      status = "not_scored";
    } else if (outcome === "met") {
      status = "met";
    } else if (sessions > 0) {
      status = "partial";
    } else {
      status = "none";
    }

    cells.push({
      weekStart,
      weekEnd,
      target: weekTarget,
      sessions,
      activeDays,
      status,
      outcome,
    });
  }

  return cells;
};

const cardDots = ({
  goal,
  dates,
  today,
  skipped,
}: {
  goal: ProgressGoal;
  dates: ReadonlySet<string> | undefined;
  today: string;
  skipped: ReadonlySet<string>;
}): ProgressDot[] => {
  const start = addLogicalDays(today, -(CARD_DAYS - 1));
  const dots: ProgressDot[] = [];

  for (let date = start; date <= today; date = addLogicalDays(date, 1)) {
    if (skipped.has(date)) {
      dots.push({ date, status: "none", extra: false });
      continue;
    }
    const cadence = cadenceOn(goal, date);
    const expected =
      isActiveOn(goal, date) &&
      cadence !== null &&
      cadence.type !== "weekly_target" &&
      isExpectedOn(cadence, date);
    const logged = dates?.has(date) ?? false;

    let status: ProgressDotStatus = "none";
    if (logged) {
      status = "done";
    } else if (expected) {
      status = date < today ? "missed" : "open";
    }

    dots.push({ date, status, extra: logged && !expected });
  }

  return dots;
};

const todayProgress = ({
  goals,
  datesByGoal,
  today,
  skipped,
}: {
  goals: readonly ProgressGoal[];
  datesByGoal: ReadonlyMap<string, ReadonlySet<string>>;
  today: string;
  skipped: ReadonlySet<string>;
}): ProgressToday => {
  const goalsToday: ProgressTodayGoal[] = [];

  if (!skipped.has(today)) {
    for (const goal of goals) {
      if (!isActiveOn(goal, today)) {
        continue;
      }
      const cadence = cadenceOn(goal, today);
      if (!cadence || cadence.type === "weekly_target") {
        continue;
      }
      if (!isExpectedOn(cadence, today)) {
        continue;
      }
      goalsToday.push({
        goalId: goal.id,
        name: goal.name,
        emoji: goal.emoji,
        color: goal.color,
        done: datesByGoal.get(goal.id)?.has(today) ?? false,
      });
    }
  }

  const done = goalsToday.filter((entry) => entry.done).length;
  return {
    date: today,
    done,
    total: goalsToday.length,
    incomplete: goalsToday.length > 0 && done < goalsToday.length,
    goals: goalsToday,
  };
};

const completedDaysSince = (
  goals: readonly ProgressGoal[],
  today: string
): number => {
  const yesterday = addLogicalDays(today, -1);
  let first: string | null = null;
  for (const goal of goals) {
    if (goal.startDate <= yesterday && (!first || goal.startDate < first)) {
      first = goal.startDate;
    }
  }
  return first ? dateDistance(first, yesterday) : 0;
};

export const buildProgress = ({
  goals,
  sessions,
  settings,
  today,
  range,
  skippedDates = [],
}: BuildProgressInput): ProgressResult => {
  const skipped = new Set(skippedDates);
  const weekStartsOn = weekStartsOnFor(settings, today);
  const datesByGoal = sessionDatesFor(sessions, skipped);
  const activeGoals = goals.filter(
    (goal) =>
      goal.startDate <= today &&
      (goal.archivedOn === null || goal.archivedOn >= today)
  );
  const rangeStart = addLogicalDays(today, -range);
  const rangeSessions = sessions.filter(
    (entry) =>
      !skipped.has(entry.logicalDate) &&
      entry.logicalDate >= rangeStart &&
      entry.logicalDate < today
  );

  const cards: ProgressGoalCard[] = activeGoals.map((goal) => {
    const stats = goalStats({
      goal: {
        startDate: goal.startDate,
        archivedOn: goal.archivedOn,
        scheduleVersions: goal.scheduleVersions,
      },
      sessions: sessions
        .filter(
          (entry) => entry.goalId === goal.id && !skipped.has(entry.logicalDate)
        )
        .map((entry) => ({
          logicalDate: entry.logicalDate,
          minutes: entry.minutes,
        })),
      settings,
      today,
      skippedDates: [...skipped],
    });
    const unit = unitOn(goal, today);
    const cadence = cadenceOn(goal, today);

    return {
      goalId: goal.id,
      name: goal.name,
      emoji: goal.emoji,
      color: goal.color,
      priority: goal.priority,
      unit,
      currentStreak: stats.currentStreak,
      consistency: rangeConsistency({
        goal,
        dates: datesByGoal.get(goal.id),
        today,
        range,
        settings,
        skipped,
      }),
      days:
        unit === "day"
          ? cardDots({
              goal,
              dates: datesByGoal.get(goal.id),
              today,
              skipped,
            })
          : [],
      weeks:
        unit === "week" && cadence?.type === "weekly_target"
          ? weekCells({
              goal,
              target: cadence.target,
              dates: datesByGoal.get(goal.id),
              today,
              settings,
              count: CARD_WEEKS,
              skipped,
            })
          : [],
    };
  });

  const weekly: ProgressWeeklyRow[] = [];
  for (const goal of activeGoals) {
    const cadence = cadenceOn(goal, today);
    if (cadence?.type !== "weekly_target") {
      continue;
    }
    weekly.push({
      goalId: goal.id,
      name: goal.name,
      emoji: goal.emoji,
      color: goal.color,
      target: cadence.target,
      weeks: weekCells({
        goal,
        target: cadence.target,
        dates: datesByGoal.get(goal.id),
        today,
        settings,
        count: HEATMAP_WEEKS,
        skipped,
      }),
    });
  }

  return {
    today,
    range,
    weekStartsOn,
    empty: completedDaysSince(goals, today) < 7,
    todayProgress: todayProgress({ goals, datesByGoal, today, skipped }),
    hero: {
      consistency: overallConsistency(cards),
      sessions: rangeSessions.length,
      minutes: minutesOf(rangeSessions),
    },
    heatmap: {
      weekStartsOn,
      days: heatmapDays({
        goals,
        datesByGoal,
        today,
        weekStartsOn,
        skipped,
      }),
    },
    weekly,
    cards,
  };
};
