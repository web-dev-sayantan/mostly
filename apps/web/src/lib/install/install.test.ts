import { describe, expect, it } from "vite-plus/test";

import type { StorageLike } from "@/lib/offline/store";

import {
  decideInstallAction,
  detectInstallPlatform,
  dismissInstall,
  recordInstallVisit,
  requestPersistentStorage,
} from "./install";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const signal = (
  overrides: Partial<Parameters<typeof decideInstallAction>[1]> = {}
) => ({
  hasSession: false,
  isStandalone: false,
  isOnboarding: false,
  platform: "android" as const,
  canPrompt: true,
  ...overrides,
});

describe("install prompt", () => {
  it("offers the custom prompt after the first session", () => {
    const storage = new MemoryStorage();
    recordInstallVisit(storage);

    expect(decideInstallAction(storage, signal({ hasSession: true }))).toBe(
      "prompt"
    );
  });

  it("waits for a second visit when no session exists yet", () => {
    const storage = new MemoryStorage();

    recordInstallVisit(storage);
    expect(decideInstallAction(storage, signal())).toBe("none");

    recordInstallVisit(storage);
    expect(decideInstallAction(storage, signal())).toBe("prompt");
  });

  it("stays quiet after dismissal", () => {
    const storage = new MemoryStorage();
    recordInstallVisit(storage);
    recordInstallVisit(storage);
    dismissInstall(storage);

    expect(decideInstallAction(storage, signal({ hasSession: true }))).toBe(
      "none"
    );
  });

  it("hides when the app is already installed", () => {
    const storage = new MemoryStorage();
    recordInstallVisit(storage);
    recordInstallVisit(storage);

    expect(
      decideInstallAction(
        storage,
        signal({ hasSession: true, isStandalone: true })
      )
    ).toBe("none");
  });

  it("never interrupts onboarding", () => {
    const storage = new MemoryStorage();
    recordInstallVisit(storage);
    recordInstallVisit(storage);

    expect(
      decideInstallAction(
        storage,
        signal({ hasSession: true, isOnboarding: true })
      )
    ).toBe("none");
  });

  it("uses Share instructions on iOS and ignores beforeinstallprompt", () => {
    const storage = new MemoryStorage();
    recordInstallVisit(storage);

    expect(
      decideInstallAction(
        storage,
        signal({ hasSession: true, platform: "ios", canPrompt: true })
      )
    ).toBe("ios-instructions");
    expect(
      decideInstallAction(storage, signal({ platform: "ios", canPrompt: true }))
    ).toBe("none");
  });

  it("does not offer a prompt the browser cannot show", () => {
    const storage = new MemoryStorage();
    recordInstallVisit(storage);

    expect(
      decideInstallAction(
        storage,
        signal({ hasSession: true, canPrompt: false })
      )
    ).toBe("none");
  });
});

describe("install platform", () => {
  it("detects iOS, Android, and desktop browsers", () => {
    expect(
      detectInstallPlatform(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        0
      )
    ).toBe("ios");
    expect(
      detectInstallPlatform(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        0
      )
    ).toBe("ios");
    expect(
      detectInstallPlatform(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        5
      )
    ).toBe("ios");
    expect(
      detectInstallPlatform(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36",
        5
      )
    ).toBe("android");
    expect(
      detectInstallPlatform(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        0
      )
    ).toBe("desktop");
  });
});

describe("persistent storage", () => {
  it("asks once and skips the second call", async () => {
    const storage = new MemoryStorage();
    let persistCalls = 0;
    const manager = {
      persisted: () => Promise.resolve(false),
      persist: () => {
        persistCalls += 1;
        return Promise.resolve(true);
      },
    };

    await requestPersistentStorage(storage, manager);
    await requestPersistentStorage(storage, manager);

    expect(persistCalls).toBe(1);
  });

  it("does not ask again when storage is already persistent", async () => {
    const storage = new MemoryStorage();
    let persistCalls = 0;
    const manager = {
      persisted: () => Promise.resolve(true),
      persist: () => {
        persistCalls += 1;
        return Promise.resolve(true);
      },
    };

    await requestPersistentStorage(storage, manager);

    expect(persistCalls).toBe(0);
  });

  it("stays quiet where persistent storage is unsupported", async () => {
    const storage = new MemoryStorage();

    await requestPersistentStorage(storage, {});

    expect(storage.getItem("mostly:persistent-storage-requested")).toBeNull();
  });
});
