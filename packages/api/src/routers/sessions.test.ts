import type { Database } from "@mostly/db";
import { goal } from "@mostly/db/schema/goals";
import { session } from "@mostly/db/schema/sessions";
import { createTestDb } from "@mostly/db/testing";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { createTestContext, createTestUser } from "../testing";
import { appRouter } from "./index";

const createGoal = async (
  db: Database,
  userId: string,
  overrides: Partial<typeof goal.$inferInsert> = {}
) => {
  const now = new Date();
  const [row] = await db
    .insert(goal)
    .values({
      id: crypto.randomUUID(),
      userId,
      name: "Reading",
      priority: "medium",
      startDate: "2026-10-01",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();

  if (!row) {
    throw new Error("expected a goal");
  }
  return row;
};

const sessionOp = (
  goalId: string,
  overrides: Record<string, unknown> = {}
) => ({
  opId: crypto.randomUUID(),
  id: crypto.randomUUID(),
  goalId,
  logicalDate: "2026-10-20",
  minutes: 30,
  note: "Read a chapter",
  mood: "great" as const,
  updatedAt: 1000,
  deleted: false,
  ...overrides,
});

const NOW = () => new Date("2026-10-20T12:00:00Z");

describe("sessionsRouter", () => {
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
    const now = NOW;
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

  it("applies a queued write once even when it is replayed twice", async () => {
    const { alice, aliceClient } = await clients();
    const reading = await createGoal(db, alice.user.id);
    const op = sessionOp(reading.id);

    const first = await aliceClient.sessions.sync({ ops: [op] });
    const second = await aliceClient.sessions.sync({ ops: [op] });

    expect(first.applied).toEqual([op.opId]);
    expect(first.winners).toEqual([
      expect.objectContaining({
        id: op.id,
        minutes: 30,
        note: "Read a chapter",
      }),
    ]);
    expect(second.applied).toEqual([op.opId]);
    expect(second.conflicts).toEqual([]);
    expect(second.winners).toEqual([expect.objectContaining({ id: op.id })]);

    const rows = await db
      .select()
      .from(session)
      .where(eq(session.goalId, reading.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAt).toBeNull();
  });

  it("settles a replayed tombstone without creating another row", async () => {
    const { alice, aliceClient } = await clients();
    const reading = await createGoal(db, alice.user.id);
    await aliceClient.sessions.sync({
      ops: [sessionOp(reading.id, { updatedAt: 1000 })],
    });
    const deletion = sessionOp(reading.id, {
      deleted: true,
      minutes: null,
      note: null,
      mood: null,
      updatedAt: 2000,
    });

    await aliceClient.sessions.sync({ ops: [deletion] });
    const replay = await aliceClient.sessions.sync({ ops: [deletion] });

    expect(replay.applied).toEqual([deletion.opId]);
    expect(replay.conflicts).toEqual([]);
    const rows = await db
      .select()
      .from(session)
      .where(eq(session.goalId, reading.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAt?.getTime()).toBe(2000);
  });

  it("keeps one live row when two devices create the same goal day", async () => {
    const { alice, aliceClient } = await clients();
    const reading = await createGoal(db, alice.user.id);

    const result = await aliceClient.sessions.sync({
      ops: [
        sessionOp(reading.id, { id: "device-a", note: "A", updatedAt: 1000 }),
        sessionOp(reading.id, { id: "device-b", note: "B", updatedAt: 1000 }),
      ],
    });

    expect(result.winners).toHaveLength(1);
    const rows = await db
      .select()
      .from(session)
      .where(eq(session.goalId, reading.id));
    expect(rows).toHaveLength(1);
    await expect(
      aliceClient.sessions.list({ from: "2026-10-01", to: "2026-10-31" })
    ).resolves.toHaveLength(1);
  });

  it("resolves last-write-wins and returns the losing edit as a conflict", async () => {
    const { alice, aliceClient } = await clients();
    const reading = await createGoal(db, alice.user.id);
    const newer = sessionOp(reading.id, { note: "Newer", updatedAt: 2000 });
    const stale = sessionOp(reading.id, {
      note: "Older",
      minutes: 5,
      updatedAt: 1000,
    });

    await aliceClient.sessions.sync({ ops: [newer] });
    const result = await aliceClient.sessions.sync({ ops: [stale] });

    expect(result.applied).toEqual([]);
    expect(result.winners).toEqual([
      expect.objectContaining({ note: "Newer", minutes: 30 }),
    ]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        opId: stale.opId,
        local: expect.objectContaining({ note: "Older" }),
        server: expect.objectContaining({ note: "Newer" }),
      }),
    ]);
    await expect(
      aliceClient.sessions.list({ from: "2026-10-01", to: "2026-10-31" })
    ).resolves.toEqual([expect.objectContaining({ note: "Newer" })]);
  });

  it("tombstones deletes and refuses a stale resurrection", async () => {
    const { alice, aliceClient } = await clients();
    const reading = await createGoal(db, alice.user.id);

    await aliceClient.sessions.sync({
      ops: [sessionOp(reading.id, { updatedAt: 1000 })],
    });
    const removed = await aliceClient.sessions.sync({
      ops: [
        sessionOp(reading.id, {
          opId: "delete-op",
          id: "delete-session",
          deleted: true,
          updatedAt: 2000,
        }),
      ],
    });
    expect(removed.applied).toEqual(["delete-op"]);

    const stale = await aliceClient.sessions.sync({
      ops: [sessionOp(reading.id, { updatedAt: 1500 })],
    });

    expect(stale.applied).toEqual([]);
    expect(stale.winners).toEqual([
      expect.objectContaining({ deletedAt: 2000 }),
    ]);
    expect(stale.conflicts).toHaveLength(1);

    const rows = await db
      .select()
      .from(session)
      .where(eq(session.goalId, reading.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAt?.getTime()).toBe(2000);
    await expect(
      aliceClient.sessions.list({ from: "2026-10-01", to: "2026-10-31" })
    ).resolves.toEqual([]);
  });

  it("rejects sessions outside the goal's life", async () => {
    const { alice, aliceClient } = await clients();
    const archived = await createGoal(db, alice.user.id, {
      archivedOn: "2026-10-20",
    });
    const deleted = await createGoal(db, alice.user.id, {
      deletedAt: new Date(),
    });

    const result = await aliceClient.sessions.sync({
      ops: [
        sessionOp(archived.id, { logicalDate: "2026-09-30", opId: "before" }),
        sessionOp(archived.id, { logicalDate: "2026-10-21", opId: "after" }),
        sessionOp(deleted.id, { opId: "deleted" }),
        sessionOp(archived.id, {
          logicalDate: "2026-10-20",
          opId: "archive-day",
        }),
      ],
    });

    expect(
      result.rejected.toSorted((a, b) => a.opId.localeCompare(b.opId))
    ).toEqual([
      { opId: "after", reason: "after_archive" },
      { opId: "before", reason: "before_start" },
      { opId: "deleted", reason: "goal_deleted" },
    ]);
    expect(result.applied).toEqual(["archive-day"]);
    expect(await db.select().from(session)).toHaveLength(1);
  });

  it("rejects another user's goal without revealing it", async () => {
    const { bob, aliceClient } = await clients();
    const bobGoal = await createGoal(db, bob.user.id);

    const result = await aliceClient.sessions.sync({
      ops: [sessionOp(bobGoal.id, { opId: "cross-user" })],
    });

    expect(result.applied).toEqual([]);
    expect(result.rejected).toEqual([
      { opId: "cross-user", reason: "goal_not_found" },
    ]);
    expect(await db.select().from(session)).toHaveLength(0);
  });

  it("scopes list to the signed-in user and the date range", async () => {
    const { alice, bob, aliceClient, bobClient } = await clients();
    const aliceGoal = await createGoal(db, alice.user.id);
    const bobGoal = await createGoal(db, bob.user.id);

    await aliceClient.sessions.sync({
      ops: [sessionOp(aliceGoal.id, { logicalDate: "2026-10-20" })],
    });
    await bobClient.sessions.sync({
      ops: [sessionOp(bobGoal.id, { logicalDate: "2026-10-19" })],
    });

    await expect(
      aliceClient.sessions.list({ from: "2026-10-01", to: "2026-10-31" })
    ).resolves.toEqual([expect.objectContaining({ goalId: aliceGoal.id })]);
    await expect(
      bobClient.sessions.list({ from: "2026-10-01", to: "2026-10-31" })
    ).resolves.toEqual([expect.objectContaining({ goalId: bobGoal.id })]);
    await expect(
      aliceClient.sessions.list({ from: "2026-10-21", to: "2026-10-31" })
    ).resolves.toEqual([]);
  });

  it("validates a whole batch before writing any row", async () => {
    const { alice, aliceClient } = await clients();
    const reading = await createGoal(db, alice.user.id);

    await expect(
      aliceClient.sessions.sync({
        ops: [
          sessionOp(reading.id, { opId: "valid" }),
          sessionOp(reading.id, { opId: "invalid", note: "x".repeat(501) }),
        ],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(await db.select().from(session)).toHaveLength(0);
  });
});
