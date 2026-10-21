import { describe, expect, it } from "vite-plus/test";

import {
  planSettingChange,
  resolveSettingsForNow,
  settingsForDate,
  skippedDatesForTimeZoneChange,
} from "./settings";
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

describe("resolveSettingsForNow", () => {
  it("keeps the current day closed under the old rollover on a 4 to 6 transition", () => {
    const history: SettingVersion[] = [
      {
        effectiveFrom: "2026-10-01",
        timeZone: "UTC",
        weekStartsOn: 1,
        dayRolloverHour: 4,
      },
      {
        effectiveFrom: "2026-10-22",
        timeZone: "UTC",
        weekStartsOn: 1,
        dayRolloverHour: 6,
      },
    ];
    const hint = { timeZone: "UTC", rolloverHour: 4 };

    expect(
      resolveSettingsForNow(history, new Date("2026-10-22T03:30:00Z"), hint)
    ).toMatchObject({ today: "2026-10-21" });
    // 04:30 is past the old rollover: the new day opens under the old rule
    // and the 6 AM rollover applies from the following day.
    expect(
      resolveSettingsForNow(history, new Date("2026-10-22T04:30:00Z"), hint)
    ).toMatchObject({ today: "2026-10-22" });
    expect(
      resolveSettingsForNow(history, new Date("2026-10-22T05:30:00Z"), hint)
    ).toMatchObject({ today: "2026-10-22" });
    expect(
      resolveSettingsForNow(history, new Date("2026-10-23T04:30:00Z"), {
        timeZone: "UTC",
        rolloverHour: 6,
      })
    ).toMatchObject({ today: "2026-10-22" });
    expect(
      resolveSettingsForNow(history, new Date("2026-10-23T06:00:00Z"), {
        timeZone: "UTC",
        rolloverHour: 6,
      })
    ).toMatchObject({ today: "2026-10-23" });
  });

  it("does not let a stale cache reopen the transition day", () => {
    const history: SettingVersion[] = [
      {
        effectiveFrom: "2026-10-01",
        timeZone: "UTC",
        weekStartsOn: 1,
        dayRolloverHour: 4,
      },
      {
        effectiveFrom: "2026-10-22",
        timeZone: "UTC",
        weekStartsOn: 1,
        dayRolloverHour: 6,
      },
    ];

    expect(
      resolveSettingsForNow(history, new Date("2026-10-23T05:00:00Z"), {
        timeZone: "UTC",
        rolloverHour: 4,
      })
    ).toMatchObject({ today: "2026-10-22" });
  });

  it("does not open the effective day early on a 6 to 4 transition", () => {
    const history: SettingVersion[] = [
      {
        effectiveFrom: "2026-10-01",
        timeZone: "UTC",
        weekStartsOn: 1,
        dayRolloverHour: 6,
      },
      {
        effectiveFrom: "2026-10-02",
        timeZone: "UTC",
        weekStartsOn: 1,
        dayRolloverHour: 4,
      },
    ];

    expect(
      resolveSettingsForNow(history, new Date("2026-10-02T04:30:00Z"))
    ).toMatchObject({ today: "2026-10-01" });
    expect(
      resolveSettingsForNow(history, new Date("2026-10-02T06:00:00Z"))
    ).toMatchObject({ today: "2026-10-02" });
  });

  it("uses the new date after a timezone jump skips the effective day", () => {
    const history: SettingVersion[] = [
      {
        effectiveFrom: "2026-10-01",
        timeZone: "Pacific/Pago_Pago",
        weekStartsOn: 1,
        dayRolloverHour: 4,
      },
      {
        effectiveFrom: "2026-10-21",
        timeZone: "Pacific/Kiritimati",
        weekStartsOn: 1,
        dayRolloverHour: 4,
        skippedDates: ["2026-10-21"],
      },
    ];

    expect(
      resolveSettingsForNow(history, new Date("2026-10-21T15:30:00Z"))
    ).toMatchObject({ today: "2026-10-22" });
  });

  it("does not move backward when a timezone jump repeats days", () => {
    const history: SettingVersion[] = [
      {
        effectiveFrom: "2026-10-01",
        timeZone: "Pacific/Kiritimati",
        weekStartsOn: 1,
        dayRolloverHour: 4,
      },
      {
        effectiveFrom: "2026-10-21",
        timeZone: "Pacific/Pago_Pago",
        weekStartsOn: 1,
        dayRolloverHour: 4,
      },
    ];

    expect(
      resolveSettingsForNow(history, new Date("2026-10-21T14:00:00Z"))
    ).toMatchObject({ today: "2026-10-21" });
  });
});

describe("skippedDatesForTimeZoneChange", () => {
  it("records the date a dateline jump forward never produces", () => {
    const dates = skippedDatesForTimeZoneChange({
      today: "2026-10-20",
      now: new Date("2026-10-21T00:00:00Z"),
      current: { timeZone: "Pacific/Pago_Pago", rolloverHour: 4 },
      next: { timeZone: "Pacific/Kiritimati", rolloverHour: 4 },
    });

    expect(dates).toEqual(["2026-10-21"]);
  });

  it("does not skip a date when the change repeats a local day", () => {
    const dates = skippedDatesForTimeZoneChange({
      today: "2026-10-22",
      now: new Date("2026-10-22T00:00:00Z"),
      current: { timeZone: "Pacific/Kiritimati", rolloverHour: 4 },
      next: { timeZone: "Pacific/Pago_Pago", rolloverHour: 4 },
    });

    expect(dates).toEqual([]);
  });

  it("starts from the resolved today instead of recomputing it", () => {
    const dates = skippedDatesForTimeZoneChange({
      today: "2026-10-22",
      now: new Date("2026-10-23T05:00:00Z"),
      current: { timeZone: "UTC", rolloverHour: 4 },
      next: { timeZone: "Pacific/Kiritimati", rolloverHour: 4 },
    });

    expect(dates).toEqual(["2026-10-23"]);
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
