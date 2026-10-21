import { Button } from "@mostly/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useLocalSessions } from "@/lib/offline";
import {
  enablePushReminders,
  isInstalledApp,
  localPushEndpoint,
  pushPermission,
  pushPlatform,
  REMINDER_NUDGE_KEY,
} from "@/lib/push";
import { orpc } from "@/utils/orpc";

const dismissed = (): boolean => {
  try {
    return localStorage.getItem(REMINDER_NUDGE_KEY) === "1";
  } catch {
    return false;
  }
};

/** iOS only: after install and the first session, in a user gesture. */
export const PushPermissionNudge = () => {
  const sessions = useLocalSessions();
  const overviewQuery = useQuery({
    ...orpc.reminders.overview.queryOptions(),
    meta: { suppressErrorToast: true },
  });
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [hidden, setHidden] = useState(dismissed);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const value = await localPushEndpoint();
      if (active) {
        setEndpoint(value);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  if (pushPlatform() !== "ios" || !isInstalledApp() || hidden) {
    return null;
  }
  if (pushPermission() !== "default" || sessions.length === 0) {
    return null;
  }
  if (!overviewQuery.data?.enabled) {
    return null;
  }

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(REMINDER_NUDGE_KEY, "1");
    } catch {
      // The status in Account still explains the choice.
    }
  };

  const enable = async () => {
    setWorking(true);
    try {
      const result = await enablePushReminders(
        overviewQuery.data?.publicKey ?? undefined
      );
      if (result.ok) {
        setEndpoint(result.endpoint);
        toast.success("Reminders are on for this device.");
      } else {
        toast.error("Could not turn on notifications.");
      }
    } catch {
      toast.error("Could not turn on notifications.");
    }
    setWorking(false);
  };

  // A stored endpoint means this device already has push.
  if (endpoint) {
    return null;
  }

  return (
    <aside
      aria-labelledby="push-nudge-heading"
      className="bg-accent/30 mt-4 rounded-2xl border p-4 text-sm"
    >
      <p id="push-nudge-heading" className="font-medium">
        One reminder a day. No streak guilt, no spam.
      </p>
      <p className="text-muted-foreground mt-1">
        Turn on notifications for Mostly in your installed app.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-11 rounded-full px-4 text-sm"
          disabled={working}
          onClick={enable}
        >
          Turn on reminders
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 rounded-full px-4 text-sm"
          disabled={working}
          onClick={dismiss}
        >
          Not now
        </Button>
      </div>
    </aside>
  );
};
