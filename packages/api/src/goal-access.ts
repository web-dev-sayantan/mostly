import type { Database } from "@mostly/db";
import { goal } from "@mostly/db/schema/goals";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";

/** The goal row only when it is live and belongs to the signed-in user. */
export const findOwnedGoal = async (
  db: Database,
  userId: string,
  goalId: string
) => {
  const [row] = await db
    .select()
    .from(goal)
    .where(
      and(eq(goal.id, goalId), eq(goal.userId, userId), isNull(goal.deletedAt))
    )
    .limit(1);

  return row ?? null;
};

/**
 * Gate for writes that reference a goal, including replayed session writes.
 * A deleted goal and another user's goal are both NOT_FOUND.
 */
export const requireWritableGoal = async (
  db: Database,
  userId: string,
  goalId: string
) => {
  const row = await findOwnedGoal(db, userId, goalId);

  if (!row) {
    throw new ORPCError("NOT_FOUND");
  }

  return row;
};

const hasSessionTable = async (db: Database) =>
  Boolean(
    await db.get<{ name: string }>(
      sql`select name from sqlite_master where type = 'table' and name = 'session'`
    )
  );

/**
 * The sessions table belongs to ticket 5. Until it exists this is 0, and it
 * starts counting without changes once that migration is merged.
 */
export const countGoalSessions = async (
  db: Database,
  goalId: string
): Promise<number> => {
  if (!(await hasSessionTable(db))) {
    return 0;
  }

  const row = await db.get<{ count: number }>(
    sql`select count(*) as count from session where goal_id = ${goalId} and deleted_at is null`
  );

  return Number(row?.count ?? 0);
};

/** Tombstone the goal's sessions so a queued write cannot resurrect them. */
export const tombstoneGoalSessions = async (
  db: Database,
  goalId: string,
  now: Date
) => {
  if (!(await hasSessionTable(db))) {
    return;
  }

  await db.run(
    sql`update session set deleted_at = ${now.getTime()}, updated_at = ${now.getTime()} where goal_id = ${goalId} and deleted_at is null`
  );
};
