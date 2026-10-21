import type {
  Mood,
  SessionConflict,
  SessionOp,
  SessionRecord,
  SyncRejection,
} from "@mostly/domain";
import { MOODS, pruneExpiredConflicts } from "@mostly/domain";

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

/** Every key this device owns. Sign-out and account deletion clear these. */
export const OFFLINE_STORAGE_KEYS = {
  sessions: "mostly:sessions",
  queue: "mostly:session-queue",
  conflicts: "mostly:sync-conflicts",
  meta: "mostly:sync-meta",
  days: "mostly:day-cache",
} as const;

export interface LocalSession {
  id: string;
  goalId: string;
  logicalDate: string;
  minutes: number | null;
  note: string | null;
  mood: Mood | null;
  updatedAt: number;
  pending: boolean;
}

type StoredSession = Omit<LocalSession, "pending">;

export interface RejectedSessionOp {
  opId: string;
  reason: SyncRejection;
}

/** The server's answer to one replay batch. */
export interface SessionSyncResult {
  applied: string[];
  winners: SessionRecord[];
  conflicts: SessionConflict[];
  rejected: RejectedSessionOp[];
}

export interface OfflineStore {
  markSessionDone: (input: {
    goalId: string;
    logicalDate: string;
  }) => LocalSession;
  updateLocalSession: (
    id: string,
    patch: { minutes?: number | null; note?: string | null; mood?: Mood | null }
  ) => LocalSession | null;
  deleteLocalSession: (id: string) => boolean;
  getSessions: () => LocalSession[];
  getQueue: () => SessionOp[];
  getConflicts: () => SessionConflict[];
  getLastSyncedAt: () => number | null;
  cacheServerSessions: (records: SessionRecord[]) => void;
  applySyncResult: (result: SessionSyncResult, syncedAt: number) => void;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
}

export interface OfflineStoreOptions {
  now?: () => number;
  id?: () => string;
}

const MAX_MINUTES = 1440;
const MAX_NOTE_LENGTH = 500;

const sessionKey = (goalId: string, logicalDate: string): string =>
  `${goalId}:${logicalDate}`;

