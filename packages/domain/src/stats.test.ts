import { describe, expect, it } from "vite-plus/test";

import type { Cadence, ScheduleVersion } from "./schedule";
import { goalStats, overallConsistency } from "./stats";

const version = (effectiveFrom: string, cadence: Cadence): ScheduleVersion => ({
  effectiveFrom,
  cadence,
});

const daily = (startDate: string) => version(startDate, { type: "daily" });

const sessions = (...logicalDates: string[]) =>
  logicalDates.map((logicalDate) => ({ logicalDate }));

const settings = (weekStartsOn = 1) => [
  { effectiveFrom: "2020-01-01", weekStartsOn },
];

const statsFor = ({
  startDate,
  today,
  durations = sessions(),
  versions = [daily(startDate)],
  archivedOn = null,
  weekStartsOn = 1,
  settingVersions,
  skippedDates = [],
}: {
  startDate: string;
  today: string;
  durations?: {
    logicalDate: string;
    minutes?: number | null;
    mood?: "great" | "meh" | "rough" | null;
    note?: string | null;
  }[];
  versions?: ScheduleVersion[];
  archivedOn?: string | null;
  weekStartsOn?: number;
  settingVersions?: { effectiveFrom: string; weekStartsOn: number }[];
  skippedDates?: string[];
}) =>
  goalStats({
    goal: { startDate, archivedOn, scheduleVersions: versions },
    sessions: durations,
    settings: settingVersions ?? settings(weekStartsOn),
    today,
    skippedDates,
  });

describe("goalStats daily consistency", () => {
  it("counts only completed expected days and shows a percentage at seven units", () => {
    const stats = statsFor({
      startDate: "2026-01-01",
      today: "2026-01-10",
      durations: sessions(
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-04",
        "2026-01-05"
      ),
    });

    expect(stats.consistency).toEqual({
      done: 5,
      expected: 9,
      percent: 56,
      qualified: true,
    });
    expect(stats.sessions).toBe(5);
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(5);
  });

  it("does not include the open day in consistency, but counts it in the streak when done", () => {
    const stats = statsFor({
      startDate: "2026-01-01",
      today: "2026-01-10",
      durations: sessions(
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-04",
        "2026-01-05",
        "2026-01-06",
        "2026-01-07",
        "2026-01-08",
        "2026-01-09",
        "2026-01-10"
      ),
    });

    expect(stats.consistency).toEqual({
      done: 9,
      expected: 9,
      percent: 100,
      qualified: true,
    });
    expect(stats.currentStreak).toBe(10);
    expect(stats.bestStreak).toBe(10);
  });

  it("shows the streak through yesterday when today is expected and not done", () => {
    const stats = statsFor({
      startDate: "2026-01-01",
      today: "2026-01-10",
      durations: sessions("2026-01-07", "2026-01-08", "2026-01-09"),
    });

    expect(stats.currentStreak).toBe(3);
  });

  it("shows a fraction and no percentage below seven expected units", () => {
    const stats = statsFor({
      startDate: "2026-01-05",
      today: "2026-01-11",
      durations: sessions("2026-01-05", "2026-01-06", "2026-01-07"),
    });

    expect(stats.consistency).toEqual({
      done: 3,
      expected: 6,
      percent: null,
      qualified: false,
    });
  });

  it("shows no expected units as just started", () => {
    const stats = statsFor({ startDate: "2026-01-10", today: "2026-01-10" });

    expect(stats.consistency).toEqual({
      done: 0,
      expected: 0,
      percent: null,
      qualified: false,
    });
  });

  it("excludes a date the timezone jump skipped from expectations and sessions", () => {
    const stats = statsFor({
      startDate: "2026-01-01",
      today: "2026-01-10",
      skippedDates: ["2026-01-05"],
      durations: sessions(
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-04",
        "2026-01-05"
      ),
    });

    expect(stats.consistency).toEqual({
      done: 4,
      expected: 8,
      percent: 50,
      qualified: true,
    });
    expect(stats.sessions).toBe(4);
    expect(stats.bestStreak).toBe(4);
    expect(stats.days.find((day) => day.date === "2026-01-05")).toMatchObject({
      expected: false,
      extra: false,
      status: "none",
    });
  });
});

