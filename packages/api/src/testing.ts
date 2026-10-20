import type { Session } from "@mostly/auth";
import type { Database } from "@mostly/db";
import { authSession, user } from "@mostly/db/schema/auth";

import type { Context } from "./context";

/** Insert a real user and session row, returning the context session a sign-in would produce. */
export const createTestUser = async (
  db: Database,
  overrides: { email?: string; name?: string } = {},
): Promise<Session> => {
  const now = new Date();
  const id = crypto.randomUUID();
  const sessionLifetimeMs = 24 * 60 * 60 * 1000;

  const [createdUser] = await db
    .insert(user)
    .values({
      id,
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `${id}@example.com`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [createdSession] = await db
    .insert(authSession)
    .values({
      id: crypto.randomUUID(),
      token: crypto.randomUUID(),
      userId: id,
      expiresAt: new Date(now.getTime() + sessionLifetimeMs),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!(createdUser && createdSession)) {
    throw new Error("Failed to create test user");
  }

  return { user: createdUser, session: createdSession };
};

export const createTestContext = (db: Database, session: Session | null): Context => ({
  db,
  session,
});