const readJson = <T>(storage: StorageLike, key: string, fallback: T): T => {
  try {
    const value = storage.getItem(key);
    return value === null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
};

const writeJson = (storage: StorageLike, key: string, value: unknown): void => {
  try {
    // shortcut: localStorage holds roughly 5 MB and throws in private mode; move
    // the session cache to IndexedDB if note-heavy history outgrows it.
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // The in-memory store still serves this session; the next open re-reads storage.
  }
};

const isMood = (value: unknown): value is Mood => MOODS.includes(value as Mood);

const resolveMood = (
  value: Mood | null | undefined,
  fallback: Mood | null
): Mood | null => {
  if (value === undefined) {
    return fallback;
  }
  return isMood(value) ? value : null;
};

const clampMinutes = (value: number | null): number | null => {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(MAX_MINUTES, Math.max(0, Math.trunc(value)));
};

const clampNote = (value: string | null): string | null =>
  value === null ? null : value.slice(0, MAX_NOTE_LENGTH);

const fromOp = (op: SessionOp): StoredSession => ({
  id: op.id,
  goalId: op.goalId,
  logicalDate: op.logicalDate,
  minutes: op.deleted ? null : op.minutes,
  note: op.deleted ? null : op.note,
  mood: op.deleted ? null : op.mood,
  updatedAt: op.updatedAt,
});

const sortSessions = (sessions: StoredSession[]): StoredSession[] =>
  sessions.toSorted(
    (a, b) =>
      a.logicalDate.localeCompare(b.logicalDate) ||
      a.goalId.localeCompare(b.goalId)
  );

export const createOfflineStore = (
  storage: StorageLike,
  { now = Date.now, id = () => crypto.randomUUID() }: OfflineStoreOptions = {}
): OfflineStore => {
  let sessions = readJson<StoredSession[]>(
    storage,
    OFFLINE_STORAGE_KEYS.sessions,
    []
  );
  let queue = readJson<SessionOp[]>(storage, OFFLINE_STORAGE_KEYS.queue, []);
  let conflicts = readJson<SessionConflict[]>(
    storage,
    OFFLINE_STORAGE_KEYS.conflicts,
    []
  );
  let meta = readJson<{ lastSyncedAt: number | null }>(
    storage,
    OFFLINE_STORAGE_KEYS.meta,
    {
      lastSyncedAt: null,
    }
  );
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const persistSessions = (): void =>
    writeJson(storage, OFFLINE_STORAGE_KEYS.sessions, sessions);
  const persistQueue = (): void =>
    writeJson(storage, OFFLINE_STORAGE_KEYS.queue, queue);
  const persistConflicts = (): void =>
    writeJson(storage, OFFLINE_STORAGE_KEYS.conflicts, conflicts);
  const persistMeta = (): void =>
    writeJson(storage, OFFLINE_STORAGE_KEYS.meta, meta);

  const pendingKeys = (): Set<string> =>
    new Set(queue.map((op) => sessionKey(op.goalId, op.logicalDate)));

  const findStored = (sessionId: string): StoredSession | undefined =>
    sessions.find((session) => session.id === sessionId);

  const findByKey = (
    goalId: string,
    logicalDate: string
  ): StoredSession | undefined =>
    sessions.find(
      (session) =>
        session.goalId === goalId && session.logicalDate === logicalDate
    );

  const putStored = (session: StoredSession): void => {
    sessions = sessions.filter(
      (current) =>
        current.id !== session.id &&
        sessionKey(current.goalId, current.logicalDate) !==
          sessionKey(session.goalId, session.logicalDate)
    );
    sessions.push(session);
    sessions = sortSessions(sessions);
  };

  const removeKey = (goalId: string, logicalDate: string): void => {
    sessions = sessions.filter(
      (session) =>
        sessionKey(session.goalId, session.logicalDate) !==
        sessionKey(goalId, logicalDate)
    );
  };

  const enqueue = (op: SessionOp): void => {
    queue = queue.filter(
      (current) =>
        sessionKey(current.goalId, current.logicalDate) !==
        sessionKey(op.goalId, op.logicalDate)
    );
    queue.push(op);
    persistQueue();
  };

  const overlayPending = (): void => {
    for (const op of queue) {
      if (op.deleted) {
        removeKey(op.goalId, op.logicalDate);
      } else {
        putStored(fromOp(op));
      }
    }
  };

  const sessionOp = (session: StoredSession, deleted: boolean): SessionOp => ({
    opId: id(),
    id: session.id,
    goalId: session.goalId,
    logicalDate: session.logicalDate,
    minutes: session.minutes,
    note: session.note,
    mood: session.mood,
    updatedAt: session.updatedAt,
    deleted,
  });

  const nextUpdatedAt = (previous: number): number =>
    Math.max(now(), previous + 1);

  return {
    markSessionDone({ goalId, logicalDate }) {
      const existing = findByKey(goalId, logicalDate);
      if (existing) {
        return {
          ...existing,
          pending: pendingKeys().has(sessionKey(goalId, logicalDate)),
        };
      }

      const session: StoredSession = {
        id: id(),
        goalId,
        logicalDate,
        minutes: null,
        note: null,
        mood: null,
        updatedAt: now(),
      };

      putStored(session);
      persistSessions();
      enqueue(sessionOp(session, false));
      notify();

      return { ...session, pending: true };
    },

    updateLocalSession(idToUpdate, patch) {
      const current = findStored(idToUpdate);
      if (!current) {
        return null;
      }

      const next: StoredSession = {
        ...current,
        minutes:
          patch.minutes === undefined
            ? current.minutes
            : clampMinutes(patch.minutes),
        note: patch.note === undefined ? current.note : clampNote(patch.note),
        mood: resolveMood(patch.mood, current.mood),
        updatedAt: nextUpdatedAt(current.updatedAt),
      };

      putStored(next);
      persistSessions();
      enqueue(sessionOp(next, false));
      notify();

      return { ...next, pending: true };
    },

    deleteLocalSession(idToDelete) {
      const current = findStored(idToDelete);
      if (!current) {
        return false;
      }

      const deleted: StoredSession = {
        ...current,
        updatedAt: nextUpdatedAt(current.updatedAt),
      };
      enqueue(sessionOp(deleted, true));
      removeKey(current.goalId, current.logicalDate);
      persistSessions();
      notify();

      return true;
    },

    getSessions() {
      const pending = pendingKeys();
      return sessions.map((session) => ({
        ...session,
        pending: pending.has(sessionKey(session.goalId, session.logicalDate)),
      }));
    },

    getQueue() {
      return [...queue];
    },

    getConflicts() {
      const live = pruneExpiredConflicts(conflicts, now());
      if (live.length !== conflicts.length) {
        conflicts = live;
        persistConflicts();
      }
      return [...conflicts];
    },

    getLastSyncedAt() {
      return meta.lastSyncedAt;
    },

    cacheServerSessions(records) {
      for (const record of records) {
        if (record.deletedAt === null) {
          putStored({
            id: record.id,
            goalId: record.goalId,
            logicalDate: record.logicalDate,
            minutes: record.minutes,
            note: record.note,
            mood: record.mood,
            updatedAt: record.updatedAt,
          });
        } else {
          removeKey(record.goalId, record.logicalDate);
        }
      }
      overlayPending();
      persistSessions();
      notify();
    },

    applySyncResult(result, syncedAt) {
      const rejected = new Map(
        result.rejected.map((item) => [item.opId, item.reason])
      );
      const settled = new Set([
        ...result.applied,
        ...result.conflicts.map((conflict) => conflict.opId),
        ...result.rejected.map((item) => item.opId),
      ]);

      const sentOps = queue.filter((op) => settled.has(op.opId));
      queue = queue.filter((op) => !settled.has(op.opId));

      for (const op of sentOps) {
        if (!rejected.has(op.opId)) {
          continue;
        }
        removeKey(op.goalId, op.logicalDate);
      }

      for (const conflict of result.conflicts) {
        removeKey(conflict.goalId, conflict.logicalDate);
      }

      for (const winner of result.winners) {
        if (winner.deletedAt === null) {
          putStored({
            id: winner.id,
            goalId: winner.goalId,
            logicalDate: winner.logicalDate,
            minutes: winner.minutes,
            note: winner.note,
            mood: winner.mood,
            updatedAt: winner.updatedAt,
          });
        } else {
          removeKey(winner.goalId, winner.logicalDate);
        }
      }

      conflicts = pruneExpiredConflicts(
        [
          ...conflicts.filter(
            (current) =>
              !result.conflicts.some(
                (conflict) => conflict.opId === current.opId
              )
          ),
          ...result.conflicts,
        ],
        now()
      );

      overlayPending();
      meta = { lastSyncedAt: syncedAt };
      persistSessions();
      persistQueue();
      persistConflicts();
      persistMeta();
      notify();
    },

    clear() {
      sessions = [];
      queue = [];
      conflicts = [];
      meta = { lastSyncedAt: null };
      for (const key of Object.values(OFFLINE_STORAGE_KEYS)) {
        try {
          storage.removeItem(key);
        } catch {
          // Nothing else to clear.
        }
      }
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

/** Used during SSR and by tests; the browser swaps in localStorage. */
export const createMemoryStorage = (): StorageLike => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
};
