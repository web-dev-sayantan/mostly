import type { Database } from "@mostly/db";
import { user } from "@mostly/db/schema/auth";
import { goal, goalScheduleVersion } from "@mostly/db/schema/goals";
import {
  pushSubscription,
  reminderDelivery,
} from "@mostly/db/schema/reminders";
import { session } from "@mostly/db/schema/sessions";
import { userSettingVersion } from "@mostly/db/schema/settings";
import { createTestDb } from "@mostly/db/testing";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import type { PushSender, PushSubscriptionRecord } from "../push";
import { runReminders } from "../reminder-service";
import { createTestContext, createTestUser } from "../testing";
import { appRouter } from "./index";

const NOW = new Date("2026-10-22T22:00:00Z");

const enableReminder = async (
  db: Database,
  userId: string,
  overrides: { time?: string; timeZone?: string } = {}
) => {
  await db
    .update(user)
    .set({
      reminderEnabled: true,
      reminderTime: overrides.time ?? "21:30",
      timeZone: overrides.timeZone ?? "UTC",
    })
    .where(eq(user.id, userId));
};

const createGoal = async (db: Database, userId: string, name = "Reading") => {
  const now = new Date();
  const [row] = await db
    .insert(goal)
    .values({
      id: crypto.randomUUID(),
      userId,
      name,
      priority: "medium",
      startDate: "2026-10-01",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("expected a goal");
  }
  await db.insert(goalScheduleVersion).values({
    id: crypto.randomUUID(),
    goalId: row.id,
    effectiveFrom: "2026-10-01",
    cadenceType: "daily",
    createdAt: now,
  });
  return row;
};

const markDone = async (
  db: Database,
  userId: string,
  goalId: string,
  logicalDate = "2026-10-22"
) => {
  const now = new Date();
  await db.insert(session).values({
    id: crypto.randomUUID(),
    userId,
    goalId,
    logicalDate,
    createdAt: now,
    updatedAt: now,
  });
};

const createSubscription = async (
  db: Database,
  userId: string,
  overrides: Partial<typeof pushSubscription.$inferInsert> = {}
) => {
  const [row] = await db
    .insert(pushSubscription)
    .values({
      id: crypto.randomUUID(),
      userId,
      endpoint: `https://push.example.com/${crypto.randomUUID()}`,
      p256dh: "p256dh",
      auth: "auth",
      userAgent: "test",
      createdAt: new Date(NOW.getTime() - 60_000),
      lastSeenAt: new Date(NOW.getTime() - 60_000),
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("expected a subscription");
  }
  return row;
};

describe("reminder delivery", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    ({ db, close } = await createTestDb());
  });

  afterEach(() => {
    close();
  });

  it("sends at most one count-only reminder per logical day", async () => {
    const alice = await createTestUser(db);
    await enableReminder(db, alice.user.id);
    await createGoal(db, alice.user.id, "Private Reading Goal");
    await createSubscription(db, alice.user.id);

    const payloads: string[] = [];
    const sender: PushSender = {
      send: (_subscription, payload) => {
        payloads.push(payload);
        return Promise.resolve();
      },
    };

    await runReminders({ db, now: NOW, sender });
    await runReminders({ db, now: NOW, sender });

    expect(payloads).toHaveLength(1);
    expect(JSON.parse(payloads[0] ?? "{}")).toEqual({ count: 1 });
    expect(payloads[0]).not.toContain("Private Reading Goal");

    const deliveries = await db.select().from(reminderDelivery);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({
      userId: alice.user.id,
      logicalDate: "2026-10-22",
      status: "sent",
    });
  });

  it("suppresses when the day is already done", async () => {
    const alice = await createTestUser(db);
    await enableReminder(db, alice.user.id);
    const reading = await createGoal(db, alice.user.id);
    await markDone(db, alice.user.id, reading.id);
    await createSubscription(db, alice.user.id);

    let sends = 0;
    await runReminders({
      db,
      now: NOW,
      sender: {
        send: () => {
          sends += 1;
          return Promise.resolve();
        },
      },
    });

    expect(sends).toBe(0);
    const [delivery] = await db.select().from(reminderDelivery);
    expect(delivery).toMatchObject({
      status: "suppressed",
      error: "all_done",
    });
  });

  it("retries the next subscription without a second reminder", async () => {
    const alice = await createTestUser(db);
    await enableReminder(db, alice.user.id);
    await createGoal(db, alice.user.id);
    const oldest = await createSubscription(db, alice.user.id, {
      endpoint: "https://push.example.com/older",
      lastSeenAt: new Date(NOW.getTime() - 120_000),
    });
    await createSubscription(db, alice.user.id, {
      endpoint: "https://push.example.com/newest",
      lastSeenAt: new Date(NOW.getTime() - 1000),
    });

    const attempts: PushSubscriptionRecord[] = [];
    await runReminders({
      db,
      now: NOW,
      sender: {
        send: (subscription) => {
          attempts.push(subscription);
          return attempts.length === 1
            ? Promise.reject(new Error("push service down"))
            : Promise.resolve();
        },
      },
    });

    expect(attempts.map((entry) => entry.endpoint)).toEqual([
      "https://push.example.com/newest",
      "https://push.example.com/older",
    ]);
    const deliveries = await db.select().from(reminderDelivery);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({
      status: "sent",
      subscriptionId: oldest.id,
    });
  });

  it("does not duplicate after the reminder time changes that day", async () => {
    const alice = await createTestUser(db);
    await enableReminder(db, alice.user.id);
    await createGoal(db, alice.user.id);
    await createSubscription(db, alice.user.id);

    let sends = 0;
    const sender: PushSender = {
      send: () => {
        sends += 1;
        return Promise.resolve();
      },
    };

    await runReminders({ db, now: NOW, sender });
    await enableReminder(db, alice.user.id, { time: "08:00" });
    await runReminders({ db, now: NOW, sender });

    expect(sends).toBe(1);
    expect(await db.select().from(reminderDelivery)).toHaveLength(1);
  });

  it("uses the effective timezone version, not only the cache", async () => {
    const alice = await createTestUser(db);
    await enableReminder(db, alice.user.id, { time: "08:00" });
    await createGoal(db, alice.user.id);
    await createSubscription(db, alice.user.id);
    await db.insert(userSettingVersion).values({
      id: crypto.randomUUID(),
      userId: alice.user.id,
      effectiveFrom: "2026-10-22",
      timeZone: "Pacific/Kiritimati",
      weekStartsOn: 1,
      dayRolloverHour: 4,
      createdAt: NOW,
    });

    await runReminders({
      db,
      now: NOW,
      sender: { send: () => Promise.resolve() },
    });

    const [delivery] = await db.select().from(reminderDelivery);
    expect(delivery).toMatchObject({
      logicalDate: "2026-10-23",
      status: "sent",
    });
  });

  it("revokes subscriptions and deliveries when the account is deleted", async () => {
    const alice = await createTestUser(db, { email: "alice@example.com" });
    const bob = await createTestUser(db, { email: "bob@example.com" });
    await createSubscription(db, alice.user.id);
    const bobSubscription = await createSubscription(db, bob.user.id);
    await db.insert(reminderDelivery).values({
      id: crypto.randomUUID(),
      userId: alice.user.id,
      logicalDate: "2026-10-22",
      sentAt: NOW,
      status: "sent",
    });

    const aliceClient = createRouterClient(appRouter, {
      context: createTestContext(db, alice, () => NOW),
    });
    await aliceClient.account.delete({ confirm: "DELETE" });

    expect(await db.select().from(pushSubscription)).toEqual([
      expect.objectContaining({ id: bobSubscription.id, userId: bob.user.id }),
    ]);
    expect(await db.select().from(reminderDelivery)).toEqual([]);
  });
});

