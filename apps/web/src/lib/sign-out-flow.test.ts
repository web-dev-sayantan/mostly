import { describe, expect, it } from "vite-plus/test";

import { runSignOutConfirmation } from "./sign-out-flow";

describe("runSignOutConfirmation", () => {
  it("finishes sign-out when no pending changes remain after sync", async () => {
    let prepared = 0;
    let finished = 0;

    const outcome = await runSignOutConfirmation({
      discardWarning: false,
      prepare: () => {
        prepared += 1;
        return Promise.resolve(0);
      },
      finish: () => {
        finished += 1;
        return Promise.resolve(true);
      },
    });

    expect(outcome).toBe("signed-out");
    expect(prepared).toBe(1);
    expect(finished).toBe(1);
  });

  it("warns before discarding when unsynced changes remain", async () => {
    let finished = 0;

    const outcome = await runSignOutConfirmation({
      discardWarning: false,
      prepare: () => Promise.resolve(2),
      finish: () => {
        finished += 1;
        return Promise.resolve(true);
      },
    });

    expect(outcome).toBe("needs-discard-warning");
    expect(finished).toBe(0);
  });

  it("skips sync and signs out after the user accepts discarding changes", async () => {
    let prepared = 0;
    let finished = 0;

    const outcome = await runSignOutConfirmation({
      discardWarning: true,
      prepare: () => {
        prepared += 1;
        return Promise.resolve(2);
      },
      finish: () => {
        finished += 1;
        return Promise.resolve(true);
      },
    });

    expect(outcome).toBe("signed-out");
    expect(prepared).toBe(0);
    expect(finished).toBe(1);
  });

  it("reports failure when finish returns false or throws", async () => {
    const failedFinish = await runSignOutConfirmation({
      discardWarning: false,
      prepare: () => Promise.resolve(0),
      finish: () => Promise.resolve(false),
    });
    expect(failedFinish).toBe("failed");

    const thrownPrepare = await runSignOutConfirmation({
      discardWarning: false,
      prepare: () => Promise.reject(new Error("network down")),
      finish: () => Promise.resolve(true),
    });
    expect(thrownPrepare).toBe("failed");
  });
});
