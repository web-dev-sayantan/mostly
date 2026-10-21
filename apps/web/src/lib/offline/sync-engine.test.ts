import type { SessionConflict, SessionOp, SessionRecord } from "@mostly/domain";
import { createSessionConflict } from "@mostly/domain";
import { describe, expect, it } from "vite-plus/test";

import type { OfflineStore, SessionSyncResult } from "./store";
import { createMemoryStorage, createOfflineStore } from "./store";
import { backoffDelay, createSyncEngine } from "./sync-engine";

const record = (overrides: Partial<SessionRecord> = {}): SessionRecord => ({
  id: "server-1",
  goalId: "goal-1",
  logicalDate: "2026-10-20",
  minutes: 30,
  note: null,
  mood: null,
  updatedAt: 2000,
  deletedAt: null,
  ...overrides,
});

const emptyResult = (): SessionSyncResult => ({
  applied: [],
  winners: [],
  conflicts: [],
  rejected: [],
});

const emptyResponse = (): Promise<SessionSyncResult> =>
  Promise.resolve(emptyResult());

const setup = () => {
  const clock = { now: 5000 };
  let nextId = 0;
  const store: OfflineStore = createOfflineStore(createMemoryStorage(), {
    now: () => clock.now,
    id: () => {
      nextId += 1;
      return `local-${nextId}`;
    },
  });
  const scheduled: { callback: () => void; delay: number }[] = [];
  const calls: SessionOp[][] = [];
  const state = { online: true };
  let respond: (ops: SessionOp[]) => Promise<SessionSyncResult> = emptyResponse;

  const engine = createSyncEngine({
    store,
    isOnline: () => state.online,
    now: () => clock.now,
    schedule: (callback, delay) => {
      scheduled.push({ callback, delay });
      return scheduled.length as unknown as ReturnType<typeof setTimeout>;
    },
    cancel: () => {},
    server: {
      sync: ({ ops }) => {
        calls.push(ops);
        return respond(ops);
      },
    },
  });

  return {
    store,
    engine,
    clock,
    scheduled,
    calls,
    state,
    respondTo: (next: (ops: SessionOp[]) => Promise<SessionSyncResult>) => {
      respond = next;
    },
  };
};

const queuedOp = (store: OfflineStore): SessionOp => {
  store.markSessionDone({ goalId: "goal-1", logicalDate: "2026-10-20" });
  const [op] = store.getQueue();
  if (!op) {
    throw new Error("expected a queued op");
  }
  return op;
};

