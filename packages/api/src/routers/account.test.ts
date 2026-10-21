import type { Database } from "@mostly/db";
import {
  account as authAccount,
  authSession,
  user,
} from "@mostly/db/schema/auth";
import { goal, goalScheduleVersion } from "@mostly/db/schema/goals";
import { session } from "@mostly/db/schema/sessions";
import { userSettingVersion } from "@mostly/db/schema/settings";
import { createTestDb } from "@mostly/db/testing";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { createTestContext, createTestUser } from "../testing";
import { appRouter } from "./index";

const NOW = new Date("2026-10-22T12:00:00Z");
const clock = () => NOW;

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
      startDate: "2026-10-19",
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

const createVersion = async (
  db: Database,
  goalId: string,
  values: Partial<typeof goalScheduleVersion.$inferInsert> = {}
) => {
  await db.insert(goalScheduleVersion).values({
    id: crypto.randomUUID(),
    goalId,
    effectiveFrom: "2026-10-19",
    cadenceType: "daily",
    weekdays: null,
    weeklyTarget: null,
    createdAt: new Date(),
    ...values,
  });
};

const sessionOp = (
  goalId: string,
  overrides: Record<string, unknown> = {}
) => ({
  opId: crypto.randomUUID(),
  id: crypto.randomUUID(),
  goalId,
  logicalDate: "2026-10-19",
  minutes: 30,
  note: "Alice note",
  mood: "great" as const,
  updatedAt: 1000,
  deleted: false,
  ...overrides,
});

