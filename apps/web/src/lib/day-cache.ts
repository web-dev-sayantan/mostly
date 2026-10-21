import type { DayDetailDto, DaySessionDto } from "@mostly/api/routers/days";

import type { StorageLike } from "./offline/store";
import { OFFLINE_STORAGE_KEYS } from "./offline/store";

const MAX_CACHED_DAYS = 31;

type DayCache = Record<string, DayDetailDto>;

const browserStorage = (): StorageLike | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const withoutDetails = (session: DaySessionDto): DaySessionDto => ({
  ...session,
  note: null,
  mood: null,
});

/** Notes and moods live only in the offline session store, never a second cache. */
export const sanitizeDayDetail = (day: DayDetailDto): DayDetailDto => ({
  ...day,
  expectations: day.expectations.map((entry) => ({
    ...entry,
    session: entry.session ? withoutDetails(entry.session) : null,
  })),
  extras: day.extras.map((entry) => ({
    ...entry,
    session: withoutDetails(entry.session),
  })),
  weekly: day.weekly.map((entry) => ({
    ...entry,
    session: entry.session ? withoutDetails(entry.session) : null,
  })),
  weekSessions: day.weekSessions.map(withoutDetails),
});

const read = (storage: StorageLike | null): DayCache => {
  try {
    const value = storage?.getItem(OFFLINE_STORAGE_KEYS.days);
    return value ? (JSON.parse(value) as DayCache) : {};
  } catch {
    return {};
  }
};

/** Keep the last month of viewed days available offline. */
export const cacheDayDetail = (
  day: DayDetailDto,
  storage: StorageLike | null = browserStorage()
): void => {
  try {
    const entries = Object.entries({
      ...read(storage),
      [day.date]: sanitizeDayDetail(day),
    }).toSorted(([left], [right]) => right.localeCompare(left));
    storage?.setItem(
      OFFLINE_STORAGE_KEYS.days,
      JSON.stringify(Object.fromEntries(entries.slice(0, MAX_CACHED_DAYS)))
    );
  } catch {
    // The live response still renders; offline falls back to the previous copy.
  }
};

export const cachedDayDetail = (
  date: string,
  storage: StorageLike | null = browserStorage()
): DayDetailDto | null => read(storage)[date] ?? null;
