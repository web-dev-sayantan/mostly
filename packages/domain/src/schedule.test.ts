import { describe, expect, it } from "vite-plus/test";

import {
  type ScheduleVersion,
  addDays,
  initialSchedule,
  isExpectedOn,
  isIsoDate,
  nextWeekStart,
  normalizeCadence,
  planScheduleChange,
  resolveSchedule,
  weekdayOf,
} from "./schedule";

const daily = initialSchedule("2026-10-01", { type: "daily" });
const weekdays = initialSchedule("2026-10-01", {
  type: "weekdays",
  weekdays: [1, 3, 5],
});
const weekly = initialSchedule("2026-10-01", {
  type: "weekly_target",
  target: 4,
});

describe("schedule dates", () => {
  it("uses UTC date math and ISO weekdays", () => {
    expect(weekdayOf("2026-10-19")).toBe(1);
    expect(weekdayOf("2026-10-20")).toBe(2);
    expect(weekdayOf("2026-10-25")).toBe(7);
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(nextWeekStart("2026-10-20")).toBe("2026-10-26");
    expect(nextWeekStart("2026-10-25")).toBe("2026-10-26");
    expect(nextWeekStart("2026-10-19")).toBe("2026-10-26");
  });

  it("accepts real dates only", () => {
    expect(isIsoDate("2026-10-20")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("20/10/2026")).toBe(false);
  });
});

describe("resolveSchedule", () => {
  it("returns the latest version in effect for a logical date", () => {
    const versions: ScheduleVersion[] = [
      daily,
      { effectiveFrom: "2026-10-21", cadence: { type: "weekly_target", target: 3 } },
    ];

    expect(resolveSchedule(versions, "2026-09-30")).toBeNull();
    expect(resolveSchedule(versions, "2026-10-01")).toEqual({ type: "daily" });
    expect(resolveSchedule(versions, "2026-10-20")).toEqual({ type: "daily" });
    expect(resolveSchedule(versions, "2026-10-21")).toEqual({ type: "weekly_target", target: 3 });
  });

  it("resolves daily, weekday, and weekly-target cadences", () => {
    expect(isExpectedOn({ type: "daily" }, "2026-10-20")).toBe(true);
    expect(isExpectedOn({ type: "weekdays", weekdays: [2, 4] }, "2026-10-20")).toBe(true);
    expect(isExpectedOn({ type: "weekdays", weekdays: [1, 3] }, "2026-10-20")).toBe(false);
    expect(isExpectedOn({ type: "weekly_target", target: 4 }, "2026-10-20")).toBe(false);
    expect(isExpectedOn(null, "2026-10-20")).toBe(false);
  });
});

describe("normalizeCadence", () => {
  it("normalizes all seven weekdays to daily", () => {
    expect(normalizeCadence({ type: "weekdays", weekdays: [1, 2, 3, 4, 5, 6, 7] })).toEqual({
      type: "daily",
    });
  });

  it("sorts and deduplicates weekdays", () => {
    expect(normalizeCadence({ type: "weekdays", weekdays: [5, 1, 5, 3] })).toEqual({
      type: "weekdays",
      weekdays: [1, 3, 5],
    });
  });
});

describe("planScheduleChange", () => {
  it("puts a future goal's initial version on its start date", () => {
    const plan = planScheduleChange({
      versions: [],
      today: "2026-10-20",
      cadence: { type: "daily" },
      startDate: "2026-10-25",
    });

    expect(plan).toEqual({
      current: [],
      pending: { effectiveFrom: "2026-10-25", cadence: { type: "daily" } },
    });
  });

  it("makes daily to weekday changes effective tomorrow", () => {
    const plan = planScheduleChange({
      versions: [daily],
      today: "2026-10-20",
      cadence: { type: "weekdays", weekdays: [2, 4] },
      startDate: "2026-10-01",
    });

    expect(plan.current).toEqual([daily]);
    expect(plan.pending).toEqual({
      effectiveFrom: "2026-10-21",
      cadence: { type: "weekdays", weekdays: [2, 4] },
    });
  });

  it("makes weekday to daily changes effective tomorrow", () => {
    const plan = planScheduleChange({
      versions: [weekdays],
      today: "2026-10-20",
      cadence: { type: "daily" },
      startDate: "2026-10-01",
    });

    expect(plan.pending).toEqual({ effectiveFrom: "2026-10-21", cadence: { type: "daily" } });
  });

  it("makes any weekly-target change effective next week", () => {
    const toWeekly = planScheduleChange({
      versions: [daily],
      today: "2026-10-20",
      cadence: { type: "weekly_target", target: 3 },
      startDate: "2026-10-01",
    });
    const targetChange = planScheduleChange({
      versions: [weekly],
      today: "2026-10-20",
      cadence: { type: "weekly_target", target: 6 },
      startDate: "2026-10-01",
    });
    const toDaily = planScheduleChange({
      versions: [weekly],
      today: "2026-10-20",
      cadence: { type: "daily" },
      startDate: "2026-10-01",
    });

    expect(toWeekly.pending?.effectiveFrom).toBe("2026-10-26");
    expect(targetChange.pending?.effectiveFrom).toBe("2026-10-26");
    expect(toDaily.pending?.effectiveFrom).toBe("2026-10-26");
  });

  it("replaces a pending version instead of stacking a second one", () => {
    const pending: ScheduleVersion = {
      effectiveFrom: "2026-10-26",
      cadence: { type: "weekly_target", target: 3 },
    };
    const plan = planScheduleChange({
      versions: [daily, pending],
      today: "2026-10-20",
      cadence: { type: "weekly_target", target: 5 },
      startDate: "2026-10-01",
    });

    expect(plan.current).toEqual([daily]);
    expect(plan.pending).toEqual({
      effectiveFrom: "2026-10-26",
      cadence: { type: "weekly_target", target: 5 },
    });
  });

  it("drops a pending version when the cadence returns to the current one", () => {
    const pending: ScheduleVersion = {
      effectiveFrom: "2026-10-21",
      cadence: { type: "weekdays", weekdays: [2, 4] },
    };
    const plan = planScheduleChange({
      versions: [daily, pending],
      today: "2026-10-20",
      cadence: { type: "daily" },
      startDate: "2026-10-01",
    });

    expect(plan).toEqual({ current: [daily], pending: null });
  });

  it("leaves past versions intact", () => {
    const older: ScheduleVersion = {
      effectiveFrom: "2026-09-01",
      cadence: { type: "weekdays", weekdays: [1, 2] },
    };
    const plan = planScheduleChange({
      versions: [older, daily],
      today: "2026-10-20",
      cadence: { type: "weekdays", weekdays: [6] },
      startDate: "2026-09-01",
    });

    expect(plan.current).toEqual([older, daily]);
  });

  it("respects a Sunday week start", () => {
    const plan = planScheduleChange({
      versions: [daily],
      today: "2026-10-20",
      cadence: { type: "weekly_target", target: 2 },
      startDate: "2026-10-01",
      weekStartsOn: 7,
    });

    expect(plan.pending?.effectiveFrom).toBe("2026-10-25");
  });
});