describe("goalStats weekday goals", () => {
  it("omits unscheduled days from expectations, streaks, and consistency", () => {
    const stats = statsFor({
      startDate: "2026-01-05",
      today: "2026-01-13",
      versions: [
        version("2026-01-05", { type: "weekdays", weekdays: [1, 3, 5] }),
      ],
      durations: sessions(
        "2026-01-05",
        "2026-01-06",
        "2026-01-07",
        "2026-01-12"
      ),
    });

    // Expect Mon 5, Wed 7, Fri 9, Mon 12. Tue 6 is an extra.
    expect(stats.consistency).toEqual({
      done: 3,
      expected: 4,
      percent: null,
      qualified: false,
    });
    expect(stats.sessions).toBe(4);
    expect(stats.currentStreak).toBe(1);
    expect(stats.bestStreak).toBe(2);
  });

  it("a missed expected weekday breaks the streak even across unscheduled days", () => {
    const stats = statsFor({
      startDate: "2026-01-05",
      today: "2026-01-10",
      versions: [
        version("2026-01-05", { type: "weekdays", weekdays: [1, 3, 5] }),
      ],
      durations: sessions("2026-01-05", "2026-01-09"),
    });

    // Wed 7 is a completed miss.
    expect(stats.currentStreak).toBe(1);
    expect(stats.bestStreak).toBe(1);
  });

  it("does not let an extra session on an unscheduled day extend the streak", () => {
    const stats = statsFor({
      startDate: "2026-01-05",
      today: "2026-01-13",
      versions: [
        version("2026-01-05", { type: "weekdays", weekdays: [1, 3, 5] }),
      ],
      durations: sessions(
        "2026-01-05",
        "2026-01-07",
        "2026-01-09",
        "2026-01-12",
        "2026-01-13"
      ),
    });

    // Tue 13 is an extra, not an expectation.
    expect(stats.currentStreak).toBe(4);
    expect(stats.consistency).toMatchObject({ done: 4, expected: 4 });
    expect(stats.sessions).toBe(5);
  });
});

const weekly = (startDate: string, target: number) =>
  version(startDate, { type: "weekly_target", target });

describe("goalStats weekly target outcomes", () => {
  it("scores met and missed completed weeks, skips unscored weeks, and leaves the current week in progress", () => {
    const stats = statsFor({
      startDate: "2026-01-05",
      today: "2026-02-02",
      versions: [weekly("2026-01-05", 3)],
      durations: sessions(
        "2026-01-05",
        "2026-01-06",
        "2026-01-07",
        "2026-01-12",
        "2026-01-13",
        "2026-01-19",
        "2026-01-20",
        "2026-01-21",
        "2026-01-26",
        "2026-01-27",
        "2026-01-28"
      ),
    });

    expect(stats.consistency).toEqual({
      done: 3,
      expected: 4,
      percent: 75,
      qualified: true,
    });
    expect(stats.currentStreak).toBe(2);
    expect(stats.bestStreak).toBe(2);
    expect(stats.sessions).toBe(11);
    expect(stats.weeks.map((week) => week.status)).toEqual([
      "met",
      "missed",
      "met",
      "met",
      "in_progress",
    ]);
    expect(stats.weeks.map((week) => week.target)).toEqual([3, 3, 3, 3, 3]);
    expect(stats.weeks.map((week) => week.sessions)).toEqual([3, 2, 3, 3, 0]);
  });

  it("does not score a week with fewer active days than the target", () => {
    const stats = statsFor({
      startDate: "2026-01-10",
      today: "2026-02-02",
      versions: [weekly("2026-01-10", 4)],
      durations: sessions(
        "2026-01-12",
        "2026-01-13",
        "2026-01-14",
        "2026-01-15",
        "2026-01-19",
        "2026-01-20",
        "2026-01-21",
        "2026-01-22",
        "2026-01-26",
        "2026-01-27",
        "2026-01-28",
        "2026-01-29"
      ),
    });

    expect(stats.weeks.map((week) => week.status)).toEqual([
      "not_scored",
      "met",
      "met",
      "met",
      "in_progress",
    ]);
    expect(stats.consistency).toEqual({
      done: 3,
      expected: 3,
      percent: 100,
      qualified: true,
    });
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
  });

  it("leaves a skipped date out of weekly active days", () => {
    const stats = statsFor({
      startDate: "2026-10-05",
      today: "2026-10-11",
      versions: [weekly("2026-10-05", 7)],
      skippedDates: ["2026-10-08"],
      durations: sessions("2026-10-05", "2026-10-08"),
    });

    expect(stats.weeks[0]).toMatchObject({
      activeDays: 6,
      sessions: 1,
      status: "not_scored",
    });
  });

  it("counts a current week that is already met toward the streak but not consistency", () => {
    const stats = statsFor({
      startDate: "2026-01-05",
      today: "2026-01-21",
      versions: [weekly("2026-01-05", 2)],
      durations: sessions(
        "2026-01-05",
        "2026-01-06",
        "2026-01-12",
        "2026-01-13",
        "2026-01-19",
        "2026-01-20"
      ),
    });

    expect(stats.consistency).toEqual({
      done: 2,
      expected: 2,
      percent: null,
      qualified: false,
    });
    expect(stats.weeks.at(-1)).toMatchObject({
      status: "met",
      completed: false,
      sessions: 2,
    });
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
  });

  it("does not break the streak for a current week that is not met", () => {
    const stats = statsFor({
      startDate: "2026-01-05",
      today: "2026-01-21",
      versions: [weekly("2026-01-05", 2)],
      durations: sessions(
        "2026-01-05",
        "2026-01-06",
        "2026-01-12",
        "2026-01-13",
        "2026-01-19"
      ),
    });

    expect(stats.weeks.at(-1)?.status).toBe("in_progress");
    expect(stats.currentStreak).toBe(2);
    expect(stats.bestStreak).toBe(2);
  });

  it("recomputes a completed week when a backfilled session reaches the target", () => {
    const missed = statsFor({
      startDate: "2026-01-05",
      today: "2026-01-13",
      versions: [weekly("2026-01-05", 3)],
      durations: sessions("2026-01-05", "2026-01-06"),
    });
    const met = statsFor({
      startDate: "2026-01-05",
      today: "2026-01-13",
      versions: [weekly("2026-01-05", 3)],
      durations: sessions("2026-01-05", "2026-01-06", "2026-01-07"),
    });

    expect(missed.weeks[0]?.status).toBe("missed");
    expect(missed.consistency).toMatchObject({ done: 0, expected: 1 });
    expect(met.weeks[0]?.status).toBe("met");
    expect(met.consistency).toMatchObject({ done: 1, expected: 1 });
  });

  it("applies a target change per week without resetting the era", () => {
    const stats = statsFor({
      startDate: "2026-01-05",
      today: "2026-01-26",
      versions: [weekly("2026-01-05", 2), weekly("2026-01-19", 3)],
      durations: sessions(
        "2026-01-05",
        "2026-01-06",
        "2026-01-12",
        "2026-01-13",
        "2026-01-19",
        "2026-01-20",
        "2026-01-21"
      ),
    });

    expect(stats.eras).toHaveLength(1);
    expect(stats.weeks.map((week) => [week.target, week.status])).toEqual([
      [2, "met"],
      [2, "met"],
      [3, "met"],
      [3, "in_progress"],
    ]);
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
  });
});

