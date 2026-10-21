export {
  cacheServerSessions,
  clearOfflineData,
  deleteLocalSession,
  markSessionDone,
  retrySync,
  syncNow,
  updateLocalSession,
} from "./client";
export { useLocalSessions, useSyncStatus } from "./hooks";
export { OfflineBanner } from "./offline-banner";
export type { Mood, SessionConflict } from "@mostly/domain";
export type { LocalSession, SessionSyncResult } from "./store";
export type { SyncState, SyncStatus } from "./sync-engine";

/** Account surfaces this next to the kept losing edit. */
export const CONFLICT_NOTICE_COPY = "Review sync conflict";
