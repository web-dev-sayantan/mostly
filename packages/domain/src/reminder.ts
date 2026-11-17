import { logicalDate, weekStartOf } from "./logical-day";
import type { ScheduleVersion } from "./schedule";
import { isExpectedOn, resolveSchedule } from "./schedule";

export const DEFAULT_REMINDER_TIME = "21:30";

export interface ReminderSettings {
  enabled: boolean;
  /** Local HH:MM. */
  time: string;
  timeZone: string;
  rolloverHour: number;
  weekStartsOn: number;
}

export interface ReminderGoal {
  id: string;
  startDate: string;
  archivedOn: string | null;
  scheduleVersions: readonly ScheduleVersion[];
}

export interface ReminderSession {
  goalId: string;
  logicalDate: string;
}

export type ReminderSkipReason = "disabled" | "not_due" | "already_delivered";
export type ReminderSuppressionReason =
  | "all_done"
  | "no_active_goals"
  | "nothing_open";

export type ReminderPlan =
  | { kind: "skip"; reason: ReminderSkipReason }
  | {
      kind: "suppressed";
      logicalDate: string;
      reason: ReminderSuppressionReason;
    }
  | { kind: "send"; logicalDate: string; openCount: number };

export type ReminderDue =
  | { due: false; reason: ReminderSkipReason }
  | { due: true; logicalDate: string };

const TIME_PATTERN = /^(?<hours>[01]\d|2[0-3]):(?<minutes>[0-5]\d)$/u;

const minutesOfTime = (time: string): number | null => {
  const match = TIME_PATTERN.exec(time);
  if (!match?.groups) {
    return null;
  }
  return Number(match.groups.hours) * 60 + Number(match.groups.minutes);
};

const localMinutes = (instant: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return value("hour") * 60 + value("minute");
};

const cadenceOn = (goal: ReminderGoal, date: string) =>
  resolveSchedule(goal.scheduleVersions, date) ??
  resolveSchedule(goal.scheduleVersions, goal.startDate);

const isActiveOn = (goal: ReminderGoal, date: string): boolean =>
  date >= goal.startDate &&
  (goal.archivedOn === null || date <= goal.archivedOn);

export interface ReminderOpenItems {
  openCount: number;
  scheduled: number;
  weeklyTargets: number;
  activeGoals: number;
}

/** Open scheduled goals plus one per unmet weekly target on a logical day. */
export const countOpenItems = ({
  date,
  weekStartsOn,
  goals,
  sessions,
}: {
  date: string;
  weekStartsOn: number;
  goals: readonly ReminderGoal[];
  sessions: readonly ReminderSession[];
}): ReminderOpenItems => {
  const active = goals.filter((goal) => isActiveOn(goal, date));
  const sessionDates = new Set(
    sessions
      .filter((session) => session.logicalDate === date)
      .map((session) => session.goalId)
  );
  const weekStart = weekStartOf(date, weekStartsOn);
  let openCount = 0;
  let scheduled = 0;
  let weeklyTargets = 0;

  for (const goal of active) {
    const cadence = cadenceOn(goal, date);
    if (cadence?.type === "weekly_target") {
      weeklyTargets += 1;
      const logged = sessions.filter(
        (session) =>
          session.goalId === goal.id &&
          session.logicalDate >= weekStart &&
          session.logicalDate <= date
      ).length;
      if (logged < cadence.target) {
        openCount += 1;
      }
      continue;
    }

    if (isExpectedOn(cadence, date)) {
      scheduled += 1;
      if (!sessionDates.has(goal.id)) {
        openCount += 1;
      }
    }
  }

  return {
    openCount,
    scheduled,
    weeklyTargets,
    activeGoals: active.length,
  };
};

/** Whether the local clock has reached the reminder time for this logical day. */
export const isReminderDue = ({
  now,
  settings,
  deliveredDates,
}: {
  now: Date;
  settings: ReminderSettings;
  deliveredDates: readonly string[];
}): ReminderDue => {
  if (!settings.enabled) {
    return { due: false, reason: "disabled" };
  }

  const date = logicalDate(now, {
    timeZone: settings.timeZone,
    rolloverHour: settings.rolloverHour,
  });
  if (deliveredDates.includes(date)) {
    return { due: false, reason: "already_delivered" };
  }

  const reminderMinutes = minutesOfTime(settings.time);
  if (
    reminderMinutes === null ||
    localMinutes(now, settings.timeZone) < reminderMinutes
  ) {
    return { due: false, reason: "not_due" };
  }

  return { due: true, logicalDate: date };
};

/**
 * The one reminder decision for a logical day. Daily and weekday goals count
 * when scheduled and open; each unmet weekly target counts as one open item.
 */
export const reminderPlan = ({
  now,
  settings,
  goals,
  sessions,
  deliveredDates,
}: {
  now: Date;
  settings: ReminderSettings;
  goals: readonly ReminderGoal[];
  sessions: readonly ReminderSession[];
  deliveredDates: readonly string[];
}): ReminderPlan => {
  const due = isReminderDue({ now, settings, deliveredDates });
  if (!due.due) {
    return { kind: "skip", reason: due.reason };
  }

  const { logicalDate: date } = due;
  const counts = countOpenItems({
    date,
    weekStartsOn: settings.weekStartsOn,
    goals,
    sessions,
  });
  if (counts.activeGoals === 0) {
    return { kind: "suppressed", logicalDate: date, reason: "no_active_goals" };
  }
  if (counts.openCount === 0) {
    return {
      kind: "suppressed",
      logicalDate: date,
      reason:
        counts.scheduled > 0 || counts.weeklyTargets > 0
          ? "all_done"
          : "nothing_open",
    };
  }

  return { kind: "send", logicalDate: date, openCount: counts.openCount };
};

/** The push payload carries a count and nothing about the goals themselves. */
export const reminderPayload = (openCount: number) => ({ count: openCount });

/** "2 goals left today. Close the day when you're ready." */
export const reminderCopy = (openCount: number): string => {
  const goals = openCount === 1 ? "goal" : "goals";
  return `${openCount} ${goals} left today. Close the day when you're ready.`;
};
