import { reminderCopy } from "@mostly/domain";
import { Button } from "@mostly/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AccountSection } from "@/components/account-section";
import {
  disablePushReminders,
  enablePushReminders,
  isInstalledApp,
  localPushEndpoint,
  pushPermission,
  pushPlatform,
  REMINDER_NOTICE_KEY,
  sendTestPush,
} from "@/lib/push";
import type { PushPermission } from "@/lib/push";
import { formatLogicalDate } from "@/lib/time";
import { orpc } from "@/utils/orpc";

const permissionCopy = (
  permission: PushPermission,
  platform: ReturnType<typeof pushPlatform>,
  installed: boolean,
  configured: boolean
): string => {
  if (!configured) {
    return "Push is not configured on this server. The reminder shows here when you open Mostly.";
  }
  if (permission === "unsupported") {
    return "This browser does not support notifications. The reminder shows here when you open Mostly.";
  }
  if (platform === "ios" && !installed) {
    return "On iPhone and iPad, notifications require an installed home-screen app.";
  }
  if (permission === "denied") {
    return "Notifications are blocked. Allow them in your browser settings.";
  }
  if (permission === "granted") {
    return "Notifications are allowed on this device.";
  }
  return "Notifications are not enabled on this device yet.";
};

const deliveryErrorCopy = (error: string | null): string | null => {
  if (!error) {
    return null;
  }
  if (error === "all_done") {
    return "All done";
  }
  if (error === "no_active_goals") {
    return "No active goals";
  }
  if (error === "nothing_open") {
    return "Nothing open";
  }
  if (error === "no_subscription") {
    return "No device subscription";
  }
  if (error === "push_unconfigured") {
    return "Push is not configured";
  }
  if (error === "sending") {
    return "Sending";
  }
  if (error.startsWith("push_4")) {
    return "Subscription expired";
  }
  return "Could not send";
};

const statusCopy = (status: "sent" | "failed" | "suppressed"): string => {
  if (status === "sent") {
    return "Sent";
  }
  if (status === "suppressed") {
    return "Suppressed";
  }
  return "Failed";
};

const consumePermissionNotice = (permission: PushPermission): boolean => {
  if (!(permission === "denied" || permission === "unsupported")) {
    return false;
  }
  try {
    if (localStorage.getItem(REMINDER_NOTICE_KEY) === "1") {
      return false;
    }
    localStorage.setItem(REMINDER_NOTICE_KEY, "1");
    return true;
  } catch {
    return true;
  }
};

export const ReminderSettings = () => {
  const queryClient = useQueryClient();
  const overviewQuery = useQuery(orpc.reminders.overview.queryOptions());
  const [permission, setPermission] = useState<PushPermission>(() =>
    pushPermission()
  );
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [notice, setNotice] = useState(() =>
    consumePermissionNotice(pushPermission())
  );
  const [testing, setTesting] = useState(false);
  const [working, setWorking] = useState(false);
  const platform = pushPlatform();
  const installed = isInstalledApp();

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

  const update = useMutation(
    orpc.reminders.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.reminders.overview.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Could not save reminder settings.");
      },
    })
  );

  const overview = overviewQuery.data;

  const refreshDevice = async () => {
    const nextPermission = pushPermission();
    setPermission(nextPermission);
    setEndpoint(await localPushEndpoint());
    if (consumePermissionNotice(nextPermission)) {
      setNotice(true);
    }
  };

  const toggle = async (enabled: boolean) => {
    setWorking(true);
    try {
      await (enabled
        ? enablePushReminders(overview?.publicKey ?? undefined)
        : disablePushReminders());
      update.mutate({ enabled });
      await refreshDevice();
    } catch {
      toast.error("Could not change the reminder on this device.");
    }
    setWorking(false);
  };

  const test = async () => {
    setTesting(true);
    try {
      const result = await sendTestPush();
      await refreshDevice();
      if (result.ok) {
        toast.success("Test notification sent.");
      } else if (result.reason === "install-required") {
        toast.error("Install Mostly on your home screen first.");
      } else if (result.reason === "denied") {
        toast.error("Notifications are blocked in this browser.");
      } else if (result.reason === "not-configured") {
        toast.error("Push is not configured on this server.");
      } else {
        toast.error("Could not send a test notification.");
      }
    } catch {
      toast.error("Could not send a test notification.");
    }
    setTesting(false);
  };

  const busy = working || update.isPending;
  const fallback =
    overview?.enabled &&
    overview.openCount > 0 &&
    overview.deliveredToday?.status !== "sent" &&
    !(permission === "granted" && endpoint);

  return (
    <AccountSection id="reminder" title="Reminder">
      <p className="text-sm">One reminder a day. No streak guilt, no spam.</p>

      {overviewQuery.isPending ? (
        <p className="text-muted-foreground text-sm">Loading reminder.</p>
      ) : null}
      {overviewQuery.isError ? (
        <div className="grid gap-3">
          <p className="text-sm">Could not load the reminder.</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-fit px-4 text-sm"
            onClick={() => overviewQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {overview ? (
        <>
          <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={overview.enabled}
              disabled={busy}
              onChange={async (event) => {
                await toggle(event.target.checked);
              }}
              className="size-4"
            />
            Reminder on
          </label>

          <div className="grid gap-2">
            <label htmlFor="reminder-time" className="text-sm font-medium">
              Time
            </label>
            <input
              id="reminder-time"
              type="time"
              value={overview.time}
              disabled={busy}
              onChange={(event) => {
                if (event.target.value) {
                  update.mutate({ time: event.target.value });
                }
              }}
              className="border-input bg-background min-h-11 w-full max-w-48 rounded-lg border px-3 text-base"
            />
            <p className="text-muted-foreground text-sm">
              Local time. One reminder a day at most.
            </p>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium">Permission</p>
            <p className="text-muted-foreground text-sm">
              {permissionCopy(
                permission,
                platform,
                installed,
                overview.configured
              )}
            </p>
            {notice ? (
              <output className="bg-muted/50 block rounded-lg border p-3 text-sm">
                The reminder will appear in Mostly when you open it. No repeated
                permission prompts.
              </output>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-fit px-4 text-sm"
            disabled={
              testing ||
              permission === "unsupported" ||
              (platform === "ios" && !installed) ||
              permission === "denied" ||
              !overview.configured
            }
            onClick={test}
          >
            {testing ? "Sending…" : "Send test notification"}
          </Button>

          {fallback ? (
            <output className="bg-accent/40 block rounded-xl border p-3 text-sm">
              {reminderCopy(overview.openCount)}
            </output>
          ) : null}

          <div className="grid gap-2 border-t pt-4">
            <h3 className="text-sm font-medium">Delivery log</h3>
            {overview.deliveries.length === 0 ? (
              <p className="text-muted-foreground text-sm">No reminders yet.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {overview.deliveries.map((delivery) => (
                  <li
                    key={delivery.id}
                    className="flex flex-wrap items-baseline justify-between gap-2"
                  >
                    <span>{formatLogicalDate(delivery.logicalDate)}</span>
                    <span className="text-muted-foreground">
                      {statusCopy(delivery.status)}
                      {deliveryErrorCopy(delivery.error)
                        ? ` · ${deliveryErrorCopy(delivery.error)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </AccountSection>
  );
};
