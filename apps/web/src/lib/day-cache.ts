import type { DayDetailDto } from "@mostly/api/routers/days";

import { OFFLINE_STORAGE_KEYS } from "./offline/store";

const MAX_CACHED_DAYS = 31;

type DayCache = Record<string, DayDetailDto>;

const storage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const read = (): DayCache => {
  try {
    const value = storage()?.getItem(OFFLINE_STORAGE_KEYS.days);
    return value ? (JSON.parse(value) as DayCache) : {};
  } catch {
    return {};
  }
};

/** Keep the last month of viewed days available offline. */
export const cacheDayDetail = (day: DayDetailDto): void => {
  try {
    const entries = Object.entries({ ...read(), [day.date]: day }).toSorted(
      ([left], [right]) => right.localeCompare(left)
    );
    storage()?.setItem(
      OFFLINE_STORAGE_KEYS.days,
      JSON.stringify(Object.fromEntries(entries.slice(0, MAX_CACHED_DAYS)))
    );
  } catch {
    // The live response still renders; offline falls back to the previous copy.
  }
};

export const cachedDayDetail = (date: string): DayDetailDto | null =>
  read()[date] ?? null;
