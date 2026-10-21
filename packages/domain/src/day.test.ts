import { describe, expect, it } from "vite-plus/test";

import type { DayGoal, DaySession } from "./day";
import {
  isDayEditable,
  isGoalActiveOn,
  resolveDay,
  summarizeWeek,
  weeklyOutcome,
} from "./day";
import { addLogicalDays, logicalDate } from "./logical-day";
import { buildProgress } from "./progress";
import type { ScheduleVersion } from "./schedule";

const versions = (
  ...entries: [effectiveFrom: string, cadence: ScheduleVersion["cadence"]][]
): ScheduleVersion[] =>
  entries.map(([effectiveFrom, cadence]) => ({ effectiveFrom, cadence }));

const goal = (overrides: Partial<DayGoal> = {}): DayGoal => ({
  id: "reading",
  startDate: "2026-10-01",
  archivedOn: null,
  scheduleVersions: versions(["2026-10-01", { type: "daily" }]),
  ...overrides,
});

const session = (
  goalId: string,
  onDate: string,
  overrides: Partial<DaySession> = {}
): DaySession => ({
  id: `${goalId}:${onDate}`,
  goalId,
  logicalDate: onDate,
  minutes: 20,
  note: null,
  mood: null,
  ...overrides,
});

const resolve = ({
  date,
  today = "2026-10-20",
  goals,
  sessions = [],
  weekStartsOn = 1,
  weekStartHistory,
  skippedDates,
}: {
  date: string;
  today?: string;
  goals: DayGoal[];
  sessions?: DaySession[];
  weekStartsOn?: number;
  weekStartHistory?: { effectiveFrom: string; weekStartsOn: number }[];
  skippedDates?: string[];
}) =>
  resolveDay({
    date,
    today,
    goals,
    sessions,
    weekStartsOn,
    weekStartHistory,
    skippedDates,
  });

describe("isGoalActiveOn", () => {
  it("includes the start and archive days and excludes the days outside", () => {
    const archived = goal({ archivedOn: "2026-10-18" });

    expect(isGoalActiveOn(goal(), "2026-09-30")).toBe(false);
    expect(isGoalActiveOn(goal(), "2026-10-01")).toBe(true);
    expect(isGoalActiveOn(archived, "2026-10-18")).toBe(true);
    expect(isGoalActiveOn(archived, "2026-10-19")).toBe(false);
  });
});

describe("isDayEditable", () => {
  const today = "2026-10-20";

  it("locks the last seven logical days, today included, and blocks the future", () => {
    expect(isDayEditable(goal(), "2026-10-20", today)).toBe(true);
    expect(isDayEditable(goal(), "2026-10-14", today)).toBe(true);
    expect(isDayEditable(goal(), "2026-10-13", today)).toBe(false);
    expect(isDayEditable(goal(), "2026-10-21", today)).toBe(false);
  });

  it("keeps archived history read-only from the day after archiving", () => {
    const archived = goal({ archivedOn: "2026-10-18" });

    expect(isDayEditable(archived, "2026-10-18", today)).toBe(false);
    expect(isDayEditable(archived, "2026-10-18", "2026-10-18")).toBe(true);
    expect(isDayEditable(archived, "2026-10-18", "2026-10-19")).toBe(false);
  });

  it("blocks days before the goal started", () => {
    expect(isDayEditable(goal(), "2026-09-30", "2026-10-01")).toBe(false);
  });
});

