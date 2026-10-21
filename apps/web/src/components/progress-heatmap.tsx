import type {
  ProgressHeatmapDay,
  ProgressIntensity,
  ProgressResult,
} from "@mostly/domain";
import { Button } from "@mostly/ui/components/button";
import { cn } from "@mostly/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { WEEKDAYS } from "@/lib/goals";
import { formatLogicalDate } from "@/lib/time";

type Heatmap = ProgressResult["heatmap"];

const INTENSITY_CLASS: Record<ProgressIntensity, string> = {
  neutral: "border-border/40 bg-transparent",
  none: "border-transparent bg-muted",
  low: "border-transparent bg-primary/25",
  medium: "border-transparent bg-primary/55",
  full: "border-transparent bg-primary",
};

const dayOutcome = (day: ProgressHeatmapDay, today: string): string => {
  if (day.expected === 0) {
    return "No expectation";
  }
  if (day.done === day.expected) {
    return "Done";
  }
  if (day.date === today && day.done < day.expected) {
    return "Open";
  }
  if (day.done > 0) {
    return "Partial";
  }
  return "Missed";
};

const DayTable = ({
  days,
  today,
}: {
  days: ProgressHeatmapDay[];
  today: string;
}) => (
  <div className="mt-4 overflow-x-auto">
    <table className="w-full min-w-[520px] text-left text-sm">
      <caption className="sr-only">Daily record for the last 12 weeks</caption>
      <thead>
        <tr className="border-border text-muted-foreground border-b">
          <th scope="col" className="py-2 pr-3 font-medium">
            Date
          </th>
          <th scope="col" className="py-2 pr-3 font-medium">
            Expected
          </th>
          <th scope="col" className="py-2 pr-3 font-medium">
            Done
          </th>
          <th scope="col" className="py-2 pr-3 font-medium">
            Extras
          </th>
          <th scope="col" className="py-2 font-medium">
            Outcome
          </th>
        </tr>
      </thead>
      <tbody>
        {days.map((day) => (
          <tr
            key={day.date}
            className="border-border/60 border-b last:border-0"
          >
            <th scope="row" className="py-1 pr-3 text-left font-normal">
              <Link
                to="/day/$date"
                params={{ date: day.date }}
                className="hover:text-foreground text-muted-foreground focus-visible:ring-ring/50 inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:ring-1 focus-visible:outline-none"
              >
                {formatLogicalDate(day.date)}
              </Link>
            </th>
            <td className="py-1 pr-3 tabular-nums">{day.expected}</td>
            <td className="py-1 pr-3 tabular-nums">{day.done}</td>
            <td className="py-1 pr-3 tabular-nums">{day.extras}</td>
            <td className="py-1">{dayOutcome(day, today)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const DayGrid = ({ heatmap }: { heatmap: Heatmap }) => {
  const weekdays = Array.from(
    { length: 7 },
    (_, index) => ((heatmap.weekStartsOn - 1 + index) % 7) + 1
  ).map((value) => WEEKDAYS.find((day) => day.value === value));

  return (
    <div className="mt-4 overflow-x-auto pb-1">
      <div className="flex gap-1.5">
        <div aria-hidden="true" className="grid grid-rows-7 gap-1">
          {weekdays.map((day) => (
            <span
              key={day?.value}
              className="text-muted-foreground flex h-4 items-center text-sm leading-none"
            >
              {day?.short.slice(0, 1)}
            </span>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="grid grid-flow-col grid-rows-7 gap-1"
        >
          {heatmap.days.map((day) => (
            <span
              key={day.date}
              className={cn(
                "flex size-4 items-center justify-center rounded-[3px] border",
                INTENSITY_CLASS[day.intensity]
              )}
            >
              {day.extras > 0 ? (
                <span className="bg-warm size-1 rounded-full" />
              ) : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ProgressHeatmap = ({
  heatmap,
  today,
}: {
  heatmap: Heatmap;
  today: string;
}) => {
  const [asTable, setAsTable] = useState(false);

  return (
    <section aria-labelledby="progress-heatmap-heading" className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="progress-heatmap-heading"
          className="text-muted-foreground text-sm font-medium tracking-wide uppercase"
        >
          Last 12 weeks
        </h2>
        <Button
          type="button"
          variant="ghost"
          aria-expanded={asTable}
          aria-controls="progress-heatmap-table"
          onClick={() => setAsTable((open) => !open)}
          className="min-h-11 rounded-full px-3 text-sm"
        >
          {asTable ? "View as chart" : "View as table"}
        </Button>
      </div>

      <div id="progress-heatmap-table">
        {asTable ? (
          <DayTable days={heatmap.days} today={today} />
        ) : (
          <DayGrid heatmap={heatmap} />
        )}
      </div>
    </section>
  );
};
