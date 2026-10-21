import { describe, expect, it } from "vite-plus/test";

import type { ProgressGoal, ProgressSession } from "./progress";
import { buildProgress } from "./progress";
import type { Cadence, ScheduleVersion } from "./schedule";

const TODAY = "2026-02-02";

const version = (effectiveFrom: string, cadence: Cadence): ScheduleVersion => ({
  effectiveFrom,
  cadence,
});

const daily = (startDate: string) => version(startDate, { type: "daily" });

const weekdays = (startDate: string, days: number[]) =>
  version(startDate, { type: "weekdays", weekdays: days as never });

const weekly = (startDate: string, target: number) =>
  version(startDate, { type: "weekly_target", target });

const settings = [{ effectiveFrom: "2020-01-01", weekStartsOn: 1 }];

const makeGoal = (
  id: string,
  overrides: Partial<ProgressGoal> = {}
): ProgressGoal => ({
  id,
  name: id,
  emoji: null,
  color: null,
  priority: "medium",
  startDate: "2026-01-01",
  archivedOn: null,
  scheduleVersions: [daily("2026-01-01")],
  ...overrides,
});

const makeSessions = (
  goalId: string,
  dates: readonly string[],
  minutes?: readonly (number | null)[]
): ProgressSession[] =>
  dates.map((logicalDate, index) => ({
    goalId,
    logicalDate,
    minutes: minutes?.[index] ?? null,
  }));

const datesBetween = (start: string, end: string): string[] => {
  const dates: string[] = [];
  const first = Date.parse(`${start}T00:00:00Z`);
  const last = Date.parse(`${end}T00:00:00Z`);
  for (let time = first; time <= last; time += 86_400_000) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }
  return dates;
};

const build = ({
  goals,
  sessions = [],
  range = 30,
  today = TODAY,
}: {
  goals: ProgressGoal[];
  sessions?: ProgressSession[];
  range?: 7 | 30 | 90;
  today?: string;
}) =>
  buildProgress({
    goals,
    sessions,
    settings,
    today,
    range,
  });

describe("progress consistency", () => {
  it("averages qualifying goals with equal weight and reports coverage", () => {
    const half = makeGoal("Half", {
      startDate: "2026-01-01",
      scheduleVersions: [daily("2026-01-01")],
    });
    const perfect = makeGoal("Perfect", {
      startDate: "2026-01-01",
      scheduleVersions: [daily("2026-01-01")],
    });
    const fresh = makeGoal("Fresh", {
      startDate: "2026-01-28",
      scheduleVersions: [daily("2026-01-28")],
    });
    const sessions = [
      ...makeSessions("Half", datesBetween("2026-01-03", "2026-01-17")),
      ...makeSessions("Perfect", datesBetween("2026-01-03", "2026-02-01")),
      ...makeSessions("Fresh", datesBetween("2026-01-28", "2026-02-01")),
    ];

    const result = build({ goals: [half, perfect, fresh], sessions });

    expect(result.hero.consistency).toEqual({
      percent: 75,
      qualifying: 2,
      total: 3,
      notEnoughData: false,
    });
    expect(result.cards.map((card) => card.consistency)).toEqual([
      { done: 15, expected: 30, percent: 50, qualified: true },
      { done: 30, expected: 30, percent: 100, qualified: true },
      { done: 5, expected: 5, percent: null, qualified: false },
    ]);
  });

  it("says not enough data below two qualifying goals", () => {
    const qualified = makeGoal("Qualified");
    const fresh = makeGoal("Fresh", {
      startDate: "2026-01-28",
      scheduleVersions: [daily("2026-01-28")],
    });
    const result = build({
      goals: [qualified, fresh],
      sessions: makeSessions(
        "Qualified",
        datesBetween("2026-01-03", "2026-01-09")
      ),
    });

    expect(result.hero.consistency).toEqual({
      percent: null,
      qualifying: 1,
      total: 2,
      notEnoughData: true,
    });
  });

  it("changes consistency with the selected range", () => {
    const goal = makeGoal("Reading");
    const sessions = makeSessions(
      "Reading",
      datesBetween("2026-01-26", "2026-02-01")
    );

    const seven = build({ goals: [goal], sessions, range: 7 });
    const thirty = build({ goals: [goal], sessions, range: 30 });
    const ninety = build({ goals: [goal], sessions, range: 90 });

    expect(seven.cards[0]?.consistency).toEqual({
      done: 7,
      expected: 7,
      percent: 100,
      qualified: true,
    });
    expect(thirty.cards[0]?.consistency).toEqual({
      done: 7,
      expected: 30,
      percent: 23,
      qualified: true,
    });
    expect(ninety.cards[0]?.consistency).toEqual({
      done: 7,
      expected: 32,
      percent: 22,
      qualified: true,
    });
  });
});

