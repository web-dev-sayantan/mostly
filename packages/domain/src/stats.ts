import { weekEndOf, weekStartOf } from "./logical-day";
import type { Cadence, ScheduleVersion } from "./schedule";
import { addDays, isExpectedOn, resolveSchedule } from "./schedule";
import { weekStartsOnFor } from "./settings";
import type { Mood } from "./sync";
import { weekSegments } from "./weeks";

export type StreakUnit = "day" | "week";

export interface StatsSession {
  logicalDate: string;
  minutes?: number | null;
  mood?: Mood | null;
  note?: string | null;
}

export interface StatsGoal {
  startDate: string;
  archivedOn: string | null;
  scheduleVersions: readonly ScheduleVersion[];
}

export interface StatsSettingsVersion {
  effectiveFrom: string;
  weekStartsOn: number;
}

export interface GoalStatsInput {
  goal: StatsGoal;
  sessions: readonly StatsSession[];
  settings: readonly StatsSettingsVersion[];
  today: string;
  /** Logical dates skipped by a timezone jump; they never count. */
  skippedDates?: readonly string[];
}

export type GoalDayStatus = "done" | "missed" | "open" | "none";

export interface GoalDay {
  date: string;
  expected: boolean;
  extra: boolean;
  status: GoalDayStatus;
  minutes: number | null;
  mood: Mood | null;
  note: string | null;
}

export type GoalWeekStatus = "met" | "missed" | "in_progress" | "not_scored";

export interface GoalWeek {
  start: string;
  end: string;
  target: number | null;
  sessions: number;
  activeDays: number;
  completed: boolean;
  status: GoalWeekStatus;
}

export interface GoalConsistency {
  done: number;
  expected: number;
  percent: number | null;
  qualified: boolean;
}

export interface GoalMinutes {
  total: number;
  average: number | null;
  withMinutes: number;
  sessions: number;
}

export interface StreakEra {
  startDate: string;
  endDate: string;
  unit: StreakUnit;
  bestStreak: number;
}

export interface GoalStats {
  startsOn: string;
  futureStart: boolean;
  archived: boolean;
  historyEnd: string;
  weekStartsOn: number;
  unit: StreakUnit;
  consistency: GoalConsistency;
  currentStreak: number | null;
  bestStreak: number;
  eras: StreakEra[];
  sessions: number;
  minutes: GoalMinutes;
  days: GoalDay[];
  weeks: GoalWeek[];
}

export interface OverallConsistency {
  percent: number | null;
  qualifying: number;
  total: number;
  notEnoughData: boolean;
}

interface InternalEra {
  start: string;
  end: string;
  unit: StreakUnit;
  weekStartsOn: number;
  endReason: "unit" | "week_start" | "archive" | "today";
}

const unitOf = (cadence: Cadence | null): StreakUnit | null => {
  if (!cadence) {
    return null;
  }
  return cadence.type === "weekly_target" ? "week" : "day";
};

const weekStartOn = (
  settings: readonly StatsSettingsVersion[],
  date: string
): number => weekStartsOnFor(settings, date);

/**
 * Era boundaries follow the cadence unit, never the weekdays or target. A week-start
 * change starts a new weekly era; daily eras are unaffected.
 */
const buildEras = (
  goal: StatsGoal,
  settings: readonly StatsSettingsVersion[],
  historyEnd: string,
  skipped: ReadonlySet<string>
): InternalEra[] => {
  const eras: InternalEra[] = [];
  let era: InternalEra | null = null;
  let eraWeekStart = 1;

  const close = (date: string, reason: InternalEra["endReason"]) => {
    if (!era) {
      return;
    }
    eras.push({ ...era, end: date, endReason: reason });
    era = null;
  };

  for (let date = goal.startDate; date <= historyEnd; date = addDays(date, 1)) {
    if (skipped.has(date)) {
      continue;
    }
    const unit = unitOf(resolveSchedule(goal.scheduleVersions, date));
    if (!unit) {
      close(addDays(date, -1), "unit");
      continue;
    }

    const weekStart = unit === "week" ? weekStartOn(settings, date) : 1;
    if (era && (era.unit !== unit || eraWeekStart !== weekStart)) {
      close(addDays(date, -1), era.unit === unit ? "week_start" : "unit");
    }
    if (!era) {
      era = {
        start: date,
        end: date,
        unit,
        weekStartsOn: weekStart,
        endReason: "today",
      };
      eraWeekStart = weekStart;
    }
    era.end = date;
  }

  const finalReason: InternalEra["endReason"] = goal.archivedOn
    ? "archive"
    : "today";
  close(historyEnd, finalReason);
  return eras;
};

