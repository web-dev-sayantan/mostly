import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { cachedDayDetail } from "@/lib/day-cache";
import { orpc } from "@/utils/orpc";

/**
 * Today's collapsed weekday goals that are not expected. Each opens day detail,
 * where the goal can be logged as an extra. Wire with `<NotScheduledToday date={today} />`.
 */
export const NotScheduledToday = ({ date }: { date: string }) => {
  const query = useQuery(orpc.days.get.queryOptions({ input: { date } }));
  const data = query.data ?? cachedDayDetail(date);
  const goals = (data?.candidates ?? []).filter(
    (goal) => goal.cadence?.type === "weekdays"
  );

  if (goals.length === 0) {
    return null;
  }

  return (
    <details className="bg-card group rounded-2xl border">
      <summary className="hover:bg-muted/60 focus-visible:ring-ring flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 text-base font-medium">
          Not scheduled today
        </span>
        <span
          aria-hidden="true"
          className="text-muted-foreground text-sm group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <ul className="border-t px-2 py-2">
        {goals.map((goal) => (
          <li key={goal.id}>
            <Link
              to="/day/$date"
              params={{ date }}
              className="hover:bg-muted focus-visible:ring-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm focus-visible:ring-1 focus-visible:outline-none"
            >
              <span aria-hidden="true" className="text-lg">
                {goal.emoji ?? "•"}
              </span>
              <span className="min-w-0 flex-1 truncate">{goal.name}</span>
              <span className="text-muted-foreground">Log something else</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
};
