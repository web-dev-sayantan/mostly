import type { SessionConflict, SessionOp } from "@mostly/domain";

import type { OfflineStore, SessionSyncResult } from "./store";

export type SyncState = "offline" | "pending" | "synced" | "error";

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: number | null;
  pendingCount: number;
  conflicts: SessionConflict[];
  authExpired: boolean;
  accountDeleted: boolean;
  retry: () => void;
}

export interface SessionSyncServer {
  sync: (input: { ops: SessionOp[] }) => Promise<SessionSyncResult>;
}

export type SyncTimer = ReturnType<typeof setTimeout>;

export interface SyncEngineOptions {
  store: OfflineStore;
  server: SessionSyncServer;
  now?: () => number;
  isOnline?: () => boolean;
  schedule?: (callback: () => void, delayMs: number) => SyncTimer;
  cancel?: (timer: SyncTimer) => void;
  /** True when the server has a tombstone for the bound account. */
  checkAccountDeleted?: () => Promise<boolean>;
  /** Clear app-level caches after the store has been wiped. */
  onAccountDeleted?: () => void;
}

export interface SyncEngine {
  syncNow: () => Promise<void>;
  retry: () => void;
  refresh: () => void;
  getStatus: () => SyncStatus;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
}

const noopSync = (): Promise<void> => Promise.resolve();

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 60_000;

export const backoffDelay = (
  attempt: number,
  baseMs = BASE_DELAY_MS,
  maxMs = MAX_DELAY_MS
): number => Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));

const isUnauthorized = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as {
    code?: unknown;
    status?: unknown;
    data?: { httpStatus?: unknown };
  };
  return (
    candidate.code === "UNAUTHORIZED" ||
    candidate.status === 401 ||
    candidate.data?.httpStatus === 401
  );
};

export const createSyncEngine = ({
  store,
  server,
  now = Date.now,
  isOnline = () => true,
  schedule = (callback, delayMs) => setTimeout(callback, delayMs),
  cancel = (timer) => clearTimeout(timer),
  checkAccountDeleted,
  onAccountDeleted,
}: SyncEngineOptions): SyncEngine => {
  const listeners = new Set<() => void>();
  let inFlight: Promise<void> | null = null;
  let retryTimer: SyncTimer | null = null;
  let attempt = 0;
  let lastError = false;
  let authExpired = false;
  let accountDeleted = false;
  let syncing = false;
  let syncNow: () => Promise<void> = noopSync;

  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const clearRetry = (): void => {
    if (retryTimer !== null) {
      cancel(retryTimer);
      retryTimer = null;
    }
  };

  const scheduleRetry = (): void => {
    clearRetry();
    const delay = backoffDelay(attempt);
    attempt += 1;
    retryTimer = schedule(() => {
      retryTimer = null;
      void syncNow();
    }, delay);
  };

  const retry = (): void => {
    attempt = 0;
    clearRetry();
    void syncNow();
  };

  const run = async (): Promise<void> => {
    const ops = store.getQueue();
    if (ops.length === 0) {
      syncing = false;
      notify();
      return;
    }

    syncing = true;
    notify();

    try {
      const result = await server.sync({ ops });
      store.applySyncResult(result, now());
      lastError = false;
      authExpired = false;
      accountDeleted = false;
      attempt = 0;
      syncing = false;
      notify();

      if (store.getQueue().length > 0) {
        clearRetry();
        retryTimer = schedule(() => {
          retryTimer = null;
          void syncNow();
        }, 0);
      }
    } catch (error) {
      if (isUnauthorized(error)) {
        const deleted = checkAccountDeleted
          ? await checkAccountDeleted().catch(() => false)
          : false;
        if (deleted) {
          // The account is gone: the queue can never replay, so discard it and
          // every local cache instead of prompting for a session that expired.
          store.clear();
          onAccountDeleted?.();
          accountDeleted = true;
          authExpired = false;
          lastError = false;
          attempt = 0;
          syncing = false;
          clearRetry();
          notify();
          return;
        }
      }

      lastError = true;
      authExpired = isUnauthorized(error);
      syncing = false;
      notify();
      if (!authExpired) {
        scheduleRetry();
      }
    }
  };

  syncNow = async (): Promise<void> => {
    if (!isOnline()) {
      notify();
      return;
    }
    if (inFlight) {
      await inFlight;
      return;
    }

    inFlight = run();
    try {
      await inFlight;
    } finally {
      inFlight = null;
    }
  };

  return {
    syncNow,
    retry,
    refresh: notify,
    getStatus() {
      const queue = store.getQueue();
      const conflicts = store.getConflicts();
      let state: SyncState = "synced";
      if (!isOnline()) {
        state = "offline";
      } else if (lastError && queue.length > 0) {
        state = "error";
      } else if (queue.length > 0 || syncing) {
        state = "pending";
      }

      return {
        state,
        lastSyncedAt: store.getLastSyncedAt(),
        pendingCount: queue.length,
        conflicts,
        authExpired,
        accountDeleted: accountDeleted && store.getUserId() === null,
        retry,
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      clearRetry();
      listeners.clear();
    },
  };
};
