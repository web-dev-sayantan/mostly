import { useEffect, useState } from "react";

import { offlineStore, startOfflineSync, syncEngine } from "./client";
import type { LocalSession } from "./store";
import type { SyncStatus } from "./sync-engine";

const subscribeStore = (listener: () => void) =>
  offlineStore.subscribe(listener);
const readSessions = (): LocalSession[] => offlineStore.getSessions();
const subscribeEngine = (listener: () => void) =>
  syncEngine.subscribe(listener);
const readStatus = (): SyncStatus => syncEngine.getStatus();

const useOfflineValue = <T>(
  subscribe: (listener: () => void) => () => void,
  read: () => T
): T => {
  const [value, setValue] = useState(read);

  useEffect(() => {
    const unsubscribe = subscribe(() => setValue(read()));
    startOfflineSync();
    return unsubscribe;
  }, [subscribe, read]);

  return value;
};

/** Live sessions, local writes included. Undo/edit through the offline actions. */
export const useLocalSessions = (): LocalSession[] =>
  useOfflineValue(subscribeStore, readSessions);

/** Sync state for the footer, Account, and the conflict notice. */
export const useSyncStatus = (): SyncStatus =>
  useOfflineValue(subscribeEngine, readStatus);
