import type { GoalDto } from "@mostly/api/routers/goals";
import { describe, expect, it } from "vite-plus/test";

import type { LocalSession } from "./offline/store";
import {
  buildTodayView,
  dailyProgressPercent,
  hasSessionDetails,
  resolveTodaySettings,
  todayProgressCopy,
  weeklyCountCopy,
  weeklyTargetCopy,
} from "./today";

const goal = (overrides: Partial<GoalDto> = {}): GoalDto => ({
  id: "goal-1",
  name: "Reading",
  emoji: "📖",
  color: null,
  priority: "medium",
  startDate: "2026-10-01",
  archivedOn: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  sessionCount: 0,
  scheduleVersions: [
    {
      id: "version-1",
      effectiveFrom: "2026-10-01",
      cadence: { type: "daily" },
    },
  ],
  ...overrides,
});

const session = (overrides: Partial<LocalSession> = {}): LocalSession => ({
  id: "session-1",
  goalId: "goal-1",
  logicalDate: "2026-10-20",
  minutes: null,
  note: null,
  mood: null,
  updatedAt: 1,
  pending: true,
  ...overrides,
});

const build = (
  goals: GoalDto[],
  sessions: LocalSession[] = [],
  today = "2026-10-20"
) =>
  buildTodayView({
    goals,
    sessions,
    today,
    weekStartsOn: 1,
  });

describe("buildTodayView", () => {
  it("lists daily and weekday goals expected today, high priority first", () => {
    const view = build([
      goal({
        id: "low",
        name: "Low",
        priority: "low",
        createdAt: "2026-10-01T00:00:00.000Z",
      }),
      goal({
        id: "high",
        name: "High",
        priority: "high",
        createdAt: "2026-10-09T00:00:00.000Z",
      }),
      goal({
        id: "medium",
        name: "Medium",
        createdAt: "2026-10-05T00:00:00.000Z",
      }),
      goal({
        id: "monday",
        name: "Monday only",
        scheduleVersions: [
          {
            id: "version-monday",
            effectiveFrom: "2026-10-01",
            cadence: { type: "weekdays", weekdays: [1] },
          },
        ],
      }),
      goal({
        id: "tuesday",
        name: "Tuesday only",
        scheduleVersions: [
          {
            id: "version-tuesday",
            effectiveFrom: "2026-10-01",
            cadence: { type: "weekdays", weekdays: [2] },
          },
        ],
      }),
    ]);

    expect(view.todayGoals.map((entry) => entry.goal.name)).toEqual([
      "High",
      "Tuesday only",
      "Medium",
      "Low",
    ]);
    expect(view.dailyTotal).toBe(4);
  });

  it("excludes future-start, archived, and weekly-target goals from today", () => {
    const view = build([
      goal({ id: "daily" }),
      goal({ id: "future", startDate: "2026-10-21" }),
      goal({ id: "archived", archivedOn: "2026-10-19" }),
      goal({
        id: "weekly",
        scheduleVersions: [
          {
            id: "version-weekly",
            effectiveFrom: "2026-10-01",
            cadence: { type: "weekly_target", target: 3 },
          },
        ],
      }),
    ]);

    expect(view.todayGoals.map((entry) => entry.goal.id)).toEqual(["daily"]);
    expect(view.weeklyGoals.map((entry) => entry.goal.id)).toEqual(["weekly"]);
    // Future goals still count as active: Today says "nothing scheduled", not "no goals".
    expect(view.activeGoalCount).toBe(3);
  });

  it("keeps a goal archived today in Today", () => {
    const view = build([goal({ archivedOn: "2026-10-20" })]);

    expect(view.todayGoals).toHaveLength(1);
  });

  it("counts only sessions on expected goals for today's progress", () => {
    const view = build(
      [
        goal({ id: "done" }),
        goal({ id: "open" }),
        goal({
          id: "off-day",
          scheduleVersions: [
            {
              id: "version-monday",
              effectiveFrom: "2026-10-01",
              cadence: { type: "weekdays", weekdays: [1] },
            },
          ],
        }),
      ],
      [
        session({ id: "done-session", goalId: "done" }),
        session({ id: "extra-session", goalId: "off-day" }),
        session({
          id: "old-session",
          goalId: "open",
          logicalDate: "2026-10-19",
        }),
      ]
    );

    expect(view.dailyDone).toBe(1);
    expect(view.dailyTotal).toBe(2);
    expect(dailyProgressPercent(view.dailyDone, view.dailyTotal)).toBe(50);
  });

  it("counts this week's sessions and marks a target met", () => {
    const weekly = goal({
      id: "singing",
      name: "Singing",
      scheduleVersions: [
        {
          id: "version-singing",
          effectiveFrom: "2026-10-01",
          cadence: { type: "weekly_target", target: 3 },
        },
      ],
    });
    const view = build(
      [weekly],
      [
        session({ id: "monday", goalId: "singing", logicalDate: "2026-10-19" }),
        session({
          id: "tuesday",
          goalId: "singing",
          logicalDate: "2026-10-20",
        }),
        session({
          id: "last-week",
          goalId: "singing",
          logicalDate: "2026-10-12",
        }),
      ]
    );
    const [entry] = view.weeklyGoals;
    if (!entry) {
      throw new Error("Expected a weekly goal");
    }

    expect(entry.count).toBe(2);
    expect(entry.target).toBe(3);
    expect(entry.scored).toBe(true);
    expect(entry.met).toBe(false);
    expect(weeklyTargetCopy(entry)).toBe("2 of 3 this week");
    expect(view.weeklyOpenCount).toBe(1);

    expect(weeklyTargetCopy({ ...entry, count: 3, met: true })).toBe(
      "Target met"
    );
    expect(weeklyCountCopy({ ...entry, count: 3, met: true })).toBe(
      "3 of 3 this week"
    );
  });

  it("does not score a week with fewer active days than the target", () => {
    const view = build(
      [
        goal({
          id: "late-start",
          startDate: "2026-10-23",
          scheduleVersions: [
            {
              id: "version-late",
              effectiveFrom: "2026-10-23",
              cadence: { type: "weekly_target", target: 4 },
            },
          ],
        }),
        goal({
          id: "archived-today",
          archivedOn: "2026-10-23",
          scheduleVersions: [
            {
              id: "version-archive",
              effectiveFrom: "2026-10-01",
              cadence: { type: "weekly_target", target: 6 },
            },
          ],
        }),
      ],
      [],
      "2026-10-23"
    );

    expect(view.weeklyGoals.map((entry) => entry.scored)).toEqual([
      false,
      false,
    ]);
    expect(
      view.weeklyGoals.map((entry) => entry && weeklyTargetCopy(entry))
    ).toEqual(["Not enough days this week", "Not enough days this week"]);
    expect(view.weeklyOpenCount).toBe(2);
  });
});