describe("reminder subscription routes", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    ({ db, close } = await createTestDb());
  });

  afterEach(() => {
    close();
  });

  it("registers and revokes only the signed-in user's device", async () => {
    const alice = await createTestUser(db, { email: "alice@example.com" });
    const bob = await createTestUser(db, { email: "bob@example.com" });
    const aliceClient = createRouterClient(appRouter, {
      context: createTestContext(db, alice, () => NOW),
    });
    const bobClient = createRouterClient(appRouter, {
      context: createTestContext(db, bob, () => NOW),
    });
    const endpoint = "https://push.example.com/device";

    await aliceClient.reminders.subscription.register({
      endpoint,
      p256dh: "key",
      auth: "secret",
    });

    await expect(
      bobClient.reminders.subscription.register({
        endpoint,
        p256dh: "other",
        auth: "other",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      bobClient.reminders.subscription.revoke({ endpoint })
    ).resolves.toEqual({ revoked: false });
    expect(await db.select().from(pushSubscription)).toEqual([
      expect.objectContaining({ userId: alice.user.id, revokedAt: null }),
    ]);

    await expect(
      aliceClient.reminders.subscription.revoke({ endpoint })
    ).resolves.toEqual({ revoked: true });
    const [row] = await db.select().from(pushSubscription);
    expect(row?.revokedAt).toEqual(NOW);
  });

  it("lets a new account reuse a revoked browser endpoint", async () => {
    const alice = await createTestUser(db, { email: "alice@example.com" });
    const bob = await createTestUser(db, { email: "bob@example.com" });
    const endpoint = "https://push.example.com/shared-browser";
    await createSubscription(db, alice.user.id, {
      endpoint,
      revokedAt: NOW,
    });
    const bobClient = createRouterClient(appRouter, {
      context: createTestContext(db, bob, () => NOW),
    });

    const registered = await bobClient.reminders.subscription.register({
      endpoint,
      p256dh: "bob-key",
      auth: "bob-secret",
    });

    expect(registered.id).not.toBeUndefined();
    expect(await db.select().from(pushSubscription)).toEqual([
      expect.objectContaining({
        id: registered.id,
        userId: bob.user.id,
        revokedAt: null,
      }),
    ]);
  });
});