describe("progress sessions and minutes", () => {
  it("counts extras and archived goals' sessions in the completed range", () => {
    const active = makeGoal("Active", {
      scheduleVersions: [weekdays("2026-01-01", [2])],
    });
    const archived = makeGoal("Archived", {
      archivedOn: "2026-01-30",
    });
    const sessions = [
      ...makeSessions("Active", ["2026-01-20"]),
      ...makeSessions("Active", ["2026-01-26"]),
      ...makeSessions("Active", ["2026-01-27"]),
      ...makeSessions("Active", ["2026-02-01"]),
      ...makeSessions("Active", ["2026-02-02"]),
      ...makeSessions("Archived", ["2026-01-28", "2026-01-29", "2026-01-30"]),
    ];

    const result = build({ goals: [active, archived], sessions, range: 7 });

    expect(result.hero.sessions).toBe(6);
    expect(result.cards.map((card) => card.goalId)).toEqual(["Active"]);
  });

  it("summarises minutes with coverage and ignores zero-minute sessions", () => {
    const goal = makeGoal("Reading");
    const dates = [
      "2026-01-26",
      "2026-01-27",
      "2026-01-28",
      "2026-01-29",
      "2026-01-30",
    ];
    const sessions = makeSessions("Reading", dates, [30, 20, 10, 0, null]);

    const result = build({ goals: [goal], sessions, range: 7 });

    expect(result.hero.minutes).toEqual({
      total: 60,
      average: 20,
      withMinutes: 3,
      sessions: 5,
    });
  });
});

describe("progress heatmap", () => {
  it("builds 12 weeks of daily cells with intensity bands and extras", () => {
    const base = { startDate: "2026-01-01" };
    const everyDay = makeGoal("Every day", base);
    const threeDays = makeGoal("Three days", {
      ...base,
      scheduleVersions: [weekdays("2026-01-01", [1, 3, 5])],
    });
    const mondays = makeGoal("Mondays", {
      ...base,
      scheduleVersions: [weekdays("2026-01-01", [1])],
    });
    const archived = makeGoal("Archived", {
      ...base,
      archivedOn: "2026-01-10",
      scheduleVersions: [weekdays("2026-01-01", [1])],
    });
    const sessions = [
      ...makeSessions("Every day", [
        "2026-01-05",
        "2026-01-06",
        "2026-01-07",
        "2026-01-12",
        "2026-01-19",
      ]),
      ...makeSessions("Three days", ["2026-01-06", "2026-01-12", "2026-01-19"]),
      ...makeSessions("Mondays", ["2026-01-19"]),
    ];

    const result = build({
      goals: [everyDay, threeDays, mondays, archived],
      sessions,
      range: 30,
    });
    const day = (date: string) =>
      result.heatmap.days.find((entry) => entry.date === date);

    expect(result.heatmap.days).toHaveLength(78);
    expect(result.heatmap.days[0]?.date).toBe("2025-11-17");
    expect(result.heatmap.days.at(-1)?.date).toBe(TODAY);

    expect(day("2025-12-01")).toMatchObject({
      expected: 0,
      done: 0,
      extras: 0,
      intensity: "neutral",
    });
    expect(day("2026-01-05")).toMatchObject({
      expected: 4,
      done: 1,
      extras: 0,
      intensity: "low",
    });
    expect(day("2026-01-06")).toMatchObject({
      expected: 1,
      done: 1,
      extras: 1,
      intensity: "full",
    });
    expect(day("2026-01-07")).toMatchObject({
      expected: 2,
      done: 1,
      extras: 0,
      intensity: "medium",
    });
    expect(day("2026-01-08")).toMatchObject({
      expected: 1,
      done: 0,
      intensity: "none",
    });
    expect(day("2026-01-12")).toMatchObject({
      expected: 3,
      done: 2,
      intensity: "medium",
    });
    expect(day("2026-01-19")).toMatchObject({
      expected: 3,
      done: 3,
      intensity: "full",
    });
  });
});

describe("progress weekly targets", () => {
  it("maps met, partial, none, and not-scored weeks into a 12-week strip", () => {
    const steady = makeGoal("Steady", {
      startDate: "2026-01-05",
      scheduleVersions: [weekly("2026-01-05", 3)],
    });
    const late = makeGoal("Late", {
      startDate: "2026-01-30",
      scheduleVersions: [weekly("2026-01-30", 4)],
    });
    const sessions = [
      ...makeSessions("Steady", [
        "2026-01-05",
        "2026-01-06",
        "2026-01-07",
        "2026-01-12",
        "2026-01-26",
        "2026-01-27",
      ]),
    ];

    const result = build({ goals: [steady, late], sessions });
    const steadyRow = result.weekly.find((row) => row.goalId === "Steady");
    const lateRow = result.weekly.find((row) => row.goalId === "Late");
    const status = (row: typeof steadyRow, weekStart: string) =>
      row?.weeks.find((week) => week.weekStart === weekStart)?.status;

    expect(steadyRow?.weeks).toHaveLength(12);
    expect(steadyRow?.weeks[0]?.weekStart).toBe("2025-11-17");
    expect(status(steadyRow, "2026-01-05")).toBe("met");
    expect(status(steadyRow, "2026-01-12")).toBe("partial");
    expect(status(steadyRow, "2026-01-19")).toBe("none");
    expect(status(steadyRow, "2026-01-26")).toBe("partial");
    expect(status(steadyRow, "2026-02-02")).toBe("none");
    expect(status(lateRow, "2026-01-26")).toBe("not_scored");
    expect(status(lateRow, "2026-02-02")).toBe("none");

    const steadyCard = result.cards.find((card) => card.goalId === "Steady");
    expect(steadyCard?.consistency).toEqual({
      done: 1,
      expected: 4,
      percent: 25,
      qualified: true,
    });
  });
});

