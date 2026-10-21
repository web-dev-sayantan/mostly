export const MOODS = ["great", "meh", "rough"] as const;

export type Mood = (typeof MOODS)[number];

/** One durable client write. `opId` makes replay idempotent. */
export interface SessionOp {
  opId: string;
  id: string;
  goalId: string;
  logicalDate: string;
  minutes: number | null;
  note: string | null;
  mood: Mood | null;
  /** Client edit time in epoch milliseconds. */
  updatedAt: number;
  deleted: boolean;
}

/** The server's live row (or tombstone) for a goal and logical date. */
export interface SessionRecord {
  id: string;
  goalId: string;
  logicalDate: string;
  minutes: number | null;
  note: string | null;
  mood: Mood | null;
  updatedAt: number;
  deletedAt: number | null;
}

export interface SessionGoal {
  startDate: string;
  archivedOn: string | null;
  deletedAt: number | null;
}

export type SyncRejection =
  | "goal_not_found"
  | "goal_deleted"
  | "before_start"
  | "after_archive";

export const CONFLICT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionConflict {
  opId: string;
  sessionId: string;
  goalId: string;
  logicalDate: string;
  local: SessionOp;
  server: SessionRecord;
  detectedAt: number;
  expiresAt: number;
}

export type SessionResolution =
  | { outcome: "applied"; session: SessionRecord; winner: SessionRecord }
  | { outcome: "ignored"; winner: SessionRecord }
  | { outcome: "conflict"; winner: SessionRecord; local: SessionOp };

/** Reject writes that fall outside the goal's life, before touching a row. */
export const rejectSessionOp = (
  op: SessionOp,
  goal: SessionGoal | null | undefined
): SyncRejection | null => {
  if (!goal) {
    return "goal_not_found";
  }
  if (goal.deletedAt !== null) {
    return "goal_deleted";
  }
  if (op.logicalDate < goal.startDate) {
    return "before_start";
  }
  if (goal.archivedOn !== null && op.logicalDate > goal.archivedOn) {
    return "after_archive";
  }
  return null;
};

const sameContent = (winner: SessionRecord, op: SessionOp): boolean =>
  winner.deletedAt === null &&
  winner.minutes === op.minutes &&
  winner.note === op.note &&
  winner.mood === op.mood;

const sameWrite = (winner: SessionRecord, op: SessionOp): boolean =>
  op.deleted ? winner.deletedAt !== null : sameContent(winner, op);

const winsByTimestamp = (winner: SessionRecord, op: SessionOp): boolean =>
  op.updatedAt > winner.updatedAt ||
  (op.updatedAt === winner.updatedAt && op.id > winner.id);

/**
 * Resolve one client op against the latest stored row. Pure and deterministic:
 * newer client timestamps win, tombstones stay put against stale upserts, and a
 * losing edit is returned as a conflict instead of being discarded.
 */
export const resolveSessionOp = (
  current: SessionRecord | null,
  op: SessionOp
): SessionResolution => {
  if (!current) {
    const session: SessionRecord = {
      id: op.id,
      goalId: op.goalId,
      logicalDate: op.logicalDate,
      minutes: op.deleted ? null : op.minutes,
      note: op.deleted ? null : op.note,
      mood: op.deleted ? null : op.mood,
      updatedAt: op.updatedAt,
      deletedAt: op.deleted ? op.updatedAt : null,
    };
    return { outcome: "applied", session, winner: session };
  }

  if (sameWrite(current, op)) {
    return { outcome: "ignored", winner: current };
  }

  if (op.deleted && current.deletedAt !== null) {
    return { outcome: "ignored", winner: current };
  }

  if (!winsByTimestamp(current, op)) {
    return { outcome: "conflict", winner: current, local: op };
  }

  const session: SessionRecord = {
    ...current,
    minutes: op.deleted ? current.minutes : op.minutes,
    note: op.deleted ? current.note : op.note,
    mood: op.deleted ? current.mood : op.mood,
    updatedAt: op.updatedAt,
    deletedAt: op.deleted ? op.updatedAt : null,
  };

  return { outcome: "applied", session, winner: session };
};

export const createSessionConflict = (
  local: SessionOp,
  server: SessionRecord,
  now: number
): SessionConflict => ({
  opId: local.opId,
  sessionId: server.id,
  goalId: local.goalId,
  logicalDate: local.logicalDate,
  local,
  server,
  detectedAt: now,
  expiresAt: now + CONFLICT_TTL_MS,
});

export const pruneExpiredConflicts = <T extends { expiresAt: number }>(
  conflicts: readonly T[],
  now: number
): T[] => conflicts.filter((conflict) => conflict.expiresAt > now);
