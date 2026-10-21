import { addLogicalDays } from "@mostly/domain";
import { Link } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";

import { formatLogicalDate } from "@/lib/time";

const lastSevenDays = (today: string): string[] =>
  Array.from({ length: 7 }, (_, index) => addLogicalDays(today, -index));

/** Today's collapsed entry point for backfill. Wire with `<PastSevenDays today={today} />`. */
export const PastSevenDays = ({ today }: { today: string }) => (
  <details className="bg-card group rounded-2xl border">
    <summary className="hover:bg-muted/60 focus-visible:ring-ring/50 flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
      <CalendarDays aria-hidden="true" className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium">Past 7 days</span>
        <span className="text-muted-foreground block text-sm">
          You can edit the last 7 days.
        </span>
      </span>
      <span
        aria-hidden="true"
        className="text-muted-foreground text-sm group-open:rotate-180"
      >
        ▾
      </span>
    </summary>
    <ul className="border-t px-2 py-2">
      {lastSevenDays(today).map((date) => (
        <li key={date}>
          <Link
            to="/day/$date"
            params={{ date }}
            className="hover:bg-muted focus-visible:ring-ring/50 flex min-h-11 items-center rounded-xl px-3 text-sm focus-visible:ring-1 focus-visible:outline-none"
          >
            {formatLogicalDate(date)}
            {date === today ? (
              <span className="text-muted-foreground ml-auto text-sm">
                Today
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  </details>
);