describe("resolveDay", () => {
  const daily = goal();
  const weekdays = goal({
    id: "guitar",
    scheduleVersions: versions([
      "2026-10-01",
      { type: "weekdays", weekdays: [1, 3, 5] },
    ]),
  });
  const weekly = goal({
    id: "singing",
    scheduleVersions: versions([
      "2026-10-01",
      { type: "weekly_target", target: 3 },
    ]),
  });

  it("moves an unmarked expected day from no session to missed at rollover", () => {
    const before = logicalDate(new Date("2026-10-20T03:59:00Z"), {
      timeZone: "UTC",
      rolloverHour: 4,
    });
    const after = logicalDate(new Date("2026-10-20T04:00:00Z"), {
      timeZone: "UTC",
      rolloverHour: 4,
    });

    expect(before).toBe("2026-10-19");
    expect(after).toBe("2026-10-20");
    expect(
      resolve({ date: before, today: before, goals: [daily] }).expectations
    ).toEqual([expect.objectContaining({ status: "no_session" })]);
    expect(
      resolve({ date: before, today: after, goals: [daily] }).expectations
    ).toEqual([expect.objectContaining({ status: "missed" })]);
  });

  it("lists every daily and weekday expectation and leaves weekly targets out", () => {
    const result = resolve({
      date: "2026-10-20",
      goals: [daily, weekdays, weekly],
    });

    expect(result.expectations.map((entry) => entry.goal.id)).toEqual([
      "reading",
    ]);
    expect(result.expectations[0]).toMatchObject({
      status: "no_session",
      session: null,
    });
    expect(result.weekly.map((entry) => entry.goal.id)).toEqual(["singing"]);
    expect(result.weekly[0]).toMatchObject({
      target: 3,
      sessions: 0,
      status: "in_progress",
    });
  });

  it("marks weekly target goals done only through sessions, never a daily miss", () => {
    const result = resolve({
      date: "2026-10-20",
      goals: [weekly],
      sessions: [session("singing", "2026-10-20")],
    });

    expect(result.expectations).toEqual([]);
    expect(result.extras).toEqual([]);
    expect(result.weekly[0]).toMatchObject({
      sessions: 1,
      status: "in_progress",
      session: expect.objectContaining({ minutes: 20 }),
    });
  });

  it("includes an archived goal on the archive day and drops it the next day", () => {
    const archived = goal({ archivedOn: "2026-10-18" });

    expect(
      resolve({ date: "2026-10-18", goals: [archived] }).expectations
    ).toHaveLength(1);
    expect(
      resolve({ date: "2026-10-19", goals: [archived] }).expectations
    ).toHaveLength(0);
    expect(resolve({ date: "2026-10-18", goals: [archived] }).readOnly).toBe(
      false
    );
    expect(
      resolve({ date: "2026-10-18", goals: [archived] }).expectations[0]
    ).toMatchObject({ status: "missed", goal: { archivedOn: "2026-10-18" } });
  });

  it("derives 14 misses across a vacation gap and records the return", () => {
    const sessions = [
      session("reading", "2026-10-05"),
      session("reading", "2026-10-20"),
    ];
    const dates = Array.from({ length: 14 }, (_, index) =>
      addLogicalDays("2026-10-06", index)
    );

    const missed = dates.map(
      (date) =>
        resolve({ date, goals: [daily], sessions }).expectations[0]?.status
    );

    expect(missed).toEqual(Array.from({ length: 14 }, () => "missed"));
    expect(
      resolve({ date: "2026-10-20", goals: [daily], sessions }).expectations[0]
        ?.status
    ).toBe("done");
  });

  it("treats an unscheduled day session as an extra without an expectation", () => {
    const offDay = session("guitar", "2026-10-20");
    const result = resolve({
      date: "2026-10-20",
      goals: [weekdays],
      sessions: [offDay],
    });

    expect(result.expectations).toEqual([]);
    expect(result.extras).toEqual([{ goal: weekdays, session: offDay }]);
    expect(result.candidates).toEqual([]);

    const unlogged = resolve({ date: "2026-10-20", goals: [weekdays] });
    expect(unlogged.candidates).toEqual([weekdays]);
    expect(unlogged.weekly).toEqual([]);
  });

  it("does not offer a candidate before the start date, after archive, or outside the window", () => {
    const future = goal({ id: "future", startDate: "2026-10-21" });
    const archived = goal({ id: "archived", archivedOn: "2026-10-18" });
    const weekdaysArchived = goal({
      id: "old-guitar",
      archivedOn: "2026-10-18",
      scheduleVersions: versions([
        "2026-10-01",
        { type: "weekdays", weekdays: [1, 3, 5] },
      ]),
    });

    expect(
      resolve({
        date: "2026-10-20",
        goals: [future, archived, weekdaysArchived],
      }).candidates
    ).toEqual([]);
  });

  it("skips a date the timezone jump never produced", () => {
    const result = resolveDay({
      date: "2026-10-21",
      today: "2026-10-22",
      weekStartsOn: 1,
      goals: [daily, weekly],
      sessions: [session("reading", "2026-10-21")],
      skippedDates: ["2026-10-21"],
    });

    expect(result).toMatchObject({
      skipped: true,
      readOnly: true,
      expectations: [],
      extras: [],
      weekly: [],
      candidates: [],
    });
  });

  it("summarises a weekly target with a Sunday week start", () => {
    const result = resolve({
      date: "2026-10-20",
      goals: [weekly],
      weekStartsOn: 7,
    });

    expect(result.weekly[0]).toMatchObject({
      weekStart: "2026-10-18",
      weekEnd: "2026-10-24",
    });
  });

  it("uses the Sunday to Monday transition block for weekly detail", () => {
    const weekStartHistory = [
      { effectiveFrom: "2020-01-01", weekStartsOn: 7 },
      { effectiveFrom: "2026-10-26", weekStartsOn: 1 },
    ];
    const result = resolve({
      date: "2026-10-20",
      goals: [weekly],
      sessions: [session("singing", "2026-10-20")],
      weekStartHistory,
    });

    expect(result.weekly[0]).toMatchObject({
      weekStart: "2026-10-18",
      weekEnd: "2026-10-25",
      sessions: 1,
      activeDays: 8,
      status: "not_scored",
    });
    const progress = buildProgress({
      goals: [
        {
          ...weekly,
          name: "Singing",
          emoji: null,
          color: null,
          priority: "medium",
        },
      ],
      sessions: [{ goalId: "singing", logicalDate: "2026-10-20" }],
      settings: weekStartHistory,
      today: "2026-10-20",
      range: 7,
    });
    expect(
      progress.weekly[0]?.weeks.find(
        (week) => week.weekStart === result.weekly[0]?.weekStart
      )
    ).toMatchObject({
      weekStart: "2026-10-18",
      weekEnd: "2026-10-25",
      status: "not_scored",
    });
  });

  it("keeps the Monday to Sunday transition block not scored", () => {
    const result = resolve({
      date: "2026-10-20",
      goals: [weekly],
      sessions: [
        session("singing", "2026-10-19"),
        session("singing", "2026-10-24"),
      ],
      weekStartHistory: [
        { effectiveFrom: "2020-01-01", weekStartsOn: 1 },
        { effectiveFrom: "2026-10-25", weekStartsOn: 7 },
      ],
    });

    expect(result.weekly[0]).toMatchObject({
      weekStart: "2026-10-19",
      weekEnd: "2026-10-24",
      sessions: 2,
      activeDays: 6,
      status: "not_scored",
    });
  });

  it("leaves a skipped date out of weekly active days", () => {
    const seven = goal({
      id: "seven",
      startDate: "2026-10-01",
      scheduleVersions: versions([
        "2026-10-01",
        { type: "weekly_target", target: 7 },
      ]),
    });
    const result = resolve({
      date: "2026-10-20",
      today: "2026-10-27",
      goals: [seven],
      sessions: [session("seven", "2026-10-21")],
      skippedDates: ["2026-10-21"],
    });

    expect(result.weekly[0]).toMatchObject({
      sessions: 0,
      activeDays: 6,
      target: 7,
      status: "not_scored",
    });
  });
});

