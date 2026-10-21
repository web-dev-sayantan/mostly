import { addLogicalDays, weekStartOf } from "./logical-day";

export interface SettingValues {
  timeZone: string;
  /** 1 = Monday … 7 = Sunday. */
  weekStartsOn: number;
  /** 0–6, the local hour that closes the previous logical day. */
  dayRolloverHour: number;
}

export interface SettingVersion extends SettingValues {
  effectiveFrom: string;
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

/**
 * The version in effect on a logical date. Dates before the first version keep the first one,
 * so a new user's history never resolves to nothing. Ties prefer the later list entry.
 */
export const settingsForDate = <Version extends SettingVersion>(
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
