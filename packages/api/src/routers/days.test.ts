import type { Database } from "@mostly/db";
import { goal, goalScheduleVersion } from "@mostly/db/schema/goals";
import { session } from "@mostly/db/schema/sessions";
import { userSettingVersion } from "@mostly/db/schema/settings";
import { createTestDb } from "@mostly/db/testing";
import type { Cadence, Weekday } from "@mostly/domain";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { createTestContext, createTestUser } from "../testing";
import { appRouter } from "./index";

const TODAY = "2026-10-20";
const NOW = new Date(`${TODAY}T12:00:00Z`);

const createGoal = async (
  db: Database,
  userId: string,
  {
    name = "Reading",
    startDate = "2026-10-01",
    archivedOn = null,
    cadence = { type: "daily" } as Cadence,
    versions = [],
  }: {
    name?: string;
    startDate?: string;
    archivedOn?: string | null;
    cadence?: Cadence;
    versions?: { effectiveFrom: string; cadence: Cadence }[];
  } = {}
) => {
  const now = new Date();
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(goal)
    .values({
      id,
      userId,
      name,
      priority: "medium",
      startDate,
      archivedOn,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!row) {
    throw new Error("expected a goal");
  }

  const schedule = [{ effectiveFrom: startDate, cadence }, ...versions];
  await db.insert(goalScheduleVersion).values(
    schedule.map((version) => ({
      id: crypto.randomUUID(),
      goalId: id,
      effectiveFrom: version.effectiveFrom,
      cadenceType: version.cadence.type,
      weekdays:
        version.cadence.type === "weekdays"
          ? (version.cadence.weekdays as Weekday[])
          : null,
      weeklyTarget:
        version.cadence.type === "weekly_target"
          ? version.cadence.target
          : null,
      createdAt: now,
    }))
  );

  return row;
};

const createSession = async (
  db: Database,
  userId: string,
  goalId: string,
  logicalDate: string,
  overrides: Partial<typeof session.$inferInsert> = {}
) => {
  const now = new Date();
  const [row] = await db
    .insert(session)
    .values({
      id: crypto.randomUUID(),
      userId,
      goalId,
      logicalDate,
      minutes: 30,
      note: null,
      mood: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();

  if (!row) {
    throw new Error("expected a session");
  }
  return row;
};

const syncOp = (
  goalId: string,
  logicalDate: string,
  overrides: Record<string, unknown> = {}
) => ({
  opId: crypto.randomUUID(),
  id: crypto.randomUUID(),
  goalId,
  logicalDate,
  minutes: 20,
  note: null,
  mood: null,
  updatedAt: Date.now(),
  deleted: false,
  ...overrides,
});

describe("daysRouter", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    ({ db, close } = await createTestDb());
  });

  afterEach(() => {
    close();
  });

  const clients = async () => {
    const alice = await createTestUser(db, {
      email: "alice@example.com",
      name: "Alice",
    });
    const bob = await createTestUser(db, {
      email: "bob@example.com",
      name: "Bob",
    });

    await Promise.all(
      [alice, bob].map((user) =>
        db.insert(userSettingVersion).values({
          id: crypto.randomUUID(),
          userId: user.user.id,
          effectiveFrom: "2026-09-01",
          timeZone: "UTC",
          weekStartsOn: 1,
          dayRolloverHour: 4,
          createdAt: NOW,
        })
      )
    );

    const context = (user: typeof alice) =>
      createTestContext(db, user, () => NOW);

    return {
      alice,
      bob,
      aliceClient: createRouterClient(appRouter, {
        context: context(alice),
      }),
      bobClient: createRouterClient(appRouter, {
        context: context(bob),
      }),
    };
  };

  it("returns done, missed, and no session statuses without storing misses", async () => {
    const { alice, aliceClient } = await clients();
    const reading = await createGoal(db, alice.user.id);
    await createSession(db, alice.user.id, reading.id, "2026-10-19");

    const today = await aliceClient.days.get({ date: "2026-10-20" });
    const done = await aliceClient.days.get({ date: "2026-10-19" });
    const missed = await aliceClient.days.get({ date: "2026-10-18" });
    const locked = await aliceClient.days.get({ date: "2026-10-13" });
    const firstDay = await aliceClient.days.get({ date: "2026-10-14" });

    expect(today.expectations).toEqual([
      expect.objectContaining({ status: "no_session", session: null }),
    ]);
    expect(today.today).toBe(TODAY);
    expect(done.expectations[0]).toMatchObject({
      status: "done",
      session: expect.objectContaining({ minutes: 30 }),
    });
    expect(missed.expectations[0]).toMatchObject({
      status: "missed",
      session: null,
    });
    expect(locked.readOnly).toBe(true);
    expect(firstDay.readOnly).toBe(false);
    expect(await db.select().from(session)).toHaveLength(1);
  });

  it("includes an archived goal on the archive day and locks its row", async () => {
    const { alice, aliceClient } = await clients();
    await createGoal(db, alice.user.id, {
      name: "Guitar",
      archivedOn: "2026-10-18",
    });

    const archiveDay = await aliceClient.days.get({ date: "2026-10-18" });
    const after = await aliceClient.days.get({ date: "2026-10-19" });

    expect(archiveDay.expectations).toHaveLength(1);
    expect(archiveDay.expectations[0]).toMatchObject({
      status: "missed",
      editable: false,
      goal: { archivedOn: "2026-10-18" },
    });
    expect(after.expectations).toEqual([]);
  });

  it("returns extras for off-day sessions and candidates for unlogged off days", async () => {
    const { alice, aliceClient } = await clients();
    const guitar = await createGoal(db, alice.user.id, {
      name: "Guitar",
      cadence: { type: "weekdays", weekdays: [1, 3, 5] },
    });
    const coding = await createGoal(db, alice.user.id, {
      name: "Coding",
      cadence: { type: "weekdays", weekdays: [1, 3, 5] },
    });
    await createGoal(db, alice.user.id, {
      name: "Future",
      startDate: "2026-10-21",
      cadence: { type: "weekdays", weekdays: [1, 3, 5] },
    });
    await createSession(db, alice.user.id, guitar.id, TODAY);

    const day = await aliceClient.days.get({ date: TODAY });

    expect(day.expectations).toEqual([]);
    expect(day.extras).toEqual([
      expect.objectContaining({
        goal: expect.objectContaining({ id: guitar.id }),
        editable: true,
      }),
    ]);
    expect(day.candidates.map((entry) => entry.id)).toEqual([coding.id]);
  });

  it("summarises weekly targets without adding daily expectations", async () => {
    const { alice, aliceClient } = await clients();
    const singing = await createGoal(db, alice.user.id, {
      name: "Singing",
      cadence: { type: "weekly_target", target: 3 },
    });
    await createGoal(db, alice.user.id, {
      name: "Sketching",
      cadence: { type: "weekly_target", target: 2 },
    });
    await createGoal(db, alice.user.id, {
      name: "Late",
      startDate: "2026-10-23",
      cadence: { type: "weekly_target", target: 4 },
    });
    await createSession(db, alice.user.id, singing.id, TODAY);

    const day = await aliceClient.days.get({ date: TODAY });
    const weekly = Object.fromEntries(
      day.weekly.map((entry) => [entry.goal.name, entry])
    );

    expect(day.expectations).toEqual([]);
    expect(day.extras).toEqual([]);
    expect(weekly.Singing).toMatchObject({
      goal: expect.objectContaining({ id: singing.id }),
      target: 3,
      sessions: 1,
      activeDays: 7,
      status: "in_progress",
      session: expect.objectContaining({ minutes: 30 }),
    });
    expect(weekly.Sketching).toMatchObject({
      target: 2,
      sessions: 0,
      activeDays: 7,
      status: "in_progress",
    });
    expect(weekly.Late).toMatchObject({
      target: 4,
      activeDays: 3,
      status: "not_scored",
    });
    expect(day.candidates.map((entry) => entry.name)).toEqual(["Sketching"]);
  });

  it("scopes the day detail to the signed-in user", async () => {
    const { alice, bobClient } = await clients();
    const reading = await createGoal(db, alice.user.id);
    await createSession(db, alice.user.id, reading.id, TODAY);

    const bobDay = await bobClient.days.get({ date: TODAY });

    expect(bobDay.expectations).toEqual([]);
    expect(bobDay.extras).toEqual([]);
    expect(bobDay.weekly).toEqual([]);
    expect(bobDay.candidates).toEqual([]);
    expect(bobDay.weekSessions).toEqual([]);
  });

  it("rejects writes outside the seven-day window and accepts the edge", async () => {
    const { alice, aliceClient } = await clients();
    const reading = await createGoal(db, alice.user.id);

    const result = await aliceClient.sessions.sync({
      ops: [
        syncOp(reading.id, "2026-10-13", {
          opId: "too-old",
          updatedAt: 1000,
        }),
        syncOp(reading.id, "2026-10-14", { opId: "edge", updatedAt: 2000 }),
        syncOp(reading.id, "2026-10-21", {
          opId: "future",
          updatedAt: 3000,
        }),
      ],
    });

    expect(result.rejected).toEqual([
      { opId: "too-old", reason: "read_only" },
      { opId: "future", reason: "read_only" },
    ]);
    expect(result.applied).toEqual(["edge"]);
    expect(await db.select().from(session)).toHaveLength(1);
  });

  it("rejects a backfill for archived history inside the window", async () => {
    const { alice, aliceClient } = await clients();
    const guitar = await createGoal(db, alice.user.id, {
      name: "Guitar",
      archivedOn: "2026-10-18",
    });

    const result = await aliceClient.sessions.sync({
      ops: [syncOp(guitar.id, "2026-10-18", { opId: "archived-day" })],
    });

    expect(result.applied).toEqual([]);
    expect(result.rejected).toEqual([
      { opId: "archived-day", reason: "read_only" },
    ]);
  });

  it("makes a missed day done after a backfill and missed again when removed", async () => {
    const { alice, aliceClient } = await clients();
    const reading = await createGoal(db, alice.user.id);

    const missed = await aliceClient.days.get({ date: "2026-10-18" });
    expect(missed.expectations[0]?.status).toBe("missed");

    const added = await aliceClient.sessions.sync({
      ops: [syncOp(reading.id, "2026-10-18", { updatedAt: 1000 })],
    });
    expect(added.applied).toHaveLength(1);
    const done = await aliceClient.days.get({ date: "2026-10-18" });
    expect(done.expectations[0]?.status).toBe("done");

    await aliceClient.sessions.sync({
      ops: [
        syncOp(reading.id, "2026-10-18", {
          deleted: true,
          minutes: null,
          updatedAt: 2000,
        }),
      ],
    });
    const removed = await aliceClient.days.get({ date: "2026-10-18" });
    expect(removed.expectations[0]).toMatchObject({
      status: "missed",
      session: null,
    });
    const rows = await db
      .select()
      .from(session)
      .where(eq(session.goalId, reading.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAt?.getTime()).toBe(2000);
  });
});