const hasExpectedDay = (
  versions: readonly ScheduleVersion[],
  date: string
): boolean => isExpectedOn(resolveSchedule(versions, date), date);

const dailyBestStreak = (
  era: InternalEra,
  versions: readonly ScheduleVersion[],
  sessionDates: ReadonlySet<string>,
  today: string,
  skipped: ReadonlySet<string>
): number => {
  let run = 0;
  let best = 0;
  for (let date = era.start; date <= era.end; date = addDays(date, 1)) {
    if (skipped.has(date) || !hasExpectedDay(versions, date)) {
      continue;
    }
    if (sessionDates.has(date)) {
      run += 1;
      best = Math.max(best, run);
    } else if (date < today) {
      run = 0;
    }
  }
  return best;
};

const dailyCurrentStreak = (
  era: InternalEra,
  versions: readonly ScheduleVersion[],
  sessionDates: ReadonlySet<string>,
  today: string,
  skipped: ReadonlySet<string>
): number => {
  let run = 0;
  for (let date = era.end; date >= era.start; date = addDays(date, -1)) {
    if (skipped.has(date) || !hasExpectedDay(versions, date)) {
      continue;
    }
    if (sessionDates.has(date)) {
      run += 1;
      continue;
    }
    if (date !== today) {
      break;
    }
  }
  return run;
};

const countDailyUnits = (
  era: InternalEra,
  versions: readonly ScheduleVersion[],
  sessionDates: ReadonlySet<string>,
  today: string,
  skipped: ReadonlySet<string>
): { expected: number; done: number } => {
  let expected = 0;
  let done = 0;
  const lastCompleted = addDays(today, -1);
  const end = era.end < lastCompleted ? era.end : lastCompleted;
  for (let date = era.start; date <= end; date = addDays(date, 1)) {
    if (skipped.has(date) || !hasExpectedDay(versions, date)) {
      continue;
    }
    expected += 1;
    if (sessionDates.has(date)) {
      done += 1;
    }
  }
  return { expected, done };
};

const daysBetween = (start: string, end: string): number =>
  Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
      86_400_000
  ) + 1;

const weekBlockStatus = ({
  target,
  transition,
  activeDays,
  sessions,
  completed,
}: {
  target: number | null;
  transition: boolean;
  activeDays: number;
  sessions: number;
  completed: boolean;
}): GoalWeekStatus => {
  if (!target || transition || activeDays < target) {
    return "not_scored";
  }
  if (sessions >= target) {
    return "met";
  }
  return completed ? "missed" : "in_progress";
};

const buildWeekBlocks = (
  era: InternalEra,
  goal: StatsGoal,
  settings: readonly StatsSettingsVersion[],
  sessionsByDate: ReadonlyMap<string, StatsSession>,
  today: string,
  skipped: ReadonlySet<string>
): GoalWeek[] => {
  const blocks: GoalWeek[] = [];

  for (const segment of weekSegments(settings, era.start, era.end)) {
    const start = segment.start < era.start ? era.start : segment.start;
    const end = segment.end > era.end ? era.end : segment.end;
    if (end < start) {
      continue;
    }
    const naturalEnd = weekEndOf(segment.start, era.weekStartsOn);
    const transition =
      segment.transition ||
      (naturalEnd > era.end &&
        (era.endReason === "unit" || era.endReason === "week_start"));
    const cadence = resolveSchedule(goal.scheduleVersions, start);
    const target = cadence?.type === "weekly_target" ? cadence.target : null;
    const activeEnd =
      goal.archivedOn && goal.archivedOn < segment.end
        ? goal.archivedOn
        : segment.end;
    const activeDays = activeEnd >= start ? daysBetween(start, activeEnd) : 0;
    let skippedActive = 0;
    for (const date of skipped) {
      if (date >= start && date <= activeEnd) {
        skippedActive += 1;
      }
    }
    const activeDayCount = Math.max(0, activeDays - skippedActive);
    let sessionCount = 0;
    for (const date of sessionsByDate.keys()) {
      if (date >= start && date <= end && !skipped.has(date)) {
        sessionCount += 1;
      }
    }
    const completed = naturalEnd < today;
    const status = weekBlockStatus({
      target,
      transition,
      activeDays: activeDayCount,
      sessions: sessionCount,
      completed,
    });

    blocks.push({
      start,
      end,
      target,
      sessions: sessionCount,
      activeDays: activeDayCount,
      completed,
      status,
    });
  }

  return blocks;
};

const weeklyBestStreak = (blocks: readonly GoalWeek[]): number => {
  let run = 0;
  let best = 0;
  for (const block of blocks) {
    if (block.status === "met") {
      run += 1;
      best = Math.max(best, run);
    } else if (block.status === "missed") {
      run = 0;
    }
  }
  return best;
};