describe("progress goal cards", () => {
  it("shows last-7-day dots, streak, consistency, and priority without future goals", () => {
    const reading = makeGoal("Reading", {
      startDate: "2026-01-20",
      priority: "high",
    });
    const guitar = makeGoal("Guitar", {
      startDate: "2026-01-05",
      scheduleVersions: [weekly("2026-01-05", 2)],
    });
    const future = makeGoal("Future", {
      startDate: "2026-02-03",
      scheduleVersions: [daily("2026-02-03")],
    });
    const archived = makeGoal("Archived", {
      archivedOn: "2026-01-31",
    });
    const sessions = [
      ...makeSessions("Reading", ["2026-01-30", "2026-01-31", "2026-02-01"]),
      ...makeSessions("Guitar", ["2026-01-05", "2026-01-06"]),
    ];

    const result = build({
      goals: [reading, guitar, future, archived],
      sessions,
    });
    const readingCard = result.cards.find((card) => card.goalId === "Reading");
    const guitarCard = result.cards.find((card) => card.goalId === "Guitar");

    expect(result.cards.map((card) => card.goalId)).toEqual([
      "Reading",
      "Guitar",
    ]);
    expect(readingCard).toMatchObject({
      unit: "day",
      priority: "high",
      currentStreak: 3,
      consistency: { done: 3, expected: 13, percent: 23, qualified: true },
      weeks: [],
    });
    expect(readingCard?.days.map((dot) => [dot.date, dot.status])).toEqual([
      ["2026-01-27", "missed"],
      ["2026-01-28", "missed"],
      ["2026-01-29", "missed"],
      ["2026-01-30", "done"],
      ["2026-01-31", "done"],
      ["2026-02-01", "done"],
      ["2026-02-02", "open"],
    ]);
    expect(guitarCard).toMatchObject({
      unit: "week",
      currentStreak: 0,
      consistency: { done: 1, expected: 4, percent: 25, qualified: true },
      days: [],
    });
    expect(guitarCard?.weeks).toHaveLength(7);
    expect(guitarCard?.weeks.at(-1)?.weekStart).toBe("2026-02-02");
  });
});

describe("progress today and empty state", () => {
  it("counts today's expected goals and marks the banner incomplete", () => {
    const goals = Array.from({ length: 5 }, (_, index) =>
      makeGoal(`Goal ${index + 1}`)
    );
    const sessions = goals
      .slice(0, 3)
      .flatMap((goal) => makeSessions(goal.id, [TODAY]));

    const result = build({ goals, sessions, range: 30 });

    expect(result.todayProgress).toMatchObject({
      date: TODAY,
      done: 3,
      total: 5,
      incomplete: true,
    });
    expect(result.todayProgress.goals.map((goal) => goal.done)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);

    const complete = build({
      goals,
      sessions: goals.flatMap((goal) => makeSessions(goal.id, [TODAY])),
      range: 30,
    });
    expect(complete.todayProgress.incomplete).toBe(false);
  });

  it("ignores weekly goals in today's daily count", () => {
    const goal = makeGoal("Weekly", {
      scheduleVersions: [weekly("2026-01-05", 3)],
    });

    const result = build({
      goals: [goal],
      sessions: makeSessions("Weekly", [TODAY]),
      range: 30,
    });

    expect(result.todayProgress).toMatchObject({
      done: 0,
      total: 0,
      incomplete: false,
    });
  });

  it("stays empty until seven completed logical days since the first start", () => {
    const six = build({
      goals: [makeGoal("Early", { startDate: "2026-01-30" })],
      today: "2026-02-05",
    });
    const seven = build({
      goals: [makeGoal("Week", { startDate: "2026-01-29" })],
      today: "2026-02-05",
    });
    const future = build({
      goals: [makeGoal("Future", { startDate: "2026-02-10" })],
      today: "2026-02-05",
    });
    const none = build({ goals: [], today: "2026-02-05" });

    expect(six.empty).toBe(true);
    expect(six.todayProgress).toMatchObject({
      done: 0,
      total: 1,
      incomplete: true,
    });
    expect(seven.empty).toBe(false);
    expect(future.empty).toBe(true);
    expect(none.empty).toBe(true);
  });
});
