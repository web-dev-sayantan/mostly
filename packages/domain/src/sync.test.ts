import { describe, expect, it } from "vite-plus/test";

import type { SessionGoal, SessionOp, SessionRecord } from "./sync";
import {
  CONFLICT_TTL_MS,
  createSessionConflict,
  pruneExpiredConflicts,
  rejectSessionOp,
  resolveSessionOp,
} from "./sync";

const goal: SessionGoal = {
  startDate: "2026-10-01",
  archivedOn: null,
  deletedAt: null,
};

const upsert = (overrides: Partial<SessionOp> = {}): SessionOp => ({
  opId: "op-1",
  id: "session-1",
  goalId: "goal-1",
  logicalDate: "2026-10-20",
  minutes: 30,
  note: "Read a chapter",
  mood: "great",
  updatedAt: 1000,
  deleted: false,
  ...overrides,
});

const remove = (overrides: Partial<SessionOp> = {}): SessionOp =>
  upsert({
    opId: "op-del",
    deleted: true,
    minutes: null,
    note: null,
    mood: null,
    ...overrides,
  });

describe("resolveSessionOp", () => {
  it("applies an op shape to a new session", () => {
    const result = resolveSessionOp(null, upsert());

    expect(result.outcome).toBe("applied");
    if (result.outcome !== "applied") {
      throw new Error("expected an applied op");
    }

    expect(result.session).toEqual<SessionRecord>({
      id: "session-1",
      goalId: "goal-1",
      logicalDate: "2026-10-20",
      minutes: 30,
      note: "Read a chapter",
      mood: "great",
      updatedAt: 1000,
      deletedAt: null,
    });
  });

  it("replaying the same op twice leaves one session", () => {
    const op = upsert();
    const first = resolveSessionOp(null, op);
    if (first.outcome !== "applied") {
      throw new Error("expected the first replay to apply");
    }

    const second = resolveSessionOp(first.session, op);

    expect(second.outcome).toBe("ignored");
    expect(second.winner).toEqual(first.session);
  });

  it("resolves last-write-wins by client updatedAt", () => {
    const first = resolveSessionOp(
      null,
      upsert({ minutes: 10, updatedAt: 1000 })
    );
    if (first.outcome !== "applied") {
      throw new Error("expected the first write to apply");
    }

    const fresh = resolveSessionOp(
      first.session,
      upsert({ opId: "op-2", minutes: 45, note: "Later", updatedAt: 2000 })
    );

    if (fresh.outcome !== "applied") {
      throw new Error("expected the newer write to apply");
    }
    expect(fresh.session).toMatchObject({
      minutes: 45,
      note: "Later",
      updatedAt: 2000,
    });
  });

  it("keeps the server winner when a stale edit loses", () => {
    const server = resolveSessionOp(
      null,
      upsert({
        opId: "op-server",
        minutes: 45,
        note: "Server",
        updatedAt: 2000,
      })
    );
    if (server.outcome !== "applied") {
      throw new Error("expected the server write to apply");
    }

    const stale = resolveSessionOp(
      server.session,
      upsert({ opId: "op-local", minutes: 5, note: "Local", updatedAt: 1000 })
    );

    expect(stale.outcome).toBe("conflict");
    expect(stale.winner).toMatchObject({ minutes: 45, note: "Server" });
    if (stale.outcome !== "conflict") {
      throw new Error("expected a conflict");
    }
    expect(stale.local).toMatchObject({
      opId: "op-local",
      minutes: 5,
      note: "Local",
    });
  });

  it("does not resurrect a deleted session with a stale upsert", () => {
    const created = resolveSessionOp(null, upsert({ updatedAt: 1000 }));
    if (created.outcome !== "applied") {
      throw new Error("expected the session to be created");
    }

    const deleted = resolveSessionOp(
      created.session,
      remove({ updatedAt: 2000 })
    );
    if (deleted.outcome !== "applied") {
      throw new Error("expected the delete to apply");
    }
    expect(deleted.session.deletedAt).toBe(2000);

    const stale = resolveSessionOp(
      deleted.session,
      upsert({ updatedAt: 1500 })
    );

    expect(stale.outcome).toBe("conflict");
    expect(stale.winner.deletedAt).toBe(2000);
  });

  it("treats a replayed delete as one effect", () => {
    const created = resolveSessionOp(null, upsert({ updatedAt: 1000 }));
    if (created.outcome !== "applied") {
      throw new Error("expected the session to be created");
    }
    const deleted = resolveSessionOp(
      created.session,
      remove({ updatedAt: 2000 })
    );
    if (deleted.outcome !== "applied") {
      throw new Error("expected the delete to apply");
    }

    const replay = resolveSessionOp(
      deleted.session,
      remove({ updatedAt: 2000 })
    );

    expect(replay.outcome).toBe("ignored");
    expect(replay.winner.deletedAt).toBe(2000);
  });

  it("lets an explicit later edit restore a deleted session", () => {
    const deleted = resolveSessionOp(null, remove({ updatedAt: 2000 }));
    if (deleted.outcome !== "applied") {
      throw new Error("expected the tombstone to be created");
    }

    const restored = resolveSessionOp(
      deleted.session,
      upsert({ updatedAt: 3000 })
    );

    if (restored.outcome !== "applied") {
      throw new Error("expected the later edit to restore the session");
    }
    expect(restored.session).toMatchObject({ deletedAt: null, minutes: 30 });
  });
});

describe("rejectSessionOp", () => {
  const op = upsert();

  it("rejects writes for a deleted goal", () => {
    expect(rejectSessionOp(op, { ...goal, deletedAt: 5 })).toBe("goal_deleted");
  });

  it("rejects writes before the goal starts", () => {
    expect(rejectSessionOp({ ...op, logicalDate: "2026-09-30" }, goal)).toBe(
      "before_start"
    );
  });

  it("rejects writes after the goal is archived", () => {
    expect(rejectSessionOp(op, { ...goal, archivedOn: "2026-10-19" })).toBe(
      "after_archive"
    );
  });

  it("accepts the archive day and dates inside the goal", () => {
    const archived = { ...goal, archivedOn: "2026-10-20" };

    expect(rejectSessionOp(op, archived)).toBeNull();
    expect(
      rejectSessionOp({ ...op, logicalDate: "2026-10-01" }, goal)
    ).toBeNull();
  });

  it("treats an unknown goal as rejected", () => {
    expect(rejectSessionOp(op, null)).toBe("goal_not_found");
  });
});

describe("session conflicts", () => {
  it("keeps the losing edit for seven days", () => {
    const local = upsert({ opId: "op-local", minutes: 5, updatedAt: 1000 });
    const winner: SessionRecord = {
      id: "session-1",
      goalId: "goal-1",
      logicalDate: "2026-10-20",
      minutes: 45,
      note: "Server",
      mood: "meh",
      updatedAt: 2000,
      deletedAt: null,
    };
    const now = 10_000;

    const conflict = createSessionConflict(local, winner, now);

    expect(conflict).toMatchObject({
      opId: "op-local",
      detectedAt: now,
      expiresAt: now + CONFLICT_TTL_MS,
      local: { minutes: 5, updatedAt: 1000 },
      server: { minutes: 45, updatedAt: 2000 },
    });
    expect(
      pruneExpiredConflicts([conflict], now + CONFLICT_TTL_MS - 1)
    ).toHaveLength(1);
    expect(
      pruneExpiredConflicts([conflict], now + CONFLICT_TTL_MS)
    ).toHaveLength(0);
  });
});
