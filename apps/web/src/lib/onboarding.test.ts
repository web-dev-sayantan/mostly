import { describe, expect, it } from "vite-plus/test";

import {
  needsOnboarding,
  onboardingIsComplete,
  shouldRequestPush,
} from "./onboarding";

describe("onboarding redirects", () => {
  it("sends an unfinished account to onboarding", () => {
    expect(needsOnboarding(false)).toBe(true);
  });

  it("leaves a completed or unknown account alone", () => {
    expect(needsOnboarding(true)).toBe(false);
    expect(needsOnboarding(null)).toBe(false);
  });

  it("leaves onboarding only for a signed-in completed account", () => {
    expect(onboardingIsComplete(true, true)).toBe(true);
    expect(onboardingIsComplete(true, false)).toBe(false);
    expect(onboardingIsComplete(true, null)).toBe(false);
    expect(onboardingIsComplete(false, true)).toBe(false);
  });
});

describe("shouldRequestPush", () => {
  const base = { requested: true, platform: "android" as const };

  it("asks when reminders were requested and push is configured", () => {
    expect(shouldRequestPush({ ...base, publicKey: "key" })).toBe(true);
  });

  it("does not ask when reminders were declined or push is unavailable", () => {
    expect(
      shouldRequestPush({ ...base, requested: false, publicKey: "key" })
    ).toBe(false);
    expect(shouldRequestPush({ ...base, publicKey: null })).toBe(false);
  });

  it("waits for install and the first session on iOS", () => {
    expect(
      shouldRequestPush({
        requested: true,
        platform: "ios",
        publicKey: "key",
      })
    ).toBe(false);
  });
});
