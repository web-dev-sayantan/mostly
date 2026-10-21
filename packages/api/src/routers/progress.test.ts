import type { Database } from "@mostly/db";
import { goal, goalScheduleVersion } from "@mostly/db/schema/goals";
import { session } from "@mostly/db/schema/sessions";
import { createTestDb } from "@mostly/db/testing";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { createTestContext, createTestUser } from "../testing";
import { appRouter } from "./index";

const NOW = new Date("2026-02-02T12:00:00.000Z");
const now = () => NOW;

const datesBetween = (start: string, end: string): string[] => {
  const dates: string[] = [];
  const first = Date.parse(`${start}T00:00:00Z`);
  const last = Date.parse(`${end}T00:00:00Z`);
  for (let time = first; time <= last; time += 86_400_000) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }
  return dates;
};

describe("progress router", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    ({ db, close } = await createTestDb());
  });

  afterEach(() => {
    close();
  });

  const createGoal = async ({
    userId,
    name,
    startDate,
    priority = "medium",
    archivedOn = null,
    dates,
    minutes = 20,
  }: {
    userId: string;
    name: string;
    startDate: string;
    priority?: "high" | "medium" | "low";
    archivedOn?: string | null;
    dates: string[];
    minutes?: number | null;
  }) => {
    const id = crypto.randomUUID();
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    await db.insert(goal).values({
      id,
      userId,
      name,
      emoji: "📖",
      priority,
      startDate,
      archivedOn,
      createdAt,
      updatedAt: createdAt,
    });
    await db.insert(goalScheduleVersion).values({
      id: crypto.randomUUID(),
      goalId: id,
      effectiveFrom: startDate,
      cadenceType: "daily",
      createdAt,
    });
    await Promise.all(
      dates.map((logicalDate) =>
        db.insert(session).values({
          id: crypto.randomUUID(),
          userId,
          goalId: id,
          logicalDate,
          minutes,
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

  it("returns hero stats, heatmap, cards, and the today banner for the user", async () => {
    const { alice, aliceClient } = await clients();
    await createGoal({
      userId: alice.user.id,
      name: "Half",
      startDate: "2026-01-01",
      priority: "high",
      dates: datesBetween("2026-01-03", "2026-01-17"),
    });
    await createGoal({
      userId: alice.user.id,
      name: "Perfect",
      startDate: "2026-01-01",
      dates: datesBetween("2026-01-03", "2026-02-01"),
    });
    await createGoal({
      userId: alice.user.id,
      name: "Archived",
      startDate: "2026-01-01",
      archivedOn: "2026-01-30",
      dates: datesBetween("2026-01-28", "2026-01-30"),
    });
    await createGoal({
      userId: alice.user.id,
      name: "Future",
      startDate: "2026-02-03",
      dates: [],
    });

    const result = await aliceClient.progress.get({ range: 30 });

    expect(result.today).toBe("2026-02-02");
    expect(result.range).toBe(30);
    expect(result.empty).toBe(false);
    expect(result.hero.consistency).toEqual({
      percent: 75,
      qualifying: 2,
      total: 2,
      notEnoughData: false,
    });
    expect(result.hero.sessions).toBe(48);
    expect(result.hero.minutes).toMatchObject({
      total: 960,
      withMinutes: 48,
      sessions: 48,
    });
    expect(result.todayProgress).toMatchObject({
      done: 0,
      total: 2,
      incomplete: true,
    });
    expect(result.heatmap.days).toHaveLength(78);
    expect(result.heatmap.days.at(-1)?.date).toBe("2026-02-02");
    expect(result.weekly).toEqual([]);
    expect(result.cards.map((card) => card.name)).toEqual(["Half", "Perfect"]);
    expect(result.cards[0]?.consistency).toEqual({
      done: 15,
      expected: 30,
      percent: 50,
      qualified: true,
    });
  });

  it("does not include another user's progress", async () => {
    const { alice, bobClient } = await clients();
    await createGoal({
      userId: alice.user.id,
      name: "Private",
      startDate: "2026-01-01",
      dates: datesBetween("2026-01-03", "2026-02-01"),
    });

    const result = await bobClient.progress.get({ range: 30 });

    expect(result.cards).toEqual([]);
    expect(result.weekly).toEqual([]);
    expect(result.hero).toMatchObject({
      sessions: 0,
      consistency: {
        percent: null,
        qualifying: 0,
        total: 0,
        notEnoughData: true,
      },
    });
    expect(result.todayProgress.total).toBe(0);
    expect(result.empty).toBe(true);
  });

  it("recomputes range stats without moving the 12-week heatmap", async () => {
    const { alice, aliceClient } = await clients();
    await createGoal({
      userId: alice.user.id,
      name: "Recent",
      startDate: "2026-01-01",
      dates: datesBetween("2026-01-26", "2026-02-01"),
    });

    const seven = await aliceClient.progress.get({ range: 7 });
    const ninety = await aliceClient.progress.get({ range: 90 });

    expect(seven.range).toBe(7);
    expect(seven.cards[0]?.consistency).toMatchObject({
      done: 7,
      expected: 7,
      percent: 100,
    });
    expect(ninety.range).toBe(90);
    expect(ninety.cards[0]?.consistency).toMatchObject({
      done: 7,
      expected: 32,
      percent: 22,
    });
    expect(seven.heatmap.days).toHaveLength(78);
    expect(ninety.heatmap.days).toHaveLength(78);
  });
});
