import { useSyncStatus } from "./hooks";

/** Slim, non-blocking banner. It never covers the daily loop. */
export const OfflineBanner = () => {
  const { state } = useSyncStatus();

  if (state !== "offline") {
    return null;
  }

  return (
    <output
      aria-live="polite"
      className="bg-muted text-muted-foreground block border-b text-sm"
    >
      <p className="mx-auto w-full max-w-[960px] px-4 py-1.5">
        Offline — saved on this device.
      </p>
    </output>
  );
};
