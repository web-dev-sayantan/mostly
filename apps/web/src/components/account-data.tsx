import { Button } from "@mostly/ui/components/button";
import { Input } from "@mostly/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AccountSection } from "@/components/account-section";
import { signInWithGoogle } from "@/lib/auth-client";
import { CONFLICT_NOTICE_COPY, useSyncStatus } from "@/lib/offline";
import type { SyncStatus } from "@/lib/offline";
import {
  finishAccountDeletion,
  finishSignOut,
  prepareSignOut,
} from "@/lib/sign-out";
import { formatLogicalDate } from "@/lib/time";
import { orpc } from "@/utils/orpc";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const formatLastSynced = (at: number | null): string => {
  if (at === null) {
    return "Not synced on this device yet";
  }

  const elapsed = Math.max(0, Date.now() - at);
  if (elapsed < MINUTE_MS) {
    return "Last synced just now";
  }
  if (elapsed < HOUR_MS) {
    return `Last synced ${Math.floor(elapsed / MINUTE_MS)}m ago`;
  }
  if (elapsed < 24 * HOUR_MS) {
    return `Last synced ${Math.floor(elapsed / HOUR_MS)}h ago`;
  }
  return `Last synced ${new Date(at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })}`;
};

const downloadExport = (exportedAt: string, document: unknown): void => {
  const blob = new Blob([JSON.stringify(document, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `mostly-export-${exportedAt.slice(0, 10)}.json`;
  window.document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const signIn = async () => {
  try {
    await signInWithGoogle();
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Could not start Google sign-in."
    );
  }
};

const SyncNotice = ({ status }: { status: SyncStatus }) => {
  if (status.accountDeleted) {
    return (
      <div
        aria-live="polite"
        className="bg-muted/50 grid gap-3 rounded-lg border p-3"
      >
        <div>
          <p className="text-sm font-medium">This account was deleted</p>
          <p className="text-muted-foreground text-sm">
            Queued changes and saved data on this device were removed. Sign in
            with another account to keep using Mostly.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-fit px-4 text-sm"
          onClick={signIn}
        >
          Sign in
        </Button>
      </div>
    );
  }

  if (status.authExpired) {
    return (
      <div
        aria-live="polite"
        className="bg-muted/50 grid gap-3 rounded-lg border p-3"
      >
        <div>
          <p className="text-sm font-medium">Your session expired</p>
          <p className="text-muted-foreground text-sm">
            Your queued changes stay on this device. Sign in to sync them.
          </p>
        </div>
        {status.state === "offline" ? (
          <p className="text-muted-foreground text-sm">
            You&apos;re offline. Sign in when you&apos;re back online.
          </p>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-fit px-4 text-sm"
            onClick={signIn}
          >
            Sign in
          </Button>
        )}
      </div>
    );
  }

  if (status.conflicts.length > 0) {
    return (
      <div
        aria-live="polite"
        className="bg-muted/50 grid gap-2 rounded-lg border p-3"
      >
        <p className="text-sm font-medium">{CONFLICT_NOTICE_COPY}</p>
        <p className="text-muted-foreground text-sm">
          A newer edit from another device won. Your local copy stays on this
          device for seven days.
        </p>
        <ul className="grid gap-1 text-sm">
          {status.conflicts.map((conflict) => (
            <li key={conflict.opId}>
              {formatLogicalDate(conflict.logicalDate)} · kept until{" "}
              {new Date(conflict.expiresAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (status.state === "error") {
    return (
      <div
        aria-live="polite"
        className="bg-muted/50 grid gap-3 rounded-lg border p-3"
      >
        <p className="text-sm">
          Couldn&apos;t sync. Your changes are saved on this device.
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-fit px-4 text-sm"
          onClick={() => status.retry()}
        >
          Try again
        </Button>
      </div>
    );
  }

  return null;
};

const SignOutControl = () => {
  const [open, setOpen] = useState(false);
  const [discardWarning, setDiscardWarning] = useState(false);
  const [working, setWorking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setDiscardWarning(false);
    setWorking(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };

  const signOut = async () => {
    setWorking(true);

    try {
      if (!discardWarning) {
        const pending = await prepareSignOut();
        if (pending > 0) {
          setDiscardWarning(true);
          setWorking(false);
          return;
        }
      }

      const signedOut = await finishSignOut();
      if (!signedOut) {
        setWorking(false);
        toast.error("Couldn't sign out. Check your connection and try again.");
      }
    } catch {
      setWorking(false);
      toast.error("Couldn't sign out. Check your connection and try again.");
    }
  };

  if (!open) {
    return (
      <Button
        ref={trigger}
        type="button"
        variant="outline"
        className="min-h-11 w-fit px-4 text-sm"
        onClick={() => setOpen(true)}
      >
        Sign out
      </Button>
    );
  }

  return (
    <div className="bg-muted/50 grid gap-3 rounded-lg border p-3">
      <div>
        <p id="sign-out-heading" className="text-sm font-medium">
          Sign out and clear this device?
        </p>
        <p id="sign-out-description" className="text-muted-foreground text-sm">
          Saved sessions sync first. This device keeps nothing after you sign
          out.
        </p>
      </div>
      {discardWarning ? (
        <p role="alert" className="text-sm">
          Some changes haven&apos;t synced. Signing out removes them from this
          device.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          autoFocus
          aria-describedby="sign-out-description"
          className="min-h-11 px-4 text-sm"
          disabled={working}
          onClick={signOut}
        >
          {discardWarning ? "Sign out and remove changes" : "Sign out"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 px-4 text-sm"
          disabled={working}
          onClick={close}
        >
          Keep this device signed in
        </Button>
      </div>
    </div>
  );
};

const DeleteAccountControl = ({
  exportDocument,
  exporting,
}: {
  exportDocument: () => void;
  exporting: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const remove = useMutation(
    orpc.account.delete.mutationOptions({
      onSuccess: () => finishAccountDeletion(),
      onError: (error) => {
        toast.error(error.message || "Could not delete the account.");
      },
    })
  );

  const close = () => {
    setOpen(false);
    setConfirmation("");
    requestAnimationFrame(() => trigger.current?.focus());
  };

  if (!open) {
    return (
      <Button
        ref={trigger}
        type="button"
        variant="destructive"
        className="min-h-11 w-fit px-4 text-sm"
        onClick={() => setOpen(true)}
      >
        Delete account
      </Button>
    );
  }

  return (
    <div className="border-destructive/40 grid gap-3 rounded-lg border p-3">
      <div className="grid gap-1">
        <p id="delete-account-warning" className="text-sm font-medium">
          This removes your account and every session. This can&apos;t be
          undone.
        </p>
        <p className="text-muted-foreground text-sm">
          Backups expire within 30 days.
        </p>
      </div>
      <p className="text-sm">Export your data first?</p>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-fit px-4 text-sm"
        disabled={exporting}
        onClick={exportDocument}
      >
        Download a copy of everything
      </Button>
      <div className="grid gap-1.5">
        <label htmlFor="delete-account-confirm" className="text-sm font-medium">
          Type DELETE to confirm
        </label>
        <Input
          id="delete-account-confirm"
          value={confirmation}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-describedby="delete-account-warning"
          className="min-h-11 max-w-64 text-base"
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          aria-describedby="delete-account-warning"
          className="min-h-11 px-4 text-sm"
          disabled={confirmation !== "DELETE" || remove.isPending}
          onClick={() => remove.mutate({ confirm: "DELETE" })}
        >
          {remove.isPending ? "Deleting…" : "Delete account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 px-4 text-sm"
          disabled={remove.isPending}
          onClick={close}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

export const DataControls = () => {
  const status = useSyncStatus();
  const exportData = useMutation(
    orpc.account.export.mutationOptions({
      onSuccess: (document) => {
        downloadExport(document.exported_at, document);
        toast.success("Export downloaded.");
      },
      onError: (error) => {
        toast.error(error.message || "Could not prepare the export.");
      },
    })
  );
  const exportDocument = () => exportData.mutate();

  return (
    <AccountSection id="data" title="Data">
      <SyncNotice status={status} />

      <div className="grid gap-2">
        <p className="text-sm">
          Download a copy of everything: settings history, goals, schedules,
          sessions, and outcomes.
        </p>
        <Button
          type="button"
          className="min-h-11 w-fit px-4 text-sm"
          disabled={exportData.isPending}
          onClick={exportDocument}
        >
          {exportData.isPending
            ? "Preparing export…"
            : "Download a copy of everything"}
        </Button>
      </div>

      <div className="text-muted-foreground grid gap-1 text-sm">
        <p>{formatLastSynced(status.lastSyncedAt)}</p>
        {status.pendingCount > 0 ? (
          <p>
            {status.pendingCount}{" "}
            {status.pendingCount === 1 ? "change" : "changes"} waiting to sync.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 border-t pt-4">
        <SignOutControl />
        <DeleteAccountControl
          exportDocument={exportDocument}
          exporting={exportData.isPending}
        />
      </div>
    </AccountSection>
  );
};
