import type { Database } from "@mostly/db";
import { user } from "@mostly/db/schema/auth";
import { goal, goalScheduleVersion } from "@mostly/db/schema/goals";
import { session } from "@mostly/db/schema/sessions";
import { userSettingVersion } from "@mostly/db/schema/settings";
import { createTestDb } from "@mostly/db/testing";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { createTestContext, createTestUser } from "../testing";
import { appRouter } from "./index";

const NOW = new Date("2026-02-02T12:00:00.000Z");
const now = () => NOW;

interface GoalSeed {
  startDate: string;
  archivedOn?: string | null;
  cadence?:
    | { type: "daily" }
    | { type: "weekdays"; weekdays: number[] }
    | {
        type: "weekly_target";
        target: number;
      };
  versions?: {
    effectiveFrom: string;
    cadence:
      | { type: "daily" }
      | { type: "weekdays"; weekdays: number[] }
      | { type: "weekly_target"; target: number };
  }[];
  sessions?: { logicalDate: string; minutes?: number | null }[];
}

describe("stats router goal detail", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    ({ db, close } = await createTestDb());
  });

  afterEach(() => {
    close();
  });

  const createGoal = async (
    userId: string,
    { startDate, archivedOn = null, cadence, versions, sessions = [] }: GoalSeed
  ) => {
    const id = crypto.randomUUID();
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    await db.insert(goal).values({
      id,
      userId,
      name: "Reading",
      emoji: "📖",
      priority: "high",
      startDate,
      archivedOn,
      createdAt,
      updatedAt: createdAt,
    });

    const scheduleVersions = versions ?? [
      { effectiveFrom: startDate, cadence: cadence ?? { type: "daily" } },
    ];
    await Promise.all(
      scheduleVersions.map((version) =>
        db.insert(goalScheduleVersion).values({
          id: crypto.randomUUID(),
          goalId: id,
          effectiveFrom: version.effectiveFrom,
          cadenceType: version.cadence.type,
          weekdays:
            version.cadence.type === "weekdays"
              ? version.cadence.weekdays
              : null,
          weeklyTarget:
            version.cadence.type === "weekly_target"
              ? version.cadence.target
              : null,
          createdAt,
        })
      )
    );

    await Promise.all(
      sessions.map((entry) =>
        db.insert(session).values({
          id: crypto.randomUUID(),
          userId,
          goalId: id,
          logicalDate: entry.logicalDate,
          minutes: entry.minutes ?? null,
          createdAt,
          updatedAt: createdAt,
        })
      )
    );

    return id;
  };

  const clients = async () => {
    const alice = await createTestUser(db, {
      email: "alice@example.com",
      name: "Alice",
    });
    const bob = await createTestUser(db, {
      email: "bob@example.com",
      name: "Bob",
    });

    return {
      alice,
      bob,
      aliceClient: createRouterClient(appRouter, {
        context: createTestContext(db, alice, now),
      }),
      bobClient: createRouterClient(appRouter, {
        context: createTestContext(db, bob, now),
      }),
    };
  };

  it("returns the goal, stat row, daily heatmap, and recent days", async () => {
    const { alice, aliceClient } = await clients();
    const goalId = await createGoal(alice.user.id, {
      startDate: "2026-01-20",
      sessions: [
        { logicalDate: "2026-01-20", minutes: 30 },
        { logicalDate: "2026-01-21", minutes: 20 },
        { logicalDate: "2026-01-22", minutes: 10 },
        { logicalDate: "2026-01-23" },
        { logicalDate: "2026-01-24" },
        { logicalDate: "2026-01-25" },
        { logicalDate: "2026-01-30" },
        { logicalDate: "2026-01-31" },
        { logicalDate: "2026-02-01" },
      ],
    });

    const detail = await aliceClient.stats.goal({ id: goalId });

    expect(detail.futureStart).toBe(false);
    expect(detail.startsOn).toBeNull();
    expect(detail.readOnly).toBe(false);
    expect(detail.goal).toMatchObject({
      id: goalId,
      name: "Reading",
      emoji: "📖",
      priority: "high",
      sessionCount: 9,
    });
    expect(detail.goal.scheduleVersions).toHaveLength(1);
    expect(detail.stats).toMatchObject({
      unit: "day",
      currentStreak: 3,
      bestStreak: 6,
      sessions: 9,
      consistency: { done: 9, expected: 13, percent: 69, qualified: true },
      minutes: { total: 60, average: 20, withMinutes: 3, sessions: 9 },
    });
    expect(detail.heatmap?.unit).toBe("day");
    if (detail.heatmap?.unit !== "day") {
      throw new Error("expected a daily heatmap");
    }
    expect(detail.heatmap.days.at(-1)).toMatchObject({
      date: "2026-02-02",
      status: "open",
    });
    expect(
      detail.heatmap.days.find((day) => day.date === "2026-01-29")
    ).toMatchObject({ status: "missed" });
    expect(detail.recentDays.map((day) => day.date)).toEqual([
      "2026-01-27",
      "2026-01-28",
      "2026-01-29",
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
    ]);
    expect(detail.recentDays.at(-1)).toMatchObject({
      date: "2026-02-01",
      status: "done",
      readOnly: false,
      sessionId: expect.any(String),
      updatedAt: expect.any(Number),
    });
    expect(
      detail.recentDays.find((day) => day.date === "2026-01-29")
    ).toMatchObject({ status: "missed", sessionId: null, updatedAt: null });
  });

  it("returns a frozen, read-only record for an archived goal", async () => {
    const { alice, aliceClient } = await clients();
    const goalId = await createGoal(alice.user.id, {
      startDate: "2026-01-01",
      archivedOn: "2026-01-10",
      sessions: [
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
      ].map((logicalDate) => ({ logicalDate })),
    });

    const detail = await aliceClient.stats.goal({ id: goalId });

    expect(detail.readOnly).toBe(true);
    expect(detail.stats).toMatchObject({
      currentStreak: null,
      bestStreak: 10,
      consistency: { done: 10, expected: 10, percent: 100, qualified: true },
    });
    expect(detail.recentDays).toHaveLength(7);
    expect(detail.recentDays.every((day) => day.readOnly)).toBe(true);
    expect(detail.recentDays.at(-1)?.date).toBe("2026-01-10");
    if (detail.heatmap?.unit !== "day") {
      throw new Error("expected a daily heatmap");
    }
    expect(detail.heatmap.days.at(-1)?.date).toBe("2026-01-10");
  });

  it("keeps the archive day editable while the goal is still open", async () => {
    const { alice, aliceClient } = await clients();
    const goalId = await createGoal(alice.user.id, {
      startDate: "2026-01-20",
      archivedOn: "2026-02-02",
      sessions: [{ logicalDate: "2026-02-01" }],
    });

    const detail = await aliceClient.stats.goal({ id: goalId });

    expect(detail.readOnly).toBe(false);
    expect(detail.stats?.currentStreak).not.toBeNull();
    expect(detail.recentDays.every((day) => !day.readOnly)).toBe(true);
  });

  it("returns a weekly strip and only session days in recent history", async () => {
    const { alice, aliceClient } = await clients();
    const goalId = await createGoal(alice.user.id, {
      startDate: "2026-01-05",
      cadence: { type: "weekly_target", target: 3 },
      sessions: [
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
        "2026-01-28",
      ].map((logicalDate) => ({ logicalDate })),
    });

    const detail = await aliceClient.stats.goal({ id: goalId });

    expect(detail.stats).toMatchObject({
      unit: "week",
      currentStreak: 2,
      bestStreak: 2,
      consistency: { done: 3, expected: 4, percent: 75, qualified: true },
    });
    if (detail.heatmap?.unit !== "week") {
      throw new Error("expected a weekly heatmap");
    }
    expect(detail.heatmap.weeks.map((week) => week.status)).toEqual([
      "met",
      "missed",
      "met",
      "met",
      "in_progress",
    ]);
    expect(detail.recentDays.map((day) => day.date)).toEqual([
      "2026-01-27",
      "2026-01-28",
    ]);
    expect(detail.recentDays.every((day) => day.status === "done")).toBe(true);
  });

  it("uses the user's week-start setting from settings history", async () => {
    const { alice, aliceClient } = await clients();
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    await db.insert(userSettingVersion).values({
      id: crypto.randomUUID(),
      userId: alice.user.id,
      effectiveFrom: "2026-01-01",
      timeZone: "UTC",
      weekStartsOn: 7,
      dayRolloverHour: 4,
      createdAt,
    });
    const goalId = await createGoal(alice.user.id, {
      startDate: "2026-01-04",
      cadence: { type: "weekly_target", target: 2 },
      sessions: [
        "2026-01-04",
        "2026-01-05",
        "2026-01-11",
        "2026-01-12",
        "2026-01-18",
      ].map((logicalDate) => ({ logicalDate })),
    });

    const detail = await aliceClient.stats.goal({ id: goalId });

    if (detail.heatmap?.unit !== "week") {
      throw new Error("expected a weekly heatmap");
    }
    expect(detail.heatmap.weekStartsOn).toBe(7);
    expect(detail.heatmap.weeks.map((week) => week.start)).toEqual([
      "2026-01-04",
      "2026-01-11",
      "2026-01-18",
      "2026-01-25",
      "2026-02-01",
    ]);
  });

  it("returns startsOn instead of stats before a goal starts", async () => {
    const { alice, aliceClient } = await clients();
    const goalId = await createGoal(alice.user.id, {
      startDate: "2026-03-01",
      sessions: [{ logicalDate: "2026-03-01" }],
    });

    const detail = await aliceClient.stats.goal({ id: goalId });

    expect(detail.futureStart).toBe(true);
    expect(detail.startsOn).toBe("2026-03-01");
    expect(detail.stats).toBeNull();
    expect(detail.heatmap).toBeNull();
    expect(detail.recentDays).toEqual([]);
  });

  it("uses the user's clock and rollover for today", async () => {
    const { alice } = await clients();
    await db
      .update(user)
      .set({
        timeZone: "America/New_York",
        weekStartsOn: 1,
        dayRolloverHour: 4,
      })
      .where(eq(user.id, alice.user.id));
    const goalId = await createGoal(alice.user.id, {
      startDate: "2026-01-30",
      sessions: [{ logicalDate: "2026-01-30" }, { logicalDate: "2026-01-31" }],
    });
    const lateClient = createRouterClient(appRouter, {
      context: createTestContext(
        db,
        alice,
        () => new Date("2026-02-02T06:00:00.000Z")
      ),
    });

    const detail = await lateClient.stats.goal({ id: goalId });

    expect(detail.today).toBe("2026-02-01");
    expect(detail.stats).toMatchObject({
      currentStreak: 2,
      consistency: { done: 2, expected: 2, percent: null, qualified: false },
    });
  });

  it("does not reveal another user's goal", async () => {
    const { alice, bobClient } = await clients();
    const goalId = await createGoal(alice.user.id, {
      startDate: "2026-01-20",
    });

    await expect(bobClient.stats.goal({ id: goalId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
