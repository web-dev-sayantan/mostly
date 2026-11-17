import type { Weekday } from "./logical-day";
import { addLogicalDays as addDays, weekdayOf } from "./logical-day";

export type { Weekday } from "./logical-day";
export { addLogicalDays as addDays, weekdayOf } from "./logical-day";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export type Cadence =
  | { type: "daily" }
  | { type: "weekdays"; weekdays: Weekday[] }
  | { type: "weekly_target"; target: number };

export interface ScheduleVersion {
  effectiveFrom: string;
  cadence: Cadence;
}

export interface SchedulePlan {
  /** Versions already in effect, never rewritten. */
  current: ScheduleVersion[];
  /** The single future version, or null when the change needs none. */
  pending: ScheduleVersion | null;
}

export const isIsoDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

export const normalizeCadence = (cadence: Cadence): Cadence => {
  if (cadence.type !== "weekdays") {
    return cadence;
  }

  const weekdays = [...new Set(cadence.weekdays)].toSorted(
    (a, b) => a - b
  ) as Weekday[];
  return weekdays.length === 7
    ? { type: "daily" }
    : { type: "weekdays", weekdays };
};

export const sameCadence = (a: Cadence, b: Cadence): boolean => {
  const left = normalizeCadence(a);
  const right = normalizeCadence(b);

  if (left.type !== right.type) {
    return false;
  }
  if (left.type === "weekdays" && right.type === "weekdays") {
    return left.weekdays.join(",") === right.weekdays.join(",");
  }
  if (left.type === "weekly_target" && right.type === "weekly_target") {
    return left.target === right.target;
  }
  return true;
};

/** The version in effect on a date: the latest effective_from on or before it. */
export const resolveSchedule = (
  versions: readonly ScheduleVersion[],
  date: string
): Cadence | null => {
  let inEffect: ScheduleVersion | null = null;

  for (const version of versions) {
    if (
      version.effectiveFrom <= date &&
      (!inEffect || version.effectiveFrom > inEffect.effectiveFrom)
    ) {
      inEffect = version;
    }
  }

  return inEffect?.cadence ?? null;
};

/** Daily and weekday goals have daily expectations. Weekly targets do not. */
export const isExpectedOn = (
  cadence: Cadence | null,
  date: string
): boolean => {
  if (cadence?.type === "daily") {
    return true;
  }
  if (cadence?.type === "weekdays") {
    return cadence.weekdays.includes(weekdayOf(date));
  }
  return false;
};

/** The first day of the next week, strictly after the given date. */
export const nextWeekStart = (
  date: string,
  weekStartsOn: Weekday = 1
): string => {
  const daysUntil = (weekStartsOn - weekdayOf(date) + 7) % 7;
  return addDays(date, daysUntil === 0 ? 7 : daysUntil);
};

export const initialSchedule = (
  startDate: string,
  cadence: Cadence
): ScheduleVersion => ({
  effectiveFrom: startDate,
  cadence: normalizeCadence(cadence),
});

/**
 * How a cadence edit reaches the schedule. Daily ↔ weekday lands tomorrow; any
 * weekly-target change lands next week. Only one pending version is kept.
 */
export const planScheduleChange = ({
  versions,
  today,
  cadence,
  startDate,
  weekStartsOn = 1,
}: {
  versions: readonly ScheduleVersion[];
  today: string;
  cadence: Cadence;
  startDate: string;
  weekStartsOn?: Weekday;
}): SchedulePlan => {
  const normalized = normalizeCadence(cadence);
  const sorted = versions.toSorted((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom)
  );
  const current = sorted.filter((version) => version.effectiveFrom <= today);

  if (current.length === 0) {
    return {
      current: [],
      pending: {
        effectiveFrom: startDate > today ? startDate : today,
        cadence: normalized,
      },
    };
  }

  const inEffect = current.at(-1) as ScheduleVersion;
  if (sameCadence(inEffect.cadence, normalized)) {
    return { current, pending: null };
  }

  const unitChanges =
    inEffect.cadence.type === "weekly_target" ||
    normalized.type === "weekly_target";
  const effectiveFrom = unitChanges
    ? nextWeekStart(today, weekStartsOn)
    : addDays(today, 1);

  return { current, pending: { effectiveFrom, cadence: normalized } };
};
