export interface TimeSettings {
  timeZone: string;
  rolloverHour: number;
}

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
export const logicalDate = (instant: Date, { timeZone, rolloverHour }: TimeSettings): string => {
  const { year, month, day, hour } = localParts(instant, timeZone);
  const offset = hour < rolloverHour ? -1 : 0;

  return new Date(Date.UTC(year, month - 1, day) + offset * MS_PER_DAY).toISOString().slice(0, 10);
};
