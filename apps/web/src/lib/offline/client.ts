import { clearTodayCache } from "@/lib/today-cache";
import { client } from "@/utils/orpc";

import { createMemoryStorage, createOfflineStore } from "./store";
import type { SyncStatus } from "./sync-engine";
import { createSyncEngine } from "./sync-engine";

const browserStorage = (() => {
  if (typeof window === "undefined") {
    return createMemoryStorage();
  }
  try {
    return window.localStorage;
  } catch {
    return createMemoryStorage();
  }
})();

export const offlineStore = createOfflineStore(browserStorage);

export const syncEngine = createSyncEngine({
  store: offlineStore,
  server: {
    sync: (input) => client.sessions.sync(input),
  },
  isOnline: () => (typeof navigator === "undefined" ? false : navigator.onLine),
});

export const { markSessionDone } = offlineStore;
export const { updateLocalSession } = offlineStore;
export const { deleteLocalSession } = offlineStore;
export const { cacheServerSessions } = offlineStore;
export const clearOfflineData = (): void => {
  offlineStore.clear();
  clearTodayCache();
};
export const bindOfflineUser = (userId: string): boolean =>
  offlineStore.bindUser(userId);
export const syncNow = (): Promise<void> => syncEngine.syncNow();
export const retrySync = (): void => syncEngine.retry();
export const getSyncStatus = (): SyncStatus => syncEngine.getStatus();

let started = false;

/** Replay on open and reconnect. Safe to call from every mounted hook. */
export const startOfflineSync = (): void => {
  if (started || typeof window === "undefined") {
    return;
  }
  started = true;

  window.addEventListener("online", () => {
    syncEngine.refresh();
    syncEngine.retry();
  });
  window.addEventListener("offline", () => syncEngine.refresh());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncEngine.retry();
    }
  });

  void syncEngine.syncNow();
};