describe("weekly outcome", () => {
  const weekly = goal({
    id: "singing",
    startDate: "2026-10-01",
    scheduleVersions: versions([
      "2026-10-01",
      { type: "weekly_target", target: 3 },
    ]),
  });

  it("is met when the target is reached, even early in the week", () => {
    const sessions = ["2026-10-19", "2026-10-20", "2026-10-21"].map((date) =>
      session("singing", date)
    );
    const summary = summarizeWeek({
      goal: weekly,
      sessions,
      date: "2026-10-21",
      today: "2026-10-21",
      weekStartsOn: 1,
    });

    expect(summary).toMatchObject({
      sessions: 3,
      target: 3,
      activeDays: 7,
      status: "met",
    });
  });

  it("is missed only after the week's last logical day", () => {
    const sessions = ["2026-10-19", "2026-10-20"].map((date) =>
      session("singing", date)
    );
    const inWeek = summarizeWeek({
      goal: weekly,
      sessions,
      date: "2026-10-20",
      today: "2026-10-25",
      weekStartsOn: 1,
    });
    const closed = summarizeWeek({
      goal: weekly,
      sessions,
      date: "2026-10-20",
      today: "2026-10-26",
      weekStartsOn: 1,
    });

    expect(inWeek?.status).toBe("in_progress");
    expect(closed?.status).toBe("missed");
  });

  it("is not scored when the goal had fewer active days than the target", () => {
    const lateStart = goal({
      id: "singing",
      startDate: "2026-10-23",
      scheduleVersions: versions([
        "2026-10-23",
        { type: "weekly_target", target: 4 },
      ]),
    });
    const sessions = ["2026-10-23", "2026-10-24", "2026-10-25"].map((date) =>
      session("singing", date)
    );
    const summary = summarizeWeek({
      goal: lateStart,
      sessions,
      date: "2026-10-25",
      today: "2026-10-26",
      weekStartsOn: 1,
    });

    expect(summary).toMatchObject({
      activeDays: 3,
      sessions: 3,
      target: 4,
      status: "not_scored",
    });
    expect(
      weeklyOutcome({
        target: 4,
        sessions: 3,
        activeDays: 3,
        weekEnd: "2026-10-25",
        today: "2026-10-26",
      })
    ).toBe("not_scored");
  });

  it("has no weekly summary for a daily goal", () => {
    expect(
      summarizeWeek({
        goal: goal(),
        sessions: [],
        date: "2026-10-20",
        today: "2026-10-20",
        weekStartsOn: 1,
      })
    ).toBeNull();
  });
});
