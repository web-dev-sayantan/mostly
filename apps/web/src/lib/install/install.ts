import type { StorageLike } from "../offline/store";

export const INSTALL_STORAGE_KEYS = {
  visits: "mostly:install-visits",
  dismissed: "mostly:install-dismissed",
  persistentStorage: "mostly:persistent-storage-requested",
} as const;

export type InstallPlatform = "ios" | "android" | "desktop";
export type InstallAction = "prompt" | "ios-instructions" | "none";

export interface InstallSignals {
  hasSession: boolean;
  isStandalone: boolean;
  isOnboarding: boolean;
  platform: InstallPlatform;
  canPrompt: boolean;
}

const safeGet = (storage: StorageLike, key: string): string | null => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (storage: StorageLike, key: string, value: string): void => {
  try {
    storage.setItem(key, value);
  } catch {
    // Private modes can reject writes; the prompt simply returns next open.
  }
};

export const getInstallVisits = (storage: StorageLike): number => {
  const value = Number.parseInt(safeGet(storage, INSTALL_STORAGE_KEYS.visits) ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

/** Call once per app open, before deciding whether to offer install. */
export const recordInstallVisit = (storage: StorageLike): number => {
  const visits = getInstallVisits(storage) + 1;
  safeSet(storage, INSTALL_STORAGE_KEYS.visits, String(visits));
  return visits;
};

/** Both "Not now" and a dismissed native prompt are remembered. */
export const dismissInstall = (storage: StorageLike): void =>
  safeSet(storage, INSTALL_STORAGE_KEYS.dismissed, "1");

export const isInstallDismissed = (storage: StorageLike): boolean =>
  safeGet(storage, INSTALL_STORAGE_KEYS.dismissed) === "1";

export const detectInstallPlatform = (
  userAgent: string,
  maxTouchPoints = 0
): InstallPlatform => {
  const ua = userAgent.toLowerCase();
  const isIos =
    /iphone|ipad|ipod/u.test(ua) ||
    (/macintosh/u.test(ua) && maxTouchPoints > 1);
  if (isIos) {
    return "ios";
  }
  return /android/u.test(ua) ? "android" : "desktop";
};

export const decideInstallAction = (
  storage: StorageLike,
  signals: InstallSignals
): InstallAction => {
  if (signals.isStandalone || signals.isOnboarding || isInstallDismissed(storage)) {
    return "none";
  }

  if (signals.platform === "ios") {
    return signals.hasSession ? "ios-instructions" : "none";
  }

  const eligible = signals.hasSession || getInstallVisits(storage) >= 2;
  return eligible && signals.canPrompt ? "prompt" : "none";
};
