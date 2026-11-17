import { reminderCopy } from "@mostly/domain";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { canEnablePush, isPushReady, usePushDevice } from "@/lib/push";
import { orpc } from "@/utils/orpc";

/** A next-open nudge when the browser cannot receive a background push. */
export const TodayReminderFallback = () => {
  const overviewQuery = useQuery({
    ...orpc.reminders.overview.queryOptions(),
    meta: { suppressErrorToast: true },
  });
  const { endpoint, permission, platform, installed } = usePushDevice();

  const overview = overviewQuery.data;
  const pushReady = isPushReady({
    configured: overview?.configured,
    permission,
    endpoint,
    deliveredStatus: overview?.deliveredToday?.status,
  });
  const canStillEnable = canEnablePush({
    configured: overview?.configured,
    permission,
    platform,
    installed,
  });
  const show =
    overview?.enabled &&
    overview.openCount > 0 &&
    overview.deliveredToday?.status !== "sent" &&
    !pushReady &&
    !canStillEnable;

  if (!show || !overview) {
    return null;
  }

  return (
    <aside
      aria-label="Reminder"
      className="bg-accent/30 mt-4 rounded-2xl border p-4 text-sm"
    >
      <p>{reminderCopy(overview.openCount)}</p>
      <Link
        to="/account"
        className="focus-visible:ring-ring mt-2 inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        Reminder settings
      </Link>
    </aside>
  );
};
