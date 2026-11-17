/** The browser's IANA zone, falling back to UTC where Intl cannot report one. */
export const detectedTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/** "Tuesday, 20 October" for a logical date. */
export const formatLogicalDate = (date: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

export const formatRolloverHour = (hour: number): string =>
  `${hour === 0 ? 12 : hour} AM`;
