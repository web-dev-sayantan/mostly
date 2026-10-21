import type { GoalDto } from "@mostly/api/routers/goals";
import type { SettingVersion } from "@mostly/domain";

export interface CachedGoals {
  active: GoalDto[];
  archived: GoalDto[];
}

export interface TodayCache {
  goals: CachedGoals | null;
  settings: SettingVersion[] | null;
}

const CACHE_KEY = "mostly:today-cache";

const emptyCache: TodayCache = { goals: null, settings: null };

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

const isGoal = (value: unknown): value is GoalDto => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const goal = value as Partial<GoalDto>;
  return (
    typeof goal.id === "string" &&
    typeof goal.name === "string" &&
    typeof goal.startDate === "string" &&
    typeof goal.createdAt === "string" &&
    typeof goal.priority === "string" &&
    Array.isArray(goal.scheduleVersions)
  );
};

const isGoalList = (value: unknown): value is CachedGoals => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const list = value as Partial<CachedGoals>;
  return (
    Array.isArray(list.active) &&
    list.active.every(isGoal) &&
    Array.isArray(list.archived) &&
    list.archived.every(isGoal)
  );
};

const isSettingHistory = (value: unknown): value is SettingVersion[] =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof entry.effectiveFrom === "string" &&
      typeof entry.timeZone === "string" &&
      typeof entry.weekStartsOn === "number" &&
      typeof entry.dayRolloverHour === "number"
  );

export const readTodayCache = (): TodayCache => {
  const store = storage();
  if (!store) {
    return emptyCache;
  }
  try {
    const raw = store.getItem(CACHE_KEY);
    if (!raw) {
      return emptyCache;
    }
    const parsed = JSON.parse(raw) as Partial<TodayCache>;
    return {
      goals: isGoalList(parsed.goals) ? parsed.goals : null,
      settings: isSettingHistory(parsed.settings) ? parsed.settings : null,
    };
  } catch {
    return emptyCache;
  }
};

const writeTodayCache = (cache: TodayCache): void => {
  const store = storage();
  if (!store) {
    return;
  }
  try {
    // Goal names live here so the daily loop opens offline. No notes or moods.
    store.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // The online query still serves this visit.
  }
};

export const writeGoalsCache = (goals: CachedGoals): void => {
  writeTodayCache({ ...readTodayCache(), goals });
};

export const writeSettingsCache = (
  history: readonly SettingVersion[]
): void => {
  writeTodayCache({ ...readTodayCache(), settings: [...history] });
};

export const clearTodayCache = (): void => {
  try {
    storage()?.removeItem(CACHE_KEY);
  } catch {
    // Nothing else to clear.
  }
};
