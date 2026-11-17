export interface TimeSettings {
  timeZone: string;
  rolloverHour: number;
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const MS_PER_DAY = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

const localParts = (instant: Date, timeZone: string) => {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }

  const parts = formatter.formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
  };
};

/** The logical day an instant belongs to, under the user's time and rollover settings. */
export const logicalDate = (
  instant: Date,
  { timeZone, rolloverHour }: TimeSettings
): string => {
  const { year, month, day, hour } = localParts(instant, timeZone);
  const offset = hour < rolloverHour ? -1 : 0;

  return new Date(Date.UTC(year, month - 1, day) + offset * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
};

/** Whether the local clock is past midnight but before the day's rollover. */
export const isBeforeRollover = (
  instant: Date,
  { timeZone, rolloverHour }: TimeSettings
): boolean => localParts(instant, timeZone).hour < rolloverHour;

/** Add whole days to a logical date string (YYYY-MM-DD). */
export const addLogicalDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);

/** Weekday of a logical date: 1 = Monday … 7 = Sunday. */
export const weekdayOf = (date: string): Weekday => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (day === 0 ? 7 : day) as Weekday;
};

/**
 * The first instant after `instant` where the logical date changes. Dates are
 * monotonic for a fixed setting, so a binary search finds the boundary.
 */
export const nextLogicalBoundary = (
  instant: Date,
  settings: TimeSettings
): Date => {
  const today = logicalDate(instant, settings);
  let low = instant.getTime();
  let high = low + 2 * MS_PER_DAY;

  while (high - low > 1000) {
    const middle = Math.floor((low + high) / 2);
    if (logicalDate(new Date(middle), settings) === today) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return new Date(high);
};

/** First logical date of the week containing `date`. */
export const weekStartOf = (date: string, weekStartsOn: number): string =>
  addLogicalDays(date, -((weekdayOf(date) - weekStartsOn + 7) % 7));

/** Last logical date of the week containing `date`. */
export const weekEndOf = (date: string, weekStartsOn: number): string =>
  addLogicalDays(weekStartOf(date, weekStartsOn), 6);

/** Whether `date` falls inside the last `days` logical days, today included. */
export const isWithinLastLogicalDays = (
  date: string,
  today: string,
  days = 7
): boolean => date <= today && date >= addLogicalDays(today, -(days - 1));
