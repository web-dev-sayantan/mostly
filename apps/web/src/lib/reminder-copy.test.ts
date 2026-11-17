import { describe, expect, it } from "vite-plus/test";

import { deliveryStatusCopy } from "./reminder-copy";

describe("deliveryStatusCopy", () => {
  it("says Sent for a delivered reminder", () => {
    expect(deliveryStatusCopy("sent", null)).toBe("Sent");
  });

  it("uses Not sent with a reason for suppressed reminders", () => {
    expect(deliveryStatusCopy("suppressed", "all_done")).toBe(
      "Not sent · Day already done"
    );
    expect(deliveryStatusCopy("suppressed", "nothing_open")).toBe(
      "Not sent · Nothing open"
    );
    expect(deliveryStatusCopy("suppressed", "no_active_goals")).toBe(
      "Not sent · No active goals"
    );
  });

  it("keeps failures quiet and specific", () => {
    expect(deliveryStatusCopy("failed", "no_subscription")).toBe(
      "Not sent · No device notification"
    );
    expect(deliveryStatusCopy("failed", "push_unconfigured")).toBe(
      "Not sent · Notifications unavailable"
    );
    expect(deliveryStatusCopy("failed", "push_410")).toBe(
      "Not sent · Device subscription expired"
    );
    expect(deliveryStatusCopy("failed", "network")).toBe(
      "Not sent · Push service unavailable"
    );
  });

  it("never shows the storage vocabulary", () => {
    for (const status of ["sent", "failed", "suppressed"] as const) {
      const copy = deliveryStatusCopy(status, null);
      expect(copy).not.toMatch(/failed|suppressed/iu);
    }
  });
});
