import { Button } from "@mostly/ui/components/button";

import { useSyncStatus } from "@/lib/offline";

export const TodaySyncFooter = () => {
  const { state, authExpired, retry } = useSyncStatus();

  if (state !== "pending" && state !== "error") {
    return null;
  }

  let message = "Sync pending. Saved on this device.";
  if (state === "error") {
    message = authExpired
      ? "Sign-in expired. Changes are saved on this device."
      : "Couldn't sync. Changes are saved on this device.";
  }

  return (
    <footer className="text-muted-foreground mt-8 flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
      <output aria-live="polite" className="min-w-0 flex-1">
        {message}
      </output>
      <Button
        type="button"
        variant="outline"
        onClick={retry}
        className="min-h-11 rounded-full px-4 text-sm"
      >
        Retry
      </Button>
    </footer>
  );
};