describe("today progress copy", () => {
  it("uses the count while the day is partial", () => {
    expect(
      todayProgressCopy({
        dailyDone: 3,
        dailyTotal: 5,
        weeklyOpenCount: 1,
        weeklyTotal: 2,
      })
    ).toBe("3 of 5 done");
  });

  it("closes the day quietly when everything expected is done", () => {
    expect(
      todayProgressCopy({
        dailyDone: 5,
        dailyTotal: 5,
        weeklyOpenCount: 0,
        weeklyTotal: 0,
      })
    ).toBe("That's the day. 5 of 5.");
  });

  it("names an open weekly target after the daily list is done", () => {
    expect(
      todayProgressCopy({
        dailyDone: 5,
        dailyTotal: 5,
        weeklyOpenCount: 1,
        weeklyTotal: 2,
      })
    ).toBe("Today's list is done. 1 weekly target still open.");
  });

  it("shows weekly targets instead of a 0 of 0 bar", () => {
    expect(
      todayProgressCopy({
        dailyDone: 0,
        dailyTotal: 0,
        weeklyOpenCount: 2,
        weeklyTotal: 2,
      })
    ).toBe("2 weekly targets");
    expect(
      todayProgressCopy({
        dailyDone: 0,
        dailyTotal: 0,
        weeklyOpenCount: 1,
        weeklyTotal: 1,
      })
    ).toBe("1 weekly target");
  });

  it("leaves the copy empty when there is nothing to count", () => {
    expect(
      todayProgressCopy({
        dailyDone: 0,
        dailyTotal: 0,
        weeklyOpenCount: 0,
        weeklyTotal: 0,
      })
    ).toBeNull();
  });
});

describe("hasSessionDetails", () => {
  it("is true when minutes, a note, or a mood exists", () => {
    expect(hasSessionDetails(session({ minutes: 0 }))).toBe(true);
    expect(hasSessionDetails(session({ note: "A page" }))).toBe(true);
    expect(hasSessionDetails(session({ mood: "great" }))).toBe(true);
  });

  it("is false for a bare done session and a missing session", () => {
    expect(hasSessionDetails(session())).toBe(false);
    expect(hasSessionDetails(session({ note: "" }))).toBe(false);
    expect(hasSessionDetails(null)).toBe(false);
  });
});

describe("resolveTodaySettings", () => {
  const history = [
    {
      effectiveFrom: "2026-10-01",
      timeZone: "UTC",
      weekStartsOn: 1,
      dayRolloverHour: 4,
    },
  ];

  it("keeps the previous logical day before the rollover", () => {
    expect(
      resolveTodaySettings(history, new Date("2026-10-20T03:59:00.000Z"))
    ).toMatchObject({ today: "2026-10-19" });
  });

  it("moves to the new logical day at the rollover", () => {
    expect(
      resolveTodaySettings(history, new Date("2026-10-20T04:00:00.000Z"))
    ).toMatchObject({ today: "2026-10-20" });
  });

  it("returns null without settings history", () => {
    expect(resolveTodaySettings([], new Date())).toBeNull();
  });
});
