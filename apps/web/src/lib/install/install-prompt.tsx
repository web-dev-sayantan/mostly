import { Button } from "@mostly/ui/components/button";
import { cn } from "@mostly/ui/lib/utils";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useLocalSessions } from "@/lib/offline";
import { createMemoryStorage } from "@/lib/offline/store";
import type { StorageLike } from "@/lib/offline/store";

import {
  decideInstallAction,
  detectInstallPlatform,
  dismissInstall,
  requestPersistentStorage,
  recordInstallVisit,
} from "./install";
import type { InstallPlatform } from "./install";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

const browserStorage = ((): StorageLike => {
  if (typeof window === "undefined") {
    return createMemoryStorage();
  }
  try {
    return window.localStorage;
  } catch {
    return createMemoryStorage();
  }
})();

const detectStandalone = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as NavigatorWithStandalone).standalone === true
  );
};

const detectPlatform = (): InstallPlatform => {
  if (typeof navigator === "undefined") {
    return "desktop";
  }
  return detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints);
};

// Browser and install state do not change within one app open.
const initialPlatform = detectPlatform();
const initialStandalone = detectStandalone();

/** Reusable on Account too; it never assumes a `beforeinstallprompt` event. */
export const IosInstallInstructions = ({
  className,
}: {
  className?: string;
}) => (
  <ol className={cn("list-decimal space-y-1 pl-5 text-sm", className)}>
    <li>Tap the Share button in Safari.</li>
    <li>Choose Add to Home Screen, then tap Add.</li>
  </ol>
);

export const InstallPrompt = () => {
  const platform = initialPlatform;
  const standalone = initialStandalone;
  const [, setRevision] = useState(0);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const visitRecorded = useRef(false);
  const sessions = useLocalSessions();
  const isOnboarding = useRouterState({
    select: (state) => state.location.pathname.startsWith("/onboarding"),
  });

  useEffect(() => {
    if (visitRecorded.current) {
      return;
    }
    visitRecorded.current = true;
    recordInstallVisit(browserStorage);
    setRevision((revision) => revision + 1);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.storage) {
      return;
    }
    void requestPersistentStorage(browserStorage, navigator.storage);
  }, []);

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      const eventToPrompt = event as BeforeInstallPromptEvent;
      eventToPrompt.preventDefault();
      setInstallEvent(eventToPrompt);
    };
    const handleInstalled = () => {
      dismissInstall(browserStorage);
      setRevision((revision) => revision + 1);
    };

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const action = decideInstallAction(browserStorage, {
    hasSession: sessions.length > 0,
    isStandalone: standalone,
    isOnboarding,
    platform,
    canPrompt: installEvent !== null,
  });

  if (action === "none") {
    return null;
  }

  const handleInstall = async () => {
    if (!installEvent) {
      return;
    }
    setInstallEvent(null);
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } catch {
      // The browser can close the prompt without a choice.
    }
    // Either answer is final: do not ask again.
    dismissInstall(browserStorage);
    setRevision((revision) => revision + 1);
  };

  const handleDismiss = () => {
    dismissInstall(browserStorage);
    setRevision((revision) => revision + 1);
  };

  return (
    <aside
      aria-labelledby="install-prompt-heading"
      className="bg-accent/40 border-b"
    >
      <div className="mx-auto flex w-full max-w-[960px] flex-wrap items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p id="install-prompt-heading" className="text-sm font-medium">
            Install Mostly
          </p>
          {action === "ios-instructions" ? (
            <IosInstallInstructions className="text-muted-foreground mt-1" />
          ) : (
            <p className="text-muted-foreground mt-1 text-sm">
              Open your daily ledger in one tap, even offline.
            </p>
          )}
        </div>
        {action === "prompt" ? (
          <Button
            type="button"
            onClick={handleInstall}
            className="min-h-11 rounded-full px-4 text-sm"
          >
            Install
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          onClick={handleDismiss}
          className="min-h-11 rounded-full px-3 text-sm"
        >
          Not now
        </Button>
      </div>
    </aside>
  );
};
