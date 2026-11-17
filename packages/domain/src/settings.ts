import type { TimeSettings } from "./logical-day";
import {
  addLogicalDays,
  logicalDate,
  nextLogicalBoundary,
  weekStartOf,
} from "./logical-day";

export interface SettingValues {
  timeZone: string;
  /** 1 = Monday … 7 = Sunday. */
  weekStartsOn: number;
  /** 0–6, the local hour that closes the previous logical day. */
  dayRolloverHour: number;
}

export interface SettingVersion extends SettingValues {
  effectiveFrom: string;
  /** Logical dates the timezone jump at this version never produced. */
  skippedDates?: readonly string[] | null;
}

export interface PlannedSettingVersion extends SettingValues {
  effectiveFrom: string;
}

export interface SettingChangePlan {
  versions: PlannedSettingVersion[];
  timeZoneChanged: boolean;
  dayRolloverChanged: boolean;
  weekStartChanged: boolean;
  /** A week-start change starts a new weekly streak era and resets the current weekly streak. */
  weeklyStreakReset: boolean;
  /** The week before the new week start is in progress and is not scored. */
  transitionWeek: { start: string; end: string } | null;
}

/** The version in effect on a logical date. Dates before the first version keep the first one,
 * so a new user's history never resolves to nothing. Ties prefer the later list entry.
 */
export const settingsForDate = <Version extends { effectiveFrom: string }>(
  versions: readonly Version[],
  date: string
): Version | undefined => {
  let effective: Version | undefined;
  let earliest: Version | undefined;

  for (const version of versions) {
    if (
      version.effectiveFrom <= date &&
      (!effective || version.effectiveFrom >= effective.effectiveFrom)
    ) {
      effective = version;
    }
    if (!earliest || version.effectiveFrom < earliest.effectiveFrom) {
      earliest = version;
    }
  }

  return effective ?? earliest;
};

/** The week-start setting in effect on a logical date. */
export const weekStartsOnFor = (
  versions: readonly Pick<SettingVersion, "effectiveFrom" | "weekStartsOn">[],
  date: string
): number => settingsForDate(versions, date)?.weekStartsOn ?? 1;

/** Every logical date skipped by any recorded timezone jump. */
export const skippedDatesOf = (
  versions: readonly Pick<SettingVersion, "skippedDates">[]
): string[] => {
  const dates = new Set<string>();
  for (const version of versions) {
    for (const date of version.skippedDates ?? []) {
      dates.add(date);
    }
  }
  return [...dates];
};