describe("sync engine", () => {
  it("never calls the server while offline and keeps the queue", async () => {
    const { store, engine, state, calls } = setup();
    queuedOp(store);
    state.online = false;

    await engine.syncNow();

    expect(calls).toHaveLength(0);
    expect(store.getQueue()).toHaveLength(1);
    expect(engine.getStatus()).toMatchObject({
      state: "offline",
      pendingCount: 1,
    });
  });

  it("replays the queue once and applies the server winner", async () => {
    const { store, engine, calls, respondTo } = setup();
    queuedOp(store);
    respondTo((ops) =>
      Promise.resolve({
        applied: ops.map((op) => op.opId),
        winners: [record({ updatedAt: ops[0]?.updatedAt ?? 0 })],
        conflicts: [],
        rejected: [],
      })
    );

    await engine.syncNow();

    expect(calls).toHaveLength(1);
    expect(store.getQueue()).toHaveLength(0);
    expect(engine.getStatus()).toMatchObject({
      state: "synced",
      pendingCount: 0,
    });
    expect(engine.getStatus().lastSyncedAt).toBe(5000);
    expect(store.getSessions()).toEqual([
      expect.objectContaining({ minutes: 30, pending: false }),
    ]);
  });

  it("coalesces two overlapping sync calls into one replay", async () => {
    const { store, engine, calls, respondTo } = setup();
    queuedOp(store);
    const deferred = Promise.withResolvers<SessionSyncResult>();
    respondTo((ops) => {
      deferred.resolve({
        applied: ops.map((op) => op.opId),
        winners: [],
        conflicts: [],
        rejected: [],
      });
      return deferred.promise;
    });

    const first = engine.syncNow();
    const second = engine.syncNow();
    expect(calls).toHaveLength(1);
    await Promise.all([first, second]);

    expect(calls).toHaveLength(1);
    expect(store.getQueue()).toHaveLength(0);
  });

  it("keeps queued writes on failure and backs off", async () => {
    const { store, engine, scheduled, respondTo } = setup();
    queuedOp(store);
    respondTo(() => Promise.reject(new Error("network down")));

    await engine.syncNow();

    expect(store.getQueue()).toHaveLength(1);
    expect(engine.getStatus()).toMatchObject({
      state: "error",
      pendingCount: 1,
    });
    expect(scheduled.at(-1)?.delay).toBe(backoffDelay(1));
  });

  it("keeps queued writes and prompts on auth expiry without dropping sessions", async () => {
    const { store, engine, scheduled, respondTo, state } = setup();
    queuedOp(store);
    respondTo(() =>
      Promise.reject(
        Object.assign(new Error("Unauthorized"), { code: "UNAUTHORIZED" })
      )
    );

    await engine.syncNow();

    expect(store.getQueue()).toHaveLength(1);
    expect(engine.getStatus()).toMatchObject({
      state: "error",
      pendingCount: 1,
      authExpired: true,
    });
    expect(scheduled).toHaveLength(0);

    state.online = false;
    await engine.syncNow();
    expect(engine.getStatus().state).toBe("offline");
    expect(store.getQueue()).toHaveLength(1);
  });

  it("stores a conflict copy and removes the losing op", async () => {
    const { store, engine, clock, respondTo } = setup();
    const op = queuedOp(store);
    const winner = record();
    const conflict: SessionConflict = createSessionConflict(
      op,
      winner,
      clock.now
    );
    respondTo(() =>
      Promise.resolve({
        applied: [],
        winners: [winner],
        conflicts: [conflict],
        rejected: [],
      })
    );

    await engine.syncNow();

    expect(store.getQueue()).toHaveLength(0);
    expect(engine.getStatus().conflicts).toHaveLength(1);
    expect(engine.getStatus().state).toBe("synced");

    clock.now += 7 * 24 * 60 * 60 * 1000;
    expect(engine.getStatus().conflicts).toHaveLength(0);
  });

  it("drops ops the server rejects for a deleted goal", async () => {
    const { store, engine, respondTo } = setup();
    queuedOp(store);
    respondTo((ops) =>
      Promise.resolve({
        applied: [],
        winners: [],
        conflicts: [],
        rejected: ops.map((op) => ({
          opId: op.opId,
          reason: "goal_deleted" as const,
        })),
      })
    );

    await engine.syncNow();

    expect(store.getQueue()).toHaveLength(0);
    expect(store.getSessions()).toHaveLength(0);
  });

  it("retries pending ops added during an in-flight sync", async () => {
    const { store, engine, scheduled, respondTo } = setup();
    const first = queuedOp(store);
    const deferred = Promise.withResolvers<SessionSyncResult>();
    respondTo((ops) => {
      deferred.resolve({
        applied: ops.map((op) => op.opId),
        winners: [],
        conflicts: [],
        rejected: [],
      });
      return deferred.promise;
    });

    const syncing = engine.syncNow();
    store.markSessionDone({ goalId: "goal-2", logicalDate: "2026-10-20" });
    await syncing;

    expect(store.getQueue()).toHaveLength(1);
    expect(store.getQueue()[0]?.goalId).toBe("goal-2");
    expect(store.getQueue()[0]?.opId).not.toBe(first.opId);
    expect(scheduled.at(-1)?.delay).toBe(0);
  });
});

describe("backoffDelay", () => {
  it("doubles up to a cap", () => {
    expect(backoffDelay(1)).toBe(1000);
    expect(backoffDelay(2)).toBe(2000);
    expect(backoffDelay(3)).toBe(4000);
    expect(backoffDelay(10)).toBe(60_000);
  });
});
