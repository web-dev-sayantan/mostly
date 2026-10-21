import { useEffect, useState } from "react";

import { useSyncStatus } from "./hooks";

export const formatSyncAge = (lastSyncedAt: number, now: number): string => {
  const minutes = Math.max(0, Math.floor((now - lastSyncedAt) / 60_000));
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
};

/** Quiet sync line in the app shell; Account owns the detailed version. */
export const SyncStatusLine = () => {
  const status = useSyncStatus();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status.lastSyncedAt === null) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [status.lastSyncedAt]);

  if (status.state === "offline") {
    return null;
  }

  if (status.authExpired) {
    return (
      <output className="text-muted-foreground block">
        Sync paused. Sign in again to save changes.
      </output>
    );
  }

  if (status.state === "error") {
    return (
      <output className="text-muted-foreground block">
        Couldn&apos;t sync changes.{" "}
        <button
          type="button"
          onClick={() => status.retry()}
          className="text-foreground min-h-11 rounded-full px-2 text-sm underline underline-offset-4"
        >
          Try again
        </button>
      </output>
    );
  }

  if (status.state === "pending") {
    return (
      <output className="text-muted-foreground block">Saving changes…</output>
    );
  }

  if (status.lastSyncedAt === null) {
    return null;
  }

  return (
    <p className="text-muted-foreground">
      Last synced {formatSyncAge(status.lastSyncedAt, now)}
    </p>
  );
};
