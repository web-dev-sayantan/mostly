import type { Mood, SessionRecord } from "@mostly/domain";
import { CONFLICT_TTL_MS, createSessionConflict } from "@mostly/domain";
import { describe, expect, it } from "vite-plus/test";

import type { OfflineStore, StorageLike } from "./store";
import { createOfflineStore } from "./store";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const record = (overrides: Partial<SessionRecord> = {}): SessionRecord => ({
  id: "server-1",
  goalId: "goal-1",
  logicalDate: "2026-10-20",
  minutes: 30,
  note: "Server note",
  mood: "great" as Mood,
  updatedAt: 2000,
  deletedAt: null,
  ...overrides,
});

const createStore = (clockArgument?: {
  now: number;
}): { store: OfflineStore; clock: { now: number } } => {
  const clock = clockArgument ?? { now: 1000 };
  let nextId = 0;
  const store = createOfflineStore(new MemoryStorage(), {
    now: () => clock.now,
    id: () => {
      nextId += 1;
      return `local-${nextId}`;
    },
  });
  return { store, clock };
};

describe("offline store", () => {
  it("writes a done tap locally and queues one op", () => {
    const { store } = createStore();

    const session = store.markSessionDone({
      goalId: "goal-1",
      logicalDate: "2026-10-20",
    });

    expect(session).toMatchObject({
      goalId: "goal-1",
      logicalDate: "2026-10-20",
      minutes: null,
      note: null,
      mood: null,
      pending: true,
    });
    expect(store.getSessions()).toHaveLength(1);
    expect(store.getQueue()).toHaveLength(1);
    expect(store.getQueue()[0]).toMatchObject({
      goalId: "goal-1",
      logicalDate: "2026-10-20",
      minutes: null,
      note: null,
      mood: null,
      updatedAt: 1000,
      deleted: false,
    });
  });

  it("keeps a duplicate done tap to one session and one op", () => {
    const { store } = createStore();

    const first = store.markSessionDone({
      goalId: "goal-1",
      logicalDate: "2026-10-20",
    });
    const second = store.markSessionDone({
      goalId: "goal-1",
      logicalDate: "2026-10-20",
    });

    expect(second.id).toBe(first.id);
    expect(store.getSessions()).toHaveLength(1);
    expect(store.getQueue()).toHaveLength(1);
  });

  it("updates the local session and replaces the older queued op", () => {
    const { store, clock } = createStore();
    const session = store.markSessionDone({
      goalId: "goal-1",
      logicalDate: "2026-10-20",
    });

    clock.now = 2000;
    const updated = store.updateLocalSession(session.id, {
      minutes: 30,
      note: "x".repeat(600),
      mood: "great",
    });

    expect(updated).toMatchObject({
      minutes: 30,
      note: "x".repeat(500),
      mood: "great",
    });
    expect(store.getQueue()).toHaveLength(1);
    expect(store.getQueue()[0]).toMatchObject({ minutes: 30, updatedAt: 2000 });
  });

  it("keeps edits monotonic when the clock has not moved", () => {
    const { store } = createStore();
    const session = store.markSessionDone({
      goalId: "goal-1",
      logicalDate: "2026-10-20",
    });

    store.updateLocalSession(session.id, { minutes: 10 });

    expect(store.getQueue()[0]?.updatedAt).toBe(1001);
  });

  it("clamps minutes into 0-1440", () => {
    const { store } = createStore();
    const session = store.markSessionDone({
      goalId: "goal-1",
      logicalDate: "2026-10-20",
    });

    expect(
      store.updateLocalSession(session.id, { minutes: 2000 })?.minutes
    ).toBe(1440);
    expect(store.updateLocalSession(session.id, { minutes: -1 })?.minutes).toBe(
      0
    );
  });

  it("removes a deleted session and queues a tombstone", () => {
    const { store, clock } = createStore();
    const session = store.markSessionDone({
      goalId: "goal-1",
      logicalDate: "2026-10-20",
    });

    clock.now = 3000;
    expect(store.deleteLocalSession(session.id)).toBe(true);

    expect(store.getSessions()).toHaveLength(0);
    expect(store.getQueue()).toHaveLength(1);
    expect(store.getQueue()[0]).toMatchObject({
      deleted: true,
      updatedAt: 3000,
    });
  });

  it("survives a reload from storage", () => {
    const storage = new MemoryStorage();
    const first = createOfflineStore(storage, {
      now: () => 1000,
      id: () => "local-1",
    });
    first.markSessionDone({ goalId: "goal-1", logicalDate: "2026-10-20" });

    const second = createOfflineStore(storage, {
      now: () => 2000,
      id: () => "local-2",
    });

    expect(second.getSessions()).toHaveLength(1);
    expect(second.getQueue()).toHaveLength(1);
  });

  it("hydrates server sessions without dropping a pending local write", () => {
    const { store } = createStore();
    store.markSessionDone({ goalId: "goal-1", logicalDate: "2026-10-20" });

    store.cacheServerSessions([
      record({ id: "server-2", goalId: "goal-2", logicalDate: "2026-10-19" }),
      record(),
    ]);

    const sessions = store.getSessions();
    expect(sessions).toHaveLength(2);
    expect(
      sessions.find((session) => session.goalId === "goal-1")
    ).toMatchObject({
      minutes: null,
      pending: true,
    });
    expect(
      sessions.find((session) => session.goalId === "goal-2")
    ).toMatchObject({
      minutes: 30,
      pending: false,
    });
  });

  it("applies a sync result, clears sent ops, and records the sync time", () => {
    const { store } = createStore();
    store.markSessionDone({ goalId: "goal-1", logicalDate: "2026-10-20" });
    const [op] = store.getQueue();
    if (!op) {
      throw new Error("expected a queued op");
    }

    store.applySyncResult(
      {
        applied: [op.opId],
        winners: [record({ updatedAt: op.updatedAt })],
        conflicts: [],
        rejected: [],
      },
      5000
    );

    expect(store.getQueue()).toHaveLength(0);
    expect(store.getLastSyncedAt()).toBe(5000);
    expect(store.getSessions()).toEqual([
      expect.objectContaining({
        minutes: 30,
        note: "Server note",
        pending: false,
      }),
    ]);
  });

  it("keeps a newer local edit that lands while a sync is in flight", () => {
    const { store, clock } = createStore();
    const session = store.markSessionDone({
      goalId: "goal-1",
      logicalDate: "2026-10-20",
    });
    const [sent] = store.getQueue();
    if (!sent) {
      throw new Error("expected a queued op");
    }
    clock.now = 2000;
    store.updateLocalSession(session.id, { minutes: 45 });

    store.applySyncResult(
      {
        applied: [sent.opId],
        winners: [
          record({ minutes: 30, updatedAt: sent.updatedAt, deletedAt: null }),
        ],
        conflicts: [],
        rejected: [],
      },
      3000
    );

    expect(store.getSessions()).toEqual([
      expect.objectContaining({ minutes: 45, pending: true }),
    ]);
    expect(store.getQueue()).toHaveLength(1);
  });

  it("removes optimistic rows whose op the server rejected", () => {
    const { store } = createStore();
    store.markSessionDone({ goalId: "goal-1", logicalDate: "2026-10-20" });
    const [op] = store.getQueue();
    if (!op) {
      throw new Error("expected a queued op");
    }

    store.applySyncResult(
      {
        applied: [],
        winners: [],
        conflicts: [],
        rejected: [{ opId: op.opId, reason: "goal_deleted" }],
      },
      2000
    );

    expect(store.getSessions()).toHaveLength(0);
    expect(store.getQueue()).toHaveLength(0);
  });

  it("keeps conflict copies for seven days", () => {
    const { store, clock } = createStore();
    const conflict = createSessionConflict(
      {
        opId: "op-1",
        id: "local-1",
        goalId: "goal-1",
        logicalDate: "2026-10-20",
        minutes: 5,
        note: null,
        mood: null,
        updatedAt: 1000,
        deleted: false,
      },
      record(),
      1000
    );

    store.applySyncResult(
      { applied: [], winners: [record()], conflicts: [conflict], rejected: [] },
      1000
    );
    expect(store.getConflicts()).toHaveLength(1);

    clock.now = 1000 + CONFLICT_TTL_MS - 1;
    expect(store.getConflicts()).toHaveLength(1);

    clock.now = 1000 + CONFLICT_TTL_MS;
    expect(store.getConflicts()).toHaveLength(0);
  });

  it("keeps queued writes for the same account across auth expiry", () => {
    const { store } = createStore();
    store.bindUser("alice");
    store.markSessionDone({ goalId: "goal-1", logicalDate: "2026-10-20" });

    expect(store.bindUser("alice")).toBe(false);
    expect(store.getQueue()).toHaveLength(1);
    expect(store.getSessions()).toHaveLength(1);
  });

  it("clears cached data when a different account signs in", () => {
    const storage = new MemoryStorage();
    const first = createOfflineStore(storage, {
      now: () => 1000,
      id: () => "local-1",
    });
    first.bindUser("alice");
    first.markSessionDone({ goalId: "goal-1", logicalDate: "2026-10-20" });
    first.applySyncResult(
      { applied: [], winners: [record()], conflicts: [], rejected: [] },
      2000
    );

    const second = createOfflineStore(storage, {
      now: () => 3000,
      id: () => "local-2",
    });
    expect(second.bindUser("alice")).toBe(false);
    expect(second.getQueue()).toHaveLength(1);
    expect(second.getSessions()).toHaveLength(1);

    // A deleted account signs back in as a new user id, so its old queue goes.
    expect(second.bindUser("bob")).toBe(true);
    expect(second.getQueue()).toHaveLength(0);
    expect(second.getSessions()).toHaveLength(0);
    expect(second.getLastSyncedAt()).toBeNull();
  });

  it("adopts a device with cached data but no bound account", () => {
    const { store } = createStore();
    store.markSessionDone({ goalId: "goal-1", logicalDate: "2026-10-20" });

    expect(store.bindUser("alice")).toBe(false);
    expect(store.getQueue()).toHaveLength(1);
  });
});
