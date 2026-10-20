import type { Database } from "@mostly/db";
import { createTestDb } from "@mostly/db/testing";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { createTestContext, createTestUser } from "../testing";
import { appRouter } from "./index";

describe("appRouter", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    ({ db, close } = await createTestDb());
  });

  afterEach(() => {
    close();
  });

  it("rejects an anonymous caller on a protected procedure", async () => {
    const client = createRouterClient(appRouter, {
      context: createTestContext(db, null),
    });

    await expect(client.privateData()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns the signed-in user's data", async () => {
    const alice = await createTestUser(db, {
      email: "alice@example.com",
      name: "Alice",
    });
    const client = createRouterClient(appRouter, {
      context: createTestContext(db, alice),
    });

    await expect(client.privateData()).resolves.toMatchObject({
      message: "This is private",
      user: { email: "alice@example.com", name: "Alice" },
    });
  });

  it("keeps a second user's context separate", async () => {
    const alice = await createTestUser(db, {
      email: "alice@example.com",
      name: "Alice",
    });
    const bob = await createTestUser(db, {
      email: "bob@example.com",
      name: "Bob",
    });

    const aliceClient = createRouterClient(appRouter, {
      context: createTestContext(db, alice),
    });
    const bobClient = createRouterClient(appRouter, {
      context: createTestContext(db, bob),
    });

    await expect(aliceClient.privateData()).resolves.toMatchObject({
      user: { email: "alice@example.com" },
    });
    await expect(bobClient.privateData()).resolves.toMatchObject({
      user: { email: "bob@example.com" },
    });
  });
});
