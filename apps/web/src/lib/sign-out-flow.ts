export type SignOutOutcome = "needs-discard-warning" | "signed-out" | "failed";

/** Sync first unless the user already acknowledged unsynced local changes. */
export const runSignOutConfirmation = async ({
  discardWarning,
  prepare,
  finish,
}: {
  discardWarning: boolean;
  prepare: () => Promise<number>;
  finish: () => Promise<boolean>;
}): Promise<SignOutOutcome> => {
  try {
    if (!discardWarning) {
      const pending = await prepare();
      if (pending > 0) {
        return "needs-discard-warning";
      }
    }

    const signedOut = await finish();
    return signedOut ? "signed-out" : "failed";
  } catch {
    return "failed";
  }
};
