import { describe, expect, it } from "vite-plus/test";

import type { ExportGoalInput, ExportSessionInput } from "./export";
import { deriveOutcomes } from "./export";
import type { Cadence } from "./schedule";

const version = (effectiveFrom: string, cadence: Cadence) => ({
  effectiveFrom,
  cadence,
});

const goal = (overrides: Partial<ExportGoalInput> = {}): ExportGoalInput => ({
  id: "goal-1",
  startDate: "2026-10-19",
  archivedOn: null,
  scheduleVersions: [version("2026-10-19", { type: "daily" })],
  ...overrides,
});

const session = (
  logicalDate: string,
  overrides: Partial<ExportSessionInput> = {}
): ExportSessionInput => ({
  goalId: "goal-1",
  logicalDate,
  minutes: null,
  ...overrides,
});

describe("deriveOutcomes", () => {
  it("marks done, missed, and today's open daily expectations", () => {
    const outcomes = deriveOutcomes({
      goals: [goal()],
      sessions: [
        session("2026-10-19", { minutes: 30 }),
        session("2026-10-21", { minutes: 15 }),
      ],
      today: "2026-10-22",
      settings: [],
    });

    expect(outcomes.daily).toEqual([
      {
        goalId: "goal-1",
        date: "2026-10-19",
        expected: true,
        done: true,
        extra: false,
        outcome: "done",
        sessionCount: 1,
        minutes: 30,
      },
      {
        goalId: "goal-1",
        date: "2026-10-20",
        expected: true,
        done: false,
        extra: false,
        outcome: "missed",
        sessionCount: 0,
        minutes: null,
      },
      {
        goalId: "goal-1",
        date: "2026-10-21",
        expected: true,
        done: true,
        extra: false,
        outcome: "done",
        sessionCount: 1,
        minutes: 15,
      },
      {
        goalId: "goal-1",
        date: "2026-10-22",
        expected: true,
        done: false,
        extra: false,
        outcome: "open",
        sessionCount: 0,
        minutes: null,
      },
    ]);
  });

  it("keeps extras out of expected days and stops at the archive day", () => {
    const outcomes = deriveOutcomes({
      goals: [
        goal({
          archivedOn: "2026-10-21",
          scheduleVersions: [
            version("2026-10-19", { type: "weekdays", weekdays: [1, 3] }),
          ],
        }),
      ],
      sessions: [session("2026-10-20"), session("2026-10-21")],
      today: "2026-10-22",
      settings: [],
    });

    expect(outcomes.daily).toEqual([
      expect.objectContaining({
        date: "2026-10-19",
        expected: true,
        done: false,
        outcome: "missed",
      }),
      expect.objectContaining({
        date: "2026-10-20",
        expected: false,
        done: true,
        extra: true,
        outcome: "extra",
      }),
      expect.objectContaining({
        date: "2026-10-21",
        expected: true,
        done: true,
        extra: false,
        outcome: "done",
      }),
    ]);
  });

  it("scores weekly targets as met, missed, in progress, and not scored", () => {
    const outcomes = deriveOutcomes({
      goals: [
        goal({
          id: "weekly",
          startDate: "2026-10-05",
          scheduleVersions: [
            version("2026-10-05", { type: "weekly_target", target: 3 }),
          ],
        }),
        goal({
          id: "partial",
          startDate: "2026-10-24",
          scheduleVersions: [
            version("2026-10-24", { type: "weekly_target", target: 3 }),
          ],
        }),
      ],
      sessions: [
        session("2026-10-07", { goalId: "weekly" }),
        session("2026-10-13", { goalId: "weekly" }),
        session("2026-10-14", { goalId: "weekly" }),
        session("2026-10-15", { goalId: "weekly" }),
        session("2026-10-19", { goalId: "weekly" }),
        session("2026-10-24", { goalId: "partial" }),
      ],
      today: "2026-10-25",
      settings: [],
    });

    expect(outcomes.weekly).toEqual([
      expect.objectContaining({
        goalId: "weekly",
        weekStart: "2026-10-05",
        weekEnd: "2026-10-11",
        target: 3,
        sessions: 1,
        activeDays: 7,
        outcome: "missed",
      }),
      expect.objectContaining({
        goalId: "weekly",
        weekStart: "2026-10-12",
        weekEnd: "2026-10-18",
        sessions: 3,
        outcome: "met",
      }),
      expect.objectContaining({
        goalId: "weekly",
        weekStart: "2026-10-19",
        weekEnd: "2026-10-25",
        sessions: 1,
        outcome: "in_progress",
      }),
      expect.objectContaining({
        goalId: "partial",
        weekStart: "2026-10-19",
        weekEnd: "2026-10-25",
        sessions: 1,
        activeDays: 2,
        outcome: "not_scored",
      }),
    ]);
    expect(outcomes.daily).toEqual([]);
  });

  it("uses the week start setting in effect for each week", () => {
    const outcomes = deriveOutcomes({
      goals: [
        goal({
          id: "weekly",
          startDate: "2026-10-11",
          scheduleVersions: [
            version("2026-10-11", { type: "weekly_target", target: 2 }),
          ],
        }),
      ],
      sessions: [session("2026-10-11", { goalId: "weekly" })],
      today: "2026-10-17",
      settings: [
        {
          effectiveFrom: "2026-10-11",
          timeZone: "UTC",
          weekStartsOn: 7,
          dayRolloverHour: 4,
        },
      ],
    });

    expect(outcomes.weekly).toEqual([
      expect.objectContaining({
        goalId: "weekly",
        weekStart: "2026-10-11",
        weekEnd: "2026-10-17",
        target: 2,
        activeDays: 7,
        outcome: "in_progress",
      }),
    ]);
  });

  it("marks the week that changes week start as not scored and starts the new era", () => {
    const outcomes = deriveOutcomes({
      goals: [
        goal({
          id: "weekly",
          startDate: "2026-10-19",
          scheduleVersions: [
            version("2026-10-19", { type: "weekly_target", target: 2 }),
          ],
        }),
      ],
      sessions: [
        session("2026-10-19", { goalId: "weekly" }),
        session("2026-10-20", { goalId: "weekly" }),
      ],
      today: "2026-10-26",
      settings: [
        {
          effectiveFrom: "2026-10-19",
          timeZone: "UTC",
          weekStartsOn: 1,
          dayRolloverHour: 4,
        },
        {
          effectiveFrom: "2026-10-25",
          timeZone: "UTC",
          weekStartsOn: 7,
          dayRolloverHour: 4,
        },
      ],
    });

    expect(outcomes.weekly).toEqual([
      expect.objectContaining({
        goalId: "weekly",
        weekStart: "2026-10-19",
        weekEnd: "2026-10-24",
        activeDays: 6,
        outcome: "not_scored",
      }),
      expect.objectContaining({
        goalId: "weekly",
        weekStart: "2026-10-25",
        weekEnd: "2026-10-31",
        activeDays: 2,
        outcome: "in_progress",
      }),
    ]);
  });

  it("returns empty outcomes when there is nothing to score", () => {
    expect(
      deriveOutcomes({
        goals: [],
        sessions: [],
        today: "2026-10-22",
        settings: [],
      })
    ).toEqual({ daily: [], weekly: [] });
  });

  it("leaves a skipped date out of daily rows and weekly active days", () => {
    const dailyOutcomes = deriveOutcomes({
      goals: [goal()],
      sessions: [session("2026-10-20")],
      today: "2026-10-22",
      settings: [],
      skippedDates: ["2026-10-20"],
    });
    const weeklyOutcomes = deriveOutcomes({
      goals: [
        goal({
          id: "weekly",
          startDate: "2026-10-19",
          scheduleVersions: [
            version("2026-10-19", { type: "weekly_target", target: 3 }),
          ],
        }),
      ],
      sessions: [],
      today: "2026-10-22",
      settings: [],
      skippedDates: ["2026-10-20"],
    });

    expect(dailyOutcomes.daily.map((row) => row.date)).toEqual([
      "2026-10-19",
      "2026-10-21",
      "2026-10-22",
    ]);
    expect(weeklyOutcomes.weekly).toEqual([
      expect.objectContaining({ activeDays: 3, sessions: 0 }),
    ]);
  });
});
