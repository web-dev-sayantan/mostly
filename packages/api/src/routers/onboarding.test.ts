import type { Database } from "@mostly/db";
import { user } from "@mostly/db/schema/auth";
import { goal } from "@mostly/db/schema/goals";
import { createTestDb } from "@mostly/db/testing";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { createTestContext, createTestUser } from "../testing";
import { appRouter } from "./index";

const NOW = new Date("2026-10-22T12:00:00Z");

describe("onboarding router", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    ({ db, close } = await createTestDb());
  });

  afterEach(() => {
    close();
  });

  it("marks a new account complete once", async () => {
    const alice = await createTestUser(db);
    const client = createRouterClient(appRouter, {
      context: createTestContext(db, alice, () => NOW),
    });

    await expect(client.onboarding.status()).resolves.toEqual({
      completed: false,
    });

    await client.onboarding.complete();
    await client.onboarding.complete();

    await expect(client.onboarding.status()).resolves.toEqual({
      completed: true,
    });
    const [row] = await db
      .select({ completedAt: user.onboardingCompletedAt })
      .from(user)
      .where(eq(user.id, alice.user.id));
    expect(row?.completedAt).toEqual(NOW);
  });

  it("treats an account with goals as a returning user", async () => {
    const alice = await createTestUser(db);
    const now = new Date();
    await db.insert(goal).values({
      id: crypto.randomUUID(),
      userId: alice.user.id,
      name: "Reading",
      startDate: "2026-10-01",
      createdAt: now,
      updatedAt: now,
    });
    const client = createRouterClient(appRouter, {
      context: createTestContext(db, alice, () => NOW),
    });

    await expect(client.onboarding.status()).resolves.toEqual({
      completed: true,
    });
  });
});
