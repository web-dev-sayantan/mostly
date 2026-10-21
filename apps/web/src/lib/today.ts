import type { GoalDto } from "@mostly/api/routers/goals";
import type { Cadence, SettingVersion } from "@mostly/domain";
import {
  addLogicalDays,
  comparePriority,
  isExpectedOn,
  resolveSchedule,
  resolveSettingsForNow,
  weekEndOf,
  weekStartOf,
} from "@mostly/domain";

import type { LocalSession } from "./offline/store";
import { NOT_SCORED_COPY } from "./stats-format";

export interface TodayGoal {
  goal: GoalDto;
  cadence: Cadence;
  session: LocalSession | null;
}

export interface WeeklyGoal {
  goal: GoalDto;
  target: number;
  count: number;
  /** The week has at least `target` active days, so its outcome counts. */
  scored: boolean;
  met: boolean;
  session: LocalSession | null;
  weekStart: string;
  weekEnd: string;
}

export interface TodayView {
  todayGoals: TodayGoal[];
  weeklyGoals: WeeklyGoal[];
  dailyDone: number;
  dailyTotal: number;
  weeklyOpenCount: number;
  weeklyTotal: number;
  activeGoalCount: number;
  weekStart: string;
  weekEnd: string;
}

const byPriorityThenCreation = (a: GoalDto, b: GoalDto): number =>
  comparePriority(a.priority, b.priority) ||
  a.createdAt.localeCompare(b.createdAt) ||
  a.id.localeCompare(b.id);

const cadenceOn = (goal: GoalDto, date: string): Cadence | null =>
  resolveSchedule(goal.scheduleVersions, date) ??
  goal.scheduleVersions.at(-1)?.cadence ??
  null;

const isActive = (goal: GoalDto, today: string): boolean =>
  goal.archivedOn === null || goal.archivedOn >= today;

const sessionKey = (goalId: string, date: string): string =>
  `${goalId}:${date}`;

const activeDaysInWeek = (
  goal: GoalDto,
  weekStart: string,
  weekEnd: string
) => {
  let active = 0;
  for (let date = weekStart; date <= weekEnd; date = addLogicalDays(date, 1)) {
    if (
      date >= goal.startDate &&
      (goal.archivedOn === null || date <= goal.archivedOn)
    ) {
      active += 1;
    }
  }
  return active;
};

export const buildTodayView = ({
  goals,
  sessions,
  today,
  weekStartsOn,
}: {
  goals: readonly GoalDto[];
  sessions: readonly LocalSession[];
  today: string;
  weekStartsOn: number;
}): TodayView => {
  const weekStart = weekStartOf(today, weekStartsOn);
  const weekEnd = weekEndOf(today, weekStartsOn);
  const activeGoals = goals
    .filter((goal) => isActive(goal, today))
    .toSorted(byPriorityThenCreation);
  const sessionsByKey = new Map(
    sessions.map((entry) => [
      sessionKey(entry.goalId, entry.logicalDate),
      entry,
    ])
  );
  const sessionOn = (goalId: string, date: string) =>
    sessionsByKey.get(sessionKey(goalId, date)) ?? null;

  const todayGoals: TodayGoal[] = [];
  const weeklyGoals: WeeklyGoal[] = [];

  for (const goal of activeGoals) {
    if (goal.startDate > today) {
      continue;
    }
    const cadence = cadenceOn(goal, today);
    if (!cadence) {
      continue;
    }
    if (isExpectedOn(cadence, today)) {
      todayGoals.push({
        goal,
        cadence,
        session: sessionOn(goal.id, today),
      });
      continue;
    }
    if (cadence.type !== "weekly_target") {
      continue;
    }

    const dates = new Set(
      sessions
        .filter(
          (entry) =>
            entry.goalId === goal.id &&
            entry.logicalDate >= weekStart &&
            entry.logicalDate <= weekEnd &&
            entry.logicalDate >= goal.startDate &&
            (goal.archivedOn === null || entry.logicalDate <= goal.archivedOn)
        )
        .map((entry) => entry.logicalDate)
    );
    const activeDays = activeDaysInWeek(goal, weekStart, weekEnd);

    weeklyGoals.push({
      goal,
      target: cadence.target,
      count: dates.size,
      scored: activeDays >= cadence.target,
      met: dates.size >= cadence.target,
      session: sessionOn(goal.id, today),
      weekStart,
      weekEnd,
    });
  }

  return {
    todayGoals,
    weeklyGoals,
    dailyDone: todayGoals.filter((entry) => entry.session !== null).length,
    dailyTotal: todayGoals.length,
    weeklyOpenCount: weeklyGoals.filter((entry) => !entry.met).length,
    weeklyTotal: weeklyGoals.length,
    activeGoalCount: activeGoals.length,
    weekStart,
    weekEnd,
  };
};

export const dailyProgressPercent = (done: number, total: number): number =>
  total === 0 ? 0 : Math.round((done / total) * 100);

export const todayProgressCopy = ({
  dailyDone,
  dailyTotal,
  weeklyOpenCount,
  weeklyTotal,
}: {
  dailyDone: number;
  dailyTotal: number;
  weeklyOpenCount: number;
  weeklyTotal: number;
}): string | null => {
  if (dailyTotal > 0) {
    if (dailyDone < dailyTotal) {
      return `${dailyDone} of ${dailyTotal} done`;
    }
    if (weeklyOpenCount > 0) {
      return `Today's list is done. ${weeklyOpenCount} weekly ${
        weeklyOpenCount === 1 ? "target" : "targets"
      } still open.`;
    }
    return `That's the day. ${dailyTotal} of ${dailyTotal}.`;
  }
  if (weeklyTotal > 0) {
    return `${weeklyTotal} weekly ${weeklyTotal === 1 ? "target" : "targets"}`;
  }
  return null;
};

export const weeklyTargetCopy = (weekly: WeeklyGoal): string => {
  if (!weekly.scored) {
    return NOT_SCORED_COPY;
  }
  if (weekly.met) {
    return "Target met";
  }
  return `${weekly.count} of ${weekly.target} this week`;
};

export const weeklyCountCopy = (weekly: WeeklyGoal): string =>
  `${weekly.count} of ${weekly.target} this week`;

export const hasSessionDetails = (
  session: Pick<LocalSession, "minutes" | "note" | "mood"> | null
): boolean =>
  session !== null &&
  (session.minutes !== null ||
    session.mood !== null ||
    (session.note !== null && session.note.length > 0));

/**
 * Resolve the logical day and settings version from cached history. The newest
 * version hints at the timezone, then the chosen version corrects the date.
 */
export const resolveTodaySettings = <Version extends SettingVersion>(
  history: readonly Version[],
  now: Date
): { today: string; current: Version } | null => {
  const sorted = history.toSorted((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom)
  );
  const latest = sorted.at(-1);
  if (!latest) {
    return null;
  }

  return resolveSettingsForNow(sorted, now, {
    timeZone: latest.timeZone,
    rolloverHour: latest.dayRolloverHour,
  });
};
