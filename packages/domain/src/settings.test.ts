import { describe, expect, it } from "vite-plus/test";

import { planSettingChange, settingsForDate } from "./settings";
import type { SettingVersion } from "./settings";

const versions: SettingVersion[] = [
  {
    effectiveFrom: "2026-10-25",
    timeZone: "Asia/Tokyo",
    weekStartsOn: 7,
    dayRolloverHour: 2,
  },
  {
    effectiveFrom: "2026-10-01",
    timeZone: "UTC",
    weekStartsOn: 1,
    dayRolloverHour: 4,
  },
];

const current: SettingVersion = {
  effectiveFrom: "2026-10-01",
  timeZone: "UTC",
  weekStartsOn: 1,
  dayRolloverHour: 4,
};

describe("settingsForDate", () => {
  it("returns the latest version effective on or before the date", () => {
    expect(settingsForDate(versions, "2026-10-24")).toMatchObject({
      effectiveFrom: "2026-10-01",
      timeZone: "UTC",
      weekStartsOn: 1,
      dayRolloverHour: 4,
    });
    expect(settingsForDate(versions, "2026-10-25")).toMatchObject({
      effectiveFrom: "2026-10-25",
      timeZone: "Asia/Tokyo",
      weekStartsOn: 7,
      dayRolloverHour: 2,
    });
    expect(settingsForDate(versions, "2027-01-01")).toMatchObject({
      timeZone: "Asia/Tokyo",
    });
  });

  it("keeps past dates on their old settings and falls back to the first version", () => {
    expect(settingsForDate(versions, "2026-10-20")).toMatchObject({
      timeZone: "UTC",
      weekStartsOn: 1,
    });
    expect(settingsForDate(versions, "2026-01-01")).toMatchObject({
      effectiveFrom: "2026-10-01",
      timeZone: "UTC",
    });
    expect(settingsForDate([], "2026-10-20")).toBeUndefined();
  });
});

describe("planSettingChange", () => {
  it("applies rollover and timezone changes at the next logical day", () => {
    const plan = planSettingChange(current, "2026-10-21", {
      timeZone: "Europe/Berlin",
      dayRolloverHour: 2,
    });

    expect(plan.versions).toEqual([
      {
        effectiveFrom: "2026-10-22",
        timeZone: "Europe/Berlin",
        weekStartsOn: 1,
        dayRolloverHour: 2,
      },
    ]);
    expect(plan).toMatchObject({
      timeZoneChanged: true,
      dayRolloverChanged: true,
      weekStartChanged: false,
      weeklyStreakReset: false,
      transitionWeek: null,
    });
  });

  it("applies a week-start change at the next week boundary and marks the transition week", () => {
    const plan = planSettingChange(current, "2026-10-21", { weekStartsOn: 7 });

    expect(plan.versions).toEqual([
      {
        effectiveFrom: "2026-10-25",
        timeZone: "UTC",
        weekStartsOn: 7,
        dayRolloverHour: 4,
      },
    ]);
    expect(plan).toMatchObject({
      weekStartChanged: true,
      weeklyStreakReset: true,
      transitionWeek: { start: "2026-10-19", end: "2026-10-24" },
    });
  });

  it("always takes at least the next week boundary, even on the new week-start day", () => {
    const mondayStart = { ...current, weekStartsOn: 1 };

    expect(
      planSettingChange(mondayStart, "2026-10-25", { weekStartsOn: 7 })
        .versions[0]?.effectiveFrom
    ).toBe("2026-11-01");
  });

  it("splits a combined change when the two effective dates differ", () => {
    const plan = planSettingChange(current, "2026-10-21", {
      weekStartsOn: 7,
      dayRolloverHour: 2,
    });

    expect(plan.versions).toEqual([
      {
        effectiveFrom: "2026-10-22",
        timeZone: "UTC",
        weekStartsOn: 1,
        dayRolloverHour: 2,
      },
      {
        effectiveFrom: "2026-10-25",
        timeZone: "UTC",
        weekStartsOn: 7,
        dayRolloverHour: 2,
      },
    ]);
    expect(plan.weeklyStreakReset).toBe(true);
  });

  it("writes one version when the next week boundary is already tomorrow", () => {
    const sundayStart = { ...current, weekStartsOn: 7 };

    expect(
      planSettingChange(sundayStart, "2026-10-25", {
        weekStartsOn: 1,
        dayRolloverHour: 2,
      }).versions
    ).toEqual([
      {
        effectiveFrom: "2026-10-26",
        timeZone: "UTC",
        weekStartsOn: 1,
        dayRolloverHour: 2,
      },
    ]);
  });

  it("writes nothing when the settings did not change", () => {
    expect(planSettingChange(current, "2026-10-21", {})).toMatchObject({
      versions: [],
      weekStartChanged: false,
      timeZoneChanged: false,
      dayRolloverChanged: false,
      weeklyStreakReset: false,
      transitionWeek: null,
    });
  });
});
