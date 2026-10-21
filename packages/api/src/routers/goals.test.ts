import type { Database } from "@mostly/db";
import { goal } from "@mostly/db/schema/goals";
import { createTestDb } from "@mostly/db/testing";
import { addDays, nextWeekStart, resolveSchedule } from "@mostly/domain";
import type { Cadence } from "@mostly/domain";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { requireWritableGoal } from "../goal-access";
import { createTestContext, createTestUser } from "../testing";
import { appRouter } from "./index";

const today = () => new Date().toISOString().slice(0, 10);

const baseGoal = () => ({
  name: "Reading",
  startDate: today(),
});

const cadenceOf = (
  versions: { effectiveFrom: string; cadence: Cadence }[],
  date: string
) => resolveSchedule(versions, date);

describe("goals router", () => {
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

    return {
      alice,
      bob,
      aliceClient: createRouterClient(appRouter, {
        context: createTestContext(db, alice),
      }),
      bobClient: createRouterClient(appRouter, {
        context: createTestContext(db, bob),
      }),
    };
  };

  it("creates a goal with the default medium priority and a daily start version", async () => {
    const { aliceClient } = await clients();

    const created = await aliceClient.goals.create(baseGoal());

    expect(created).toMatchObject({
      name: "Reading",
      emoji: null,
      color: null,
      priority: "medium",
      startDate: today(),
      archivedOn: null,
      sessionCount: 0,
    });
    expect(created.scheduleVersions).toHaveLength(1);
    expect(created.scheduleVersions[0]).toMatchObject({
      effectiveFrom: today(),
      cadence: { type: "daily" },
    });
  });

  it("lists active goals by priority and then creation", async () => {
    const { aliceClient } = await clients();

    await aliceClient.goals.create({
      name: "Low",
      startDate: today(),
      priority: "low",
    });
    await aliceClient.goals.create({
      name: "Medium",
      startDate: today(),
      priority: "medium",
    });
    await aliceClient.goals.create({
      name: "High",
      startDate: today(),
      priority: "high",
    });

    const listed = await aliceClient.goals.list();

    expect(listed.active.map((entry) => entry.name)).toEqual([
      "High",
      "Medium",
      "Low",
    ]);
    expect(listed.archived).toEqual([]);
  });

  it("validates names, dates, weekdays, and weekly targets on the server", async () => {
    const { aliceClient } = await clients();

    await expect(
      aliceClient.goals.create({ ...baseGoal(), name: "" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      aliceClient.goals.create({ ...baseGoal(), name: "x".repeat(41) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      aliceClient.goals.create({
        ...baseGoal(),
        startDate: addDays(today(), -1),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      aliceClient.goals.create({
        ...baseGoal(),
        cadence: { type: "weekdays", weekdays: [] },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      aliceClient.goals.create({
        ...baseGoal(),
        cadence: { type: "weekly_target", target: 8 },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("normalizes all seven weekdays to daily", async () => {
    const { aliceClient } = await clients();

    const created = await aliceClient.goals.create({
      ...baseGoal(),
      cadence: { type: "weekdays", weekdays: [1, 2, 3, 4, 5, 6, 7] },
    });

    expect(created.scheduleVersions[0]?.cadence).toEqual({ type: "daily" });
  });

  it("makes daily and weekday changes effective tomorrow and replaces the pending version", async () => {
    const { aliceClient } = await clients();
    const created = await aliceClient.goals.create(baseGoal());

    const first = await aliceClient.goals.update({
      id: created.id,
      cadence: { type: "weekdays", weekdays: [1, 3, 5] },
    });

    expect(first.scheduleVersions).toHaveLength(2);
    expect(cadenceOf(first.scheduleVersions, today())).toEqual({
      type: "daily",
    });
    expect(cadenceOf(first.scheduleVersions, addDays(today(), 1))).toEqual({
      type: "weekdays",
      weekdays: [1, 3, 5],
    });

    const pendingId = first.scheduleVersions[1]?.id;
    const second = await aliceClient.goals.update({
      id: created.id,
      cadence: { type: "weekdays", weekdays: [2, 4] },
    });

    expect(second.scheduleVersions).toHaveLength(2);
    expect(second.scheduleVersions[1]?.id).not.toBe(pendingId);
    expect(cadenceOf(second.scheduleVersions, addDays(today(), 1))).toEqual({
      type: "weekdays",
      weekdays: [2, 4],
    });
  });

  it("makes any weekly-target change effective next week", async () => {
    const { aliceClient } = await clients();
    const created = await aliceClient.goals.create(baseGoal());
    const weekStart = nextWeekStart(today());

    const weekly = await aliceClient.goals.update({
      id: created.id,
      cadence: { type: "weekly_target", target: 3 },
    });

    expect(weekly.scheduleVersions).toHaveLength(2);
    expect(cadenceOf(weekly.scheduleVersions, weekStart)).toEqual({
      type: "weekly_target",
      target: 3,
    });

    const raised = await aliceClient.goals.update({
      id: created.id,
      cadence: { type: "weekly_target", target: 5 },
    });

    expect(raised.scheduleVersions).toHaveLength(2);
    expect(raised.scheduleVersions[1]?.effectiveFrom).toBe(weekStart);
    expect(raised.scheduleVersions[1]?.cadence).toEqual({
      type: "weekly_target",
      target: 5,
    });

    const reverted = await aliceClient.goals.update({
      id: created.id,
      cadence: { type: "daily" },
    });

    expect(reverted.scheduleVersions).toHaveLength(1);
    expect(reverted.scheduleVersions[0]?.cadence).toEqual({ type: "daily" });
  });

  it("keeps past versions intact and only moves a future goal's initial version", async () => {
    const { aliceClient } = await clients();
    const startDate = addDays(today(), 5);
    const created = await aliceClient.goals.create({
      name: "Reading",
      startDate,
    });

    const changed = await aliceClient.goals.update({
      id: created.id,
      cadence: { type: "weekdays", weekdays: [1, 5] },
      startDate: addDays(today(), 7),
    });

    expect(changed.scheduleVersions).toHaveLength(1);
    expect(changed.scheduleVersions[0]).toMatchObject({
      effectiveFrom: addDays(today(), 7),
      cadence: { type: "weekdays", weekdays: [1, 5] },
    });
    expect(changed.startDate).toBe(addDays(today(), 7));
  });

  it("does not let a started goal move its start date", async () => {
    const { aliceClient } = await clients();
    const created = await aliceClient.goals.create(baseGoal());

    await expect(
      aliceClient.goals.update({
        id: created.id,
        startDate: addDays(today(), 1),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("archives on the archive day once, then the goal moves to archived", async () => {
    const { aliceClient } = await clients();
    const created = await aliceClient.goals.create(baseGoal());

    const archived = await aliceClient.goals.archive({ id: created.id });
    expect(archived.archivedOn).toBe(today());

    const listed = await aliceClient.goals.list();
    expect(listed.active.map((entry) => entry.id)).toContain(created.id);
    expect(listed.archived).toEqual([]);

    const again = await aliceClient.goals.archive({ id: created.id });
    expect(again.archivedOn).toBe(today());

    await db
      .update(goal)
      .set({ archivedOn: addDays(today(), -1) })
      .where(eq(goal.id, created.id));

    const afterArchiveDay = await aliceClient.goals.list();
    expect(afterArchiveDay.active).toEqual([]);
    expect(afterArchiveDay.archived.map((entry) => entry.id)).toContain(
      created.id
    );

    await expect(
      aliceClient.goals.update({ id: created.id, name: "Read more" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const deleted = await aliceClient.goals.delete({ id: created.id });
    expect(deleted.sessionCount).toBe(0);
  });

  it("deletes permanently and rejects queued writes for the deleted goal", async () => {
    const { aliceClient, alice } = await clients();
    const created = await aliceClient.goals.create(baseGoal());

    await expect(
      aliceClient.goals.delete({ id: created.id, sessionCount: 3 })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(aliceClient.goals.delete({ id: created.id })).resolves.toEqual(
      {
        sessionCount: 0,
      }
    );

    await expect(
      aliceClient.goals.get({ id: created.id })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      aliceClient.goals.delete({ id: created.id })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      requireWritableGoal(db, alice.user.id, created.id)
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const listed = await aliceClient.goals.list();
    expect(listed.active).toEqual([]);
  });

  it("returns NOT_FOUND for an unknown goal", async () => {
    const { aliceClient } = await clients();

    await expect(
      aliceClient.goals.get({ id: crypto.randomUUID() })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("scopes every procedure to the signed-in user", async () => {
    const { aliceClient, bobClient } = await clients();
    const created = await aliceClient.goals.create(baseGoal());

    const bobGoals = await bobClient.goals.list();
    expect(bobGoals.active).toEqual([]);
    await expect(bobClient.goals.get({ id: created.id })).rejects.toMatchObject(
      {
        code: "NOT_FOUND",
      }
    );
    await expect(
      bobClient.goals.update({ id: created.id, name: "Bob's goal" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      bobClient.goals.archive({ id: created.id })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      bobClient.goals.delete({ id: created.id })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const aliceGoals = await aliceClient.goals.list();
    expect(aliceGoals.active.map((entry) => entry.name)).toEqual(["Reading"]);
  });
});