describe("goalStats streak eras", () => {
  it("starts a new weekly era when the week start changes", () => {
    const stats = statsFor({
      startDate: "2026-01-05",
      today: "2026-02-02",
      versions: [weekly("2026-01-05", 2)],
      settingVersions: [
        { effectiveFrom: "2020-01-01", weekStartsOn: 1 },
        { effectiveFrom: "2026-01-18", weekStartsOn: 7 },
      ],
      durations: sessions(
        "2026-01-05",
        "2026-01-06",
        "2026-01-12",
        "2026-01-13",
        "2026-01-18",
        "2026-01-19",
        "2026-01-25",
        "2026-01-26"
      ),
    });

    expect(stats.eras).toEqual([
      {
        startDate: "2026-01-05",
        endDate: "2026-01-17",
        unit: "week",
        bestStreak: 1,
      },
      {
        startDate: "2026-01-18",
        endDate: "2026-02-02",
        unit: "week",
        bestStreak: 2,
      },
    ]);
    expect(stats.currentStreak).toBe(2);
    expect(stats.bestStreak).toBe(2);
    expect(stats.consistency).toEqual({
      done: 3,
      expected: 3,
      percent: 100,
      qualified: true,
    });
    expect(stats.weeks.map((week) => week.start)).toEqual([
      "2026-01-18",
      "2026-01-25",
      "2026-02-01",
    ]);
  });

  it("keeps the Sunday to Monday transition block out of weekly scoring", () => {
    const stats = statsFor({
      startDate: "2026-10-04",
      today: "2026-11-02",
      versions: [weekly("2026-10-04", 2)],
      settingVersions: [
        { effectiveFrom: "2020-01-01", weekStartsOn: 7 },
        { effectiveFrom: "2026-10-26", weekStartsOn: 1 },
      ],
      durations: sessions(
        "2026-10-20",
        "2026-10-25",
        "2026-10-31",
        "2026-11-01",
        "2026-11-02"
      ),
    });

    expect(stats.eras).toEqual([
      {
        startDate: "2026-10-04",
        endDate: "2026-10-25",
        unit: "week",
        bestStreak: 0,
      },
      {
        startDate: "2026-10-26",
        endDate: "2026-11-02",
        unit: "week",
        bestStreak: 1,
      },
    ]);
    expect(stats.consistency).toEqual({
      done: 1,
      expected: 3,
      percent: 33,
      qualified: true,
    });
    expect(
      stats.weeks.map((week) => [week.start, week.end, week.status])
    ).toEqual([
      ["2026-10-26", "2026-11-01", "met"],
      ["2026-11-02", "2026-11-02", "in_progress"],
    ]);
  });

  it("resets the current streak on a unit change and keeps per-era bests", () => {
    const stats = statsFor({
      startDate: "2026-01-01",
      today: "2026-02-02",
      versions: [daily("2026-01-01"), weekly("2026-01-12", 2)],
      durations: sessions(
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-04",
        "2026-01-05",
        "2026-01-12",
        "2026-01-13",
        "2026-01-19",
        "2026-01-20",
        "2026-01-26",
        "2026-01-27"
      ),
    });

    expect(stats.eras.map((era) => [era.unit, era.bestStreak])).toEqual([
      ["day", 5],
      ["week", 3],
    ]);
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
    expect(stats.consistency).toEqual({
      done: 3,
      expected: 3,
      percent: 100,
      qualified: true,
    });
  });

  it("keeps one daily era across a weekday change", () => {
    const stats = statsFor({
      startDate: "2026-01-01",
      today: "2026-01-13",
      versions: [
        daily("2026-01-01"),
        version("2026-01-05", { type: "weekdays", weekdays: [1, 3, 5] }),
      ],
      durations: sessions(
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-04",
        "2026-01-05",
        "2026-01-07",
        "2026-01-09",
        "2026-01-12"
      ),
    });

    expect(stats.eras).toHaveLength(1);
    expect(stats.currentStreak).toBe(8);
    expect(stats.bestStreak).toBe(8);
    expect(stats.consistency).toEqual({
      done: 8,
      expected: 8,
      percent: 100,
      qualified: true,
    });
  });
});

