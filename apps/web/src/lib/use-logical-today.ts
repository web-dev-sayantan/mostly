import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { orpc } from "@/utils/orpc";

import { detectedTimeZone } from "./time";
import { resolveTodaySettings } from "./today";
import { readTodayCache } from "./today-cache";

/**
 * The user's logical today from the settings history, not the browser date.
 * Falls back to the cached history so goal pages open offline.
 */
export const useLogicalToday = (): string | null => {
  const [now, setNow] = useState(() => new Date());
  const cache = useMemo(() => readTodayCache(), []);
  const settingsQuery = useQuery({
    ...orpc.settings.get.queryOptions({
      input: { timeZone: detectedTimeZone() },
    }),
    meta: { suppressErrorToast: true },
  });
  const history = settingsQuery.data?.history ?? cache.settings;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(
    () =>
      resolveTodaySettings(history ?? [], now)?.today ??
      settingsQuery.data?.today ??
      null,
    [history, now, settingsQuery.data?.today]
  );
};