describe("account router", () => {
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
        context: createTestContext(db, alice, clock),
      }),
      bobClient: createRouterClient(appRouter, {
        context: createTestContext(db, bob, clock),
      }),
    };
  };

  it("exports the signed-in user's history, archive info, and outcomes", async () => {
    const { alice, aliceClient } = await clients();
    await aliceClient.settings.get({ timeZone: "UTC" });

    const reading = await createGoal(db, alice.user.id, {
      name: "Reading",
      startDate: "2026-10-19",
    });
    await createVersion(db, reading.id);
    const guitar = await createGoal(db, alice.user.id, {
      name: "Guitar",
      startDate: "2026-09-01",
      archivedOn: "2026-10-10",
    });
    await createVersion(db, guitar.id, {
      effectiveFrom: "2026-09-01",
      cadenceType: "weekly_target",
      weeklyTarget: 3,
    });

    await aliceClient.sessions.sync({
      ops: [
        sessionOp(reading.id, { logicalDate: "2026-10-19" }),
        sessionOp(reading.id, { logicalDate: "2026-10-20" }),
      ],
    });

    const exported = await aliceClient.account.export();

    expect(exported.schema_version).toBe(1);
    expect(exported.exported_at).toBe(NOW.toISOString());
    expect(exported.user).toEqual({
      name: "Alice",
      email: "alice@example.com",
    });
    expect(exported.settings).toEqual([
      expect.objectContaining({
        effectiveFrom: "2026-10-22",
        timeZone: "UTC",
        weekStartsOn: 1,
        dayRolloverHour: 4,
      }),
    ]);
    expect(exported.goals).toEqual([
      expect.objectContaining({
        id: reading.id,
        name: "Reading",
        archivedOn: null,
        status: "active",
        scheduleVersions: [
          expect.objectContaining({
            effectiveFrom: "2026-10-19",
            cadence: { type: "daily" },
          }),
        ],
      }),
      expect.objectContaining({
        id: guitar.id,
        name: "Guitar",
        archivedOn: "2026-10-10",
        status: "archived",
        scheduleVersions: [
          expect.objectContaining({
            cadence: { type: "weekly_target", target: 3 },
          }),
        ],
      }),
    ]);
    expect(exported.sessions).toHaveLength(2);
    expect(exported.sessions).toEqual([
      expect.objectContaining({
        goalId: reading.id,
        logicalDate: "2026-10-19",
        note: "Alice note",
        mood: "great",
      }),
      expect.objectContaining({ logicalDate: "2026-10-20" }),
    ]);
    expect(exported.outcomes.daily).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          goalId: reading.id,
          date: "2026-10-19",
          outcome: "done",
        }),
        expect.objectContaining({
          goalId: reading.id,
          date: "2026-10-21",
          outcome: "missed",
        }),
        expect.objectContaining({
          goalId: reading.id,
          date: "2026-10-22",
          outcome: "open",
        }),
      ])
    );
    expect(exported.outcomes.weekly).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          goalId: guitar.id,
          target: 3,
          outcome: "missed",
        }),
      ])
    );
  });

  it("never includes another user's rows in an export", async () => {
    const { alice, bob, aliceClient, bobClient } = await clients();
    const aliceGoal = await createGoal(db, alice.user.id, { name: "Reading" });
    await createVersion(db, aliceGoal.id);
    const bobGoal = await createGoal(db, bob.user.id, {
      name: "Bob secret",
      startDate: "2026-10-19",
    });
    await createVersion(db, bobGoal.id);

    await aliceClient.sessions.sync({
      ops: [sessionOp(aliceGoal.id, { note: "Alice note" })],
    });
    await bobClient.sessions.sync({
      ops: [sessionOp(bobGoal.id, { note: "Bob note" })],
    });

    const exported = await aliceClient.account.export();
    const json = JSON.stringify(exported);

    expect(json).not.toContain("Bob secret");
    expect(json).not.toContain("Bob note");
    expect(json).not.toContain("bob@example.com");
    expect(exported.goals).toEqual([
      expect.objectContaining({ name: "Reading" }),
    ]);
    expect(exported.sessions).toEqual([
      expect.objectContaining({ note: "Alice note" }),
    ]);

    const bobExported = await bobClient.account.export();
    expect(JSON.stringify(bobExported)).not.toContain("Alice note");
    expect(JSON.stringify(bobExported)).not.toContain("alice@example.com");
  });

  it("requires the typed DELETE confirmation", async () => {
    const { aliceClient } = await clients();

    await expect(
      aliceClient.account.delete({ confirm: "delete" } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("deletes live data and rejects a queued write from an offline device", async () => {
    const { alice, bob, aliceClient, bobClient } = await clients();
    await aliceClient.settings.get({ timeZone: "UTC" });
    const aliceGoal = await createGoal(db, alice.user.id);
    await createVersion(db, aliceGoal.id);
    const bobGoal = await createGoal(db, bob.user.id, { name: "Bike" });
    await createVersion(db, bobGoal.id);

    await aliceClient.sessions.sync({
      ops: [sessionOp(aliceGoal.id)],
    });
    await bobClient.sessions.sync({
      ops: [sessionOp(bobGoal.id)],
    });

    // The offline device made this before it heard about the deletion.
    const queuedOp = sessionOp(aliceGoal.id, {
      opId: "queued-offline",
      logicalDate: "2026-10-20",
    });

    await expect(
      aliceClient.account.delete({ confirm: "DELETE" })
    ).resolves.toEqual({
      deleted: true,
      backupsExpireWithinDays: 30,
    });

    expect(await db.select().from(user)).toEqual([
      expect.objectContaining({ id: bob.user.id }),
    ]);
    expect(await db.select().from(goal)).toEqual([
      expect.objectContaining({ id: bobGoal.id }),
    ]);
    expect(await db.select().from(session)).toEqual([
      expect.objectContaining({ goalId: bobGoal.id }),
    ]);
    expect(
      await db
        .select()
        .from(userSettingVersion)
        .where(eq(userSettingVersion.userId, alice.user.id))
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(authSession)
        .where(eq(authSession.userId, alice.user.id))
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(authAccount)
        .where(eq(authAccount.userId, alice.user.id))
    ).toEqual([]);
    expect(await db.select().from(goalScheduleVersion)).toEqual([
      expect.objectContaining({ goalId: bobGoal.id }),
    ]);

    const replay = await aliceClient.sessions.sync({ ops: [queuedOp] });
    expect(replay.applied).toEqual([]);
    expect(replay.rejected).toEqual([
      { opId: queuedOp.opId, reason: "goal_not_found" },
    ]);
    expect(await db.select().from(session)).toEqual([
      expect.objectContaining({ goalId: bobGoal.id }),
    ]);

    await expect(aliceClient.account.export()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    const anonymousClient = createRouterClient(appRouter, {
      context: createTestContext(db, null, clock),
    });
    await expect(
      anonymousClient.sessions.sync({ ops: [queuedOp] })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    await expect(bobClient.account.export()).resolves.toMatchObject({
      user: { name: "Bob", email: "bob@example.com" },
    });
  });
});