/** An instant inside the given logical date, used when no clock instant is given. */
const instantOnLogicalDate = (date: string, settings: TimeSettings): Date => {
  let instant = new Date(`${date}T12:00:00Z`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const resolved = logicalDate(instant, settings);
    if (resolved === date) {
      break;
    }
    const days = Math.round(
      (Date.parse(`${resolved}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) /
        86_400_000
    );
    instant = new Date(instant.getTime() - days * 86_400_000);
  }
  return instant;
};

/**
 * Dates a timezone jump never produces. The change lands at the next logical
 * boundary under the old settings; if the new zone is already past that date,
 * the dates in between have no expectation and no data.
 */
export const skippedDatesForTimeZoneChange = ({
  today,
  now,
  current,
  next,
}: {
  /** The resolved logical today from the settings handler, not recomputed. */
  today: string;
  /** Anchors the next boundary under the old settings. */
  now?: Date;
  current: TimeSettings;
  next: TimeSettings;
}): string[] => {
  const boundary = nextLogicalBoundary(
    now ?? instantOnLogicalDate(today, current),
    current
  );
  const firstNewDate = logicalDate(boundary, next);
  const dates: string[] = [];

  for (
    let date = addLogicalDays(today, 1);
    date < firstNewDate;
    date = addLogicalDays(date, 1)
  ) {
    dates.push(date);
  }

  return dates;
};

/**
 * Today and the version in effect. Walk the history in order: the day a version
 * starts opens under the previous rule, later days follow that version's rule.
 * The cache hint is never needed for correctness, so a stale rollover cannot
 * reopen or skip a day.
 */
export const resolveSettingsForNow = <Version extends SettingVersion>(
  versions: readonly Version[],
  now: Date,
  _hint?: TimeSettings | null
): { today: string; current: Version } | null => {
  const sorted = versions.toSorted((left, right) =>
    left.effectiveFrom.localeCompare(right.effectiveFrom)
  );
  const [first] = sorted;
  if (!first) {
    return null;
  }

  let today = logicalDate(now, {
    timeZone: first.timeZone,
    rolloverHour: first.dayRolloverHour,
  });
  let current = first;

  for (const version of sorted.slice(1)) {
    const { effectiveFrom } = version;
    if (today < effectiveFrom) {
      break;
    }
    const newToday = logicalDate(now, {
      timeZone: version.timeZone,
      rolloverHour: version.dayRolloverHour,
    });
    const skipped = version.skippedDates?.includes(effectiveFrom) ?? false;
    if (today === effectiveFrom && !skipped) {
      // The effective day opened under the previous rule; keep it until this
      // rule has caught up to the same day.
      today = effectiveFrom;
    } else {
      // Follow the new rule, but never move before the day that already opened.
      today = newToday > effectiveFrom ? newToday : effectiveFrom;
    }
    current = version;
  }

  return { today, current };
};

/** The first boundary of the given week start strictly after `date`. */
const nextWeekStart = (date: string, weekStartsOn: number): string =>
  addLogicalDays(weekStartOf(date, weekStartsOn), 7);

/**
 * Plan the prospective versions for a settings change made on `today`.
 * Rollover and timezone apply at the next logical-day boundary; week start applies next week.
 */
export const planSettingChange = (
  current: SettingVersion,
  today: string,
  changes: Partial<SettingValues>
): SettingChangePlan => {
  const next: SettingValues = {
    timeZone: changes.timeZone ?? current.timeZone,
    weekStartsOn: changes.weekStartsOn ?? current.weekStartsOn,
    dayRolloverHour: changes.dayRolloverHour ?? current.dayRolloverHour,
  };

  const timeZoneChanged = next.timeZone !== current.timeZone;
  const dayRolloverChanged = next.dayRolloverHour !== current.dayRolloverHour;
  const weekStartChanged = next.weekStartsOn !== current.weekStartsOn;
  const nextDay = addLogicalDays(today, 1);

  if (!(timeZoneChanged || dayRolloverChanged || weekStartChanged)) {
    return {
      versions: [],
      timeZoneChanged,
      dayRolloverChanged,
      weekStartChanged,
      weeklyStreakReset: false,
      transitionWeek: null,
    };
  }

  const weeklyChange = weekStartChanged
    ? {
        effectiveFrom: nextWeekStart(today, next.weekStartsOn),
        transitionWeek: {
          start: weekStartOf(today, current.weekStartsOn),
          end: addLogicalDays(nextWeekStart(today, next.weekStartsOn), -1),
        },
      }
    : null;

  const dailyChange = timeZoneChanged || dayRolloverChanged;

  const versions =
    weeklyChange && dailyChange && weeklyChange.effectiveFrom !== nextDay
      ? [
          {
            ...current,
            timeZone: next.timeZone,
            dayRolloverHour: next.dayRolloverHour,
            effectiveFrom: nextDay,
          },
          {
            ...next,
            effectiveFrom: weeklyChange.effectiveFrom,
          },
        ]
      : [{ ...next, effectiveFrom: weeklyChange?.effectiveFrom ?? nextDay }];

  return {
    versions,
    timeZoneChanged,
    dayRolloverChanged,
    weekStartChanged,
    weeklyStreakReset: weekStartChanged,
    transitionWeek: weeklyChange?.transitionWeek ?? null,
  };
};