const weeklyCurrentStreak = (blocks: readonly GoalWeek[]): number => {
  let run = 0;
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (!block) {
      continue;
    }
    if (block.status === "met") {
      run += 1;
    } else if (block.status === "missed") {
      break;
    }
  }
  return run;
};

const buildDays = (
  goal: StatsGoal,
  sessionsByDate: ReadonlyMap<string, StatsSession>,
  historyEnd: string,
  today: string,
  weekStartsOn: number,
  skipped: ReadonlySet<string>
): GoalDay[] => {
  const start = addDays(weekStartOf(historyEnd, weekStartsOn), -77);
  const days: GoalDay[] = [];

  for (let date = start; date <= historyEnd; date = addDays(date, 1)) {
    if (skipped.has(date)) {
      days.push({
        date,
        expected: false,
        extra: false,
        status: "none",
        minutes: null,
        mood: null,
        note: null,
      });
      continue;
    }
    const session = sessionsByDate.get(date);
    const active =
      date >= goal.startDate &&
      date <= today &&
      (!goal.archivedOn || date <= goal.archivedOn);
    const expected = active && hasExpectedDay(goal.scheduleVersions, date);
    let status: GoalDayStatus = "none";
    if (session) {
      status = "done";
    } else if (expected) {
      status = date < today ? "missed" : "open";
    }

    days.push({
      date,
      expected,
      extra: Boolean(session) && !expected,
      status,
      minutes: session?.minutes ?? null,
      mood: session?.mood ?? null,
      note: session?.note ?? null,
    });
  }

  return days;
};

export const minutesOf = (sessions: readonly StatsSession[]): GoalMinutes => {
  const withMinutes = sessions.filter(
    (entry) => typeof entry.minutes === "number" && entry.minutes > 0
  );
  const total = withMinutes.reduce(
    (sum, entry) => sum + (entry.minutes ?? 0),
    0
  );

  return {
    total,
    average:
      withMinutes.length >= 3 ? Math.round(total / withMinutes.length) : null,
    withMinutes: withMinutes.length,
    sessions: sessions.length,
  };
};

interface UnitCounts {
  expected: number;
  done: number;
}

const sumDailyUnits = (
  eras: readonly InternalEra[],
  versions: readonly ScheduleVersion[],
  sessionDates: ReadonlySet<string>,
  today: string,
  skipped: ReadonlySet<string>
): UnitCounts => {
  let expected = 0;
  let done = 0;
  for (const era of eras) {
    if (era.unit !== "day") {
      continue;
    }
    const counts = countDailyUnits(era, versions, sessionDates, today, skipped);
    expected += counts.expected;
    done += counts.done;
  }
  return { expected, done };
};

const sumWeeklyUnits = (
  eras: readonly InternalEra[],
  blocksByEra: ReadonlyMap<InternalEra, GoalWeek[]>
): UnitCounts => {
  let expected = 0;
  let done = 0;
  for (const era of eras) {
    if (era.unit !== "week") {
      continue;
    }
    for (const block of blocksByEra.get(era) ?? []) {
      if (
        block.completed &&
        (block.status === "met" || block.status === "missed")
      ) {
        expected += 1;
        if (block.status === "met") {
          done += 1;
        }
      }
    }
  }
  return { expected, done };
};

const consistencyOf = (
  unit: StreakUnit,
  daily: UnitCounts,
  weekly: UnitCounts
): GoalConsistency => {
  const units = unit === "week" ? weekly : daily;
  const qualified = unit === "week" ? units.expected >= 3 : units.expected >= 7;

  return {
    done: units.done,
    expected: units.expected,
    percent:
      qualified && units.expected > 0
        ? Math.round((units.done / units.expected) * 100)
        : null,
    qualified,
  };
};

const buildEraStats = (
  eras: readonly InternalEra[],
  goal: StatsGoal,
  sessionDates: ReadonlySet<string>,
  today: string,
  blocksByEra: ReadonlyMap<InternalEra, GoalWeek[]>,
  skipped: ReadonlySet<string>
): StreakEra[] =>
  eras.map((era) => ({
    startDate: era.start,
    endDate: era.end,
    unit: era.unit,
    bestStreak:
      era.unit === "day"
        ? dailyBestStreak(
            era,
            goal.scheduleVersions,
            sessionDates,
            today,
            skipped
          )
        : weeklyBestStreak(blocksByEra.get(era) ?? []),
  }));