describe("goalStats archive boundaries", () => {
  it("caps daily expectations on the archive day and ignores later sessions", () => {
    const stats = statsFor({
      startDate: "2026-01-01",
      today: "2026-01-20",
      archivedOn: "2026-01-10",
      durations: sessions(
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-04",
        "2026-01-05",
        "2026-01-06",
        "2026-01-07",
        "2026-01-08",
        "2026-01-09",
        "2026-01-10",
        "2026-01-12"
      ),
    });

    expect(stats.archived).toBe(true);
    expect(stats.historyEnd).toBe("2026-01-10");
    expect(stats.consistency).toEqual({
      done: 10,
      expected: 10,
      percent: 100,
      qualified: true,
    });
    expect(stats.sessions).toBe(10);
    expect(stats.currentStreak).toBeNull();
    expect(stats.bestStreak).toBe(10);
    expect(stats.eras.at(-1)?.endDate).toBe("2026-01-10");
  });

  it("keeps the archive day open and countable on the day it is archived", () => {
    const open = statsFor({
      startDate: "2026-01-01",
      today: "2026-01-10",
      archivedOn: "2026-01-10",
      durations: sessions(
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-04",
        "2026-01-05",
        "2026-01-06",
        "2026-01-07",
        "2026-01-08",
        "2026-01-09"
      ),
    });

    expect(open.archived).toBe(false);
    expect(open.consistency).toEqual({
      done: 9,
      expected: 9,
      percent: 100,
      qualified: true,
    });
    expect(open.currentStreak).toBe(9);
    expect(open.bestStreak).toBe(9);
  });

  it("scores a weekly week that met its target before archiving mid-week", () => {
    const stats = statsFor({
      startDate: "2026-01-05",
      today: "2026-01-20",
      archivedOn: "2026-01-08",
      versions: [weekly("2026-01-05", 3)],
      durations: sessions("2026-01-05", "2026-01-06", "2026-01-07"),
    });

    expect(stats.weeks).toEqual([
      {
        start: "2026-01-05",
        end: "2026-01-08",
        target: 3,
        sessions: 3,
        activeDays: 4,
        completed: true,
        status: "met",
      },
    ]);
    expect(stats.consistency).toEqual({
      done: 1,
      expected: 1,
      percent: null,
      qualified: false,
    });
  });

  it("leaves a week not scored when archiving leaves too few active days", () => {
    const stats = statsFor({
      startDate: "2026-01-05",
      today: "2026-01-20",
      archivedOn: "2026-01-07",
      versions: [weekly("2026-01-05", 4)],
      durations: sessions("2026-01-05", "2026-01-06"),
    });

    expect(stats.weeks[0]).toMatchObject({
      activeDays: 3,
      status: "not_scored",
    });
    expect(stats.consistency).toEqual({
      done: 0,
      expected: 0,
      percent: null,
      qualified: false,
    });
  });
});

