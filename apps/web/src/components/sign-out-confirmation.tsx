import { Button } from "@mostly/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@mostly/ui/components/dialog";
import { XIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import { toast } from "sonner";

import { finishSignOut, prepareSignOut } from "@/lib/sign-out";
import { runSignOutConfirmation } from "@/lib/sign-out-flow";

export const SIGN_OUT_COPY = {
  heading: "Sign out and clear this device?",
  description: "Saved sessions sync first. This device keeps nothing after you sign out.",
  unsyncedWarning: "Some changes haven't synced. Signing out removes them from this device.",
  confirmLabel: "Sign out",
  confirmDiscardLabel: "Sign out and remove changes",
  workingLabel: "Signing out…",
  cancelLabel: "Keep this device signed in",
  closeLabel: "Close",
  errorToast: "Couldn't sign out. Check your connection and try again.",
} as const;

export interface SignOutFlowState {
  open: boolean;
  discardWarning: boolean;
  working: boolean;
  handleOpen: () => void;
  handleClose: () => void;
  handleConfirm: () => Promise<void>;
}

/** Shared state machine for confirming, syncing, and finishing sign-out. */
export const useSignOutFlow = (): SignOutFlowState => {
  const [open, setOpen] = useState(false);
  const [discardWarning, setDiscardWarning] = useState(false);
  const [working, setWorking] = useState(false);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setDiscardWarning(false);
    setWorking(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    setWorking(true);
    const outcome = await runSignOutConfirmation({
      discardWarning,
      prepare: prepareSignOut,
      finish: finishSignOut,
    });
    if (outcome === "needs-discard-warning") {
      setDiscardWarning(true);
      setWorking(false);
      return;
    }

    if (outcome === "failed") {
      setWorking(false);
      toast.error(SIGN_OUT_COPY.errorToast);
    }
  }, [discardWarning]);

  return {
    open,
    discardWarning,
    working,
    handleOpen,
    handleClose,
    handleConfirm,
  };
};

const confirmButtonLabel = (state: SignOutFlowState): string => {
  if (state.working) {
    return SIGN_OUT_COPY.workingLabel;
  }
  return state.discardWarning ? SIGN_OUT_COPY.confirmDiscardLabel : SIGN_OUT_COPY.confirmLabel;
};

export const SignOutButtons = ({
  state,
  confirmDescribedBy,
  cancelRef,
  autoFocusCancel = true,
}: {
  state: SignOutFlowState;
  confirmDescribedBy?: string;
  cancelRef?: RefObject<HTMLButtonElement | null>;
  autoFocusCancel?: boolean;
}) => (
  <>
    {state.discardWarning ? (
      <p role="alert" className="text-sm">
        {SIGN_OUT_COPY.unsyncedWarning}
      </p>
    ) : null}
    <div className="flex flex-wrap gap-2">
      <Button
        ref={cancelRef}
        type="button"
        variant="outline"
        autoFocus={autoFocusCancel}
        className="min-h-11 px-4 text-sm"
        disabled={state.working}
        onClick={state.handleClose}
      >
        {SIGN_OUT_COPY.cancelLabel}
      </Button>
      <Button
        type="button"
        variant={state.discardWarning ? "destructive" : "default"}
        aria-describedby={confirmDescribedBy}
        aria-busy={state.working}
        className="min-h-11 px-4 text-sm"
        disabled={state.working}
        onClick={state.handleConfirm}
      >
        {confirmButtonLabel(state)}
      </Button>
    </div>
  </>
);

/** Modal confirmation dialog used when signing out from the header user menu. */
export const SignOutDialog = ({
  state,
  finalFocus,
}: {
  state: SignOutFlowState;
  finalFocus?: RefObject<HTMLElement | null>;
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={state.open}
      disablePointerDismissal={state.working}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !state.working) {
          state.handleClose();
        }
      }}
    >
      <DialogContent initialFocus={cancelRef} finalFocus={finalFocus}>
        <div className="flex items-start justify-between gap-3">
          <DialogHeader>
            <DialogTitle>{SIGN_OUT_COPY.heading}</DialogTitle>
            <DialogDescription>{SIGN_OUT_COPY.description}</DialogDescription>
          </DialogHeader>
          <DialogClose
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-mt-1 -mr-1 size-11 shrink-0 rounded-full"
                disabled={state.working}
                aria-label={SIGN_OUT_COPY.closeLabel}
              />
            }
          >
            <XIcon aria-hidden="true" className="size-4" />
          </DialogClose>
        </div>
        <SignOutButtons state={state} cancelRef={cancelRef} autoFocusCancel={false} />
      </DialogContent>
    </Dialog>
  );
};
