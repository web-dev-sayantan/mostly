import type { GoalDto } from "@mostly/api/routers/goals";
import { addLogicalDays, resolveSchedule } from "@mostly/domain";
import type { Cadence, Weekday } from "@mostly/domain";

export const GOAL_COLORS = [
  { id: "sage", label: "Sage", value: "#7c9076" },
  { id: "clay", label: "Clay", value: "#b07a63" },
  { id: "ochre", label: "Ochre", value: "#c09856" },
  { id: "slate-blue", label: "Slate blue", value: "#6f859b" },
  { id: "plum", label: "Plum", value: "#8c7288" },
  { id: "moss", label: "Moss", value: "#6e7b56" },
] as const;

export const EMOJI_CHOICES = [
  "📖",
  "🎸",
  "🎤",
  "💻",
  "🏃",
  "🧘",
  "✍️",
  "🌱",
  "🎨",
  "🎹",
  "🧠",
  "🚲",
  "🏋️",
  "🥗",
  "💧",
  "🌙",
] as const;

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const WEEKDAYS: { value: Weekday; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" },
];

const WEEKDAY_SHORT = Object.fromEntries(
  WEEKDAYS.map(({ value, short }) => [value, short])
) as Record<Weekday, string>;

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Today, or tomorrow once the 9:30 PM reminder time has passed. */
export const defaultStartDate = (today: string, now = new Date()): string => {
  if (now.getHours() * 60 + now.getMinutes() >= 21 * 60 + 30) {
    return addLogicalDays(today, 1);
  }
  return today;
};

export const formatDayMonth = (date: string): string =>
  DAY_MONTH.format(new Date(`${date}T00:00:00Z`));

export const isArchived = (goal: GoalDto, today: string): boolean =>
  Boolean(goal.archivedOn && goal.archivedOn < today);

export const isFutureStart = (goal: GoalDto, today: string): boolean =>
  goal.startDate > today;

export const effectiveCadence = (
  goal: GoalDto,
  today: string
): Cadence | null => {
  const current = resolveSchedule(goal.scheduleVersions, today);
  if (current) {
    return current;
  }
  return goal.scheduleVersions.at(-1)?.cadence ?? null;
};

export const cadenceSummary = (cadence: Cadence | null): string => {
  if (!cadence) {
    return "No cadence";
  }
  if (cadence.type === "daily") {
    return "Daily";
  }
  if (cadence.type === "weekdays") {
    return cadence.weekdays.map((day) => WEEKDAY_SHORT[day]).join(" / ");
  }
  return `${cadence.target} ${cadence.target === 1 ? "time" : "times"} a week`;
};

/** The extra line a row needs for a goal that is not simply active. */
export const timingNote = (goal: GoalDto, today: string): string | null => {
  if (isArchived(goal, today)) {
    return `Archived ${formatDayMonth(goal.archivedOn as string)}`;
  }
  if (goal.archivedOn === today) {
    return "Archives tomorrow";
  }
  if (isFutureStart(goal, today)) {
    return `Starts ${formatDayMonth(goal.startDate)}`;
  }
  return null;
};