describe("goalStats minutes and overall consistency", () => {
  it("sums minutes and reports coverage once three sessions have a duration", () => {
    const stats = statsFor({
      startDate: "2026-01-01",
      today: "2026-01-06",
      durations: [
        { logicalDate: "2026-01-01", minutes: 30 },
        { logicalDate: "2026-01-02", minutes: 20 },
        { logicalDate: "2026-01-03", minutes: 0 },
        { logicalDate: "2026-01-04", minutes: null },
        { logicalDate: "2026-01-05", minutes: 10 },
      ],
    });

    expect(stats.minutes).toEqual({
      total: 60,
      average: 20,
      withMinutes: 3,
      sessions: 5,
    });
  });

  it("hides the average below three sessions with minutes", () => {
    const stats = statsFor({
      startDate: "2026-01-01",
      today: "2026-01-04",
      durations: [
        { logicalDate: "2026-01-01", minutes: 30 },
        { logicalDate: "2026-01-02", minutes: 20 },
        { logicalDate: "2026-01-03", minutes: 0 },
      ],
    });

    expect(stats.minutes).toEqual({
      total: 50,
      average: null,
      withMinutes: 2,
      sessions: 3,
    });
  });

  it("averages qualifying goals with equal weight and counts the active set", () => {
    const today = "2026-01-08";
    const hundred = statsFor({
      startDate: "2026-01-01",
      today,
      durations: sessions(
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-04",
        "2026-01-05",
        "2026-01-06",
        "2026-01-07"
      ),
    });
    const fiftySeven = statsFor({
      startDate: "2026-01-01",
      today,
      durations: sessions(
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-04"
      ),
    });
    const fourteen = statsFor({
      startDate: "2026-01-01",
      today,
      durations: sessions("2026-01-01"),
    });
    const thinA = statsFor({ startDate: "2026-01-06", today });
    const thinB = statsFor({ startDate: "2026-01-07", today });

    expect(
      overallConsistency([hundred, fiftySeven, fourteen, thinA, thinB])
    ).toEqual({
      percent: 57,
      qualifying: 3,
      total: 5,
      notEnoughData: false,
    });
  });

  it("requires two qualifying goals", () => {
    const today = "2026-01-08";
    const hundred = statsFor({
      startDate: "2026-01-01",
      today,
      durations: sessions(
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-04",
        "2026-01-05",
        "2026-01-06",
        "2026-01-07"
      ),
    });
    const thin = statsFor({ startDate: "2026-01-07", today });

    expect(overallConsistency([hundred, thin])).toEqual({
      percent: null,
      qualifying: 1,
      total: 2,
      notEnoughData: true,
    });
  });
});

describe("goalStats heatmap data", () => {
  it("returns the last twelve weeks ending at the goal's history end", () => {
    const stats = statsFor({
      startDate: "2025-10-01",
      today: "2026-01-12",
      durations: [
        { logicalDate: "2026-01-10", minutes: 30, mood: "great", note: "Read" },
        { logicalDate: "2026-01-11" },
      ],
    });

    expect(stats.weekStartsOn).toBe(1);
    expect(stats.days[0]?.date).toBe("2025-10-27");
    expect(stats.days.at(-1)?.date).toBe("2026-01-12");
    expect(stats.days.find((day) => day.date === "2026-01-10")).toMatchObject({
      status: "done",
      expected: true,
      minutes: 30,
      mood: "great",
      note: "Read",
    });
    expect(stats.days.find((day) => day.date === "2026-01-09")?.status).toBe(
      "missed"
    );
    expect(stats.days.find((day) => day.date === "2026-01-12")?.status).toBe(
      "open"
    );
  });

  it("keeps a future-start goal out of stats and exposes its start date", () => {
    const stats = statsFor({
      startDate: "2026-02-01",
      today: "2026-01-20",
    });

    expect(stats.futureStart).toBe(true);
    expect(stats.startsOn).toBe("2026-02-01");
    expect(stats.days).toEqual([]);
    expect(stats.weeks).toEqual([]);
    expect(stats.sessions).toBe(0);
  });
});
