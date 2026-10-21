import { authClient } from "./auth-client";
import { clearOfflineData, getSyncStatus, syncNow } from "./offline";
import { removePushSubscription } from "./push";

/** Sync before asking about sign-out; the pending count drives the warning. */
export const prepareSignOut = async (): Promise<number> => {
  await syncNow();
  return getSyncStatus().pendingCount;
};

/**
 * Runs only after the user confirms. A failed server sign-out keeps the local
 * cache so unsynced work is not destroyed by a network error.
 */
export const finishSignOut = async (): Promise<boolean> => {
  try {
    await authClient.signOut();
  } catch {
    return false;
  }

  clearOfflineData();
  await removePushSubscription();
  window.location.assign("/login");
  return true;
};

/** After the account row is gone, clear this device and leave the app. */
export const finishAccountDeletion = async (): Promise<void> => {
  clearOfflineData();
  await removePushSubscription();
  try {
    await authClient.signOut();
  } catch {
    // The server already deleted the session with the account.
  }
  window.location.assign("/login");
};