const currentStreakOf = (
  era: InternalEra | null,
  archived: boolean,
  goal: StatsGoal,
  sessionDates: ReadonlySet<string>,
  today: string,
  blocksByEra: ReadonlyMap<InternalEra, GoalWeek[]>,
  skipped: ReadonlySet<string>
): number | null => {
  if (archived || !era) {
    return null;
  }
  if (era.unit === "day") {
    return dailyCurrentStreak(
      era,
      goal.scheduleVersions,
      sessionDates,
      today,
      skipped
    );
  }
  return weeklyCurrentStreak(blocksByEra.get(era) ?? []);
};

const futureStats = (
  startDate: string,
  today: string,
  weekStartsOn: number
): GoalStats => ({
  startsOn: startDate,
  futureStart: true,
  archived: false,
  historyEnd: today,
  weekStartsOn,
  unit: "day",
  consistency: { done: 0, expected: 0, percent: null, qualified: false },
  currentStreak: null,
  bestStreak: 0,
  eras: [],
  sessions: 0,
  minutes: { total: 0, average: null, withMinutes: 0, sessions: 0 },
  days: [],
  weeks: [],
});

export const goalStats = ({
  goal,
  sessions,
  settings,
  today,
  skippedDates = [],
}: GoalStatsInput): GoalStats => {
  const skipped = new Set(skippedDates);
  const futureStart = goal.startDate > today;
  if (futureStart) {
    return futureStats(goal.startDate, today, weekStartOn(settings, today));
  }

  const archived = Boolean(goal.archivedOn && goal.archivedOn < today);
  const historyEnd =
    goal.archivedOn && goal.archivedOn < today ? goal.archivedOn : today;
  const weekStartsOn = weekStartOn(settings, historyEnd);
  const byDate = new Map<string, StatsSession>();
  for (const entry of sessions) {
    if (
      !skipped.has(entry.logicalDate) &&
      entry.logicalDate >= goal.startDate &&
      entry.logicalDate <= historyEnd
    ) {
      byDate.set(entry.logicalDate, entry);
    }
  }
  const sessionDates = new Set(byDate.keys());
  const eras = buildEras(goal, settings, historyEnd, skipped);
  const currentEra = eras.at(-1) ?? null;
  const unit = currentEra?.unit ?? "day";
  const blocksByEra = new Map<InternalEra, GoalWeek[]>();
  for (const era of eras) {
    if (era.unit === "week") {
      blocksByEra.set(
        era,
        buildWeekBlocks(era, goal, settings, byDate, today, skipped)
      );
    }
  }

  const dailyUnits = sumDailyUnits(
    eras,
    goal.scheduleVersions,
    sessionDates,
    today,
    skipped
  );
  const weeklyUnits = sumWeeklyUnits(eras, blocksByEra);
  const consistency = consistencyOf(unit, dailyUnits, weeklyUnits);
  const eraStats = buildEraStats(
    eras,
    goal,
    sessionDates,
    today,
    blocksByEra,
    skipped
  );
  const currentStats = eraStats.at(-1);
  const currentStreak = currentStreakOf(
    currentEra,
    archived,
    goal,
    sessionDates,
    today,
    blocksByEra,
    skipped
  );
  const currentWeeks =
    currentEra?.unit === "week"
      ? (blocksByEra.get(currentEra) ?? []).slice(-12)
      : [];
  const activeSessions = sessions.filter(
    (entry) =>
      !skipped.has(entry.logicalDate) &&
      entry.logicalDate >= goal.startDate &&
      entry.logicalDate <= historyEnd
  );

  return {
    startsOn: goal.startDate,
    futureStart,
    archived,
    historyEnd,
    weekStartsOn,
    unit,
    consistency,
    currentStreak,
    bestStreak: currentStats?.bestStreak ?? 0,
    eras: eraStats,
    sessions: activeSessions.length,
    minutes: minutesOf(activeSessions),
    days: buildDays(goal, byDate, historyEnd, today, weekStartsOn, skipped),
    weeks: currentWeeks,
  };
};

export const overallConsistency = (
  goals: readonly Pick<GoalStats, "consistency">[]
): OverallConsistency => {
  const qualifying = goals.filter(
    (entry) => entry.consistency.qualified && entry.consistency.percent !== null
  );
  if (qualifying.length < 2) {
    return {
      percent: null,
      qualifying: qualifying.length,
      total: goals.length,
      notEnoughData: true,
    };
  }

  const sum = qualifying.reduce(
    (total, entry) => total + (entry.consistency.percent ?? 0),
    0
  );
  return {
    percent: Math.round(sum / qualifying.length),
    qualifying: qualifying.length,
    total: goals.length,
    notEnoughData: false,
  };
};
