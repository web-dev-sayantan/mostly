import type {
  ProgressHeatmapDay,
  ProgressIntensity,
  ProgressResult,
} from "@mostly/domain";
import { Button } from "@mostly/ui/components/button";
import { cn } from "@mostly/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { WEEKDAYS, formatDayMonth } from "@/lib/goals";
import { formatLogicalDate } from "@/lib/time";

type Heatmap = ProgressResult["heatmap"];

const INTENSITY_CLASS: Record<ProgressIntensity, string> = {
  neutral: "border-border/40 bg-transparent",
  none: "border-transparent bg-muted",
  low: "border-transparent bg-primary/25",
  medium: "border-transparent bg-primary/55",
  full: "border-transparent bg-primary",
};

const LEGEND_LEVELS: readonly ProgressIntensity[] = [
  "none",
  "low",
  "medium",
  "full",
];

const SHORT_MONTH = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC",
});

const formatMonthShort = (date: string): string =>
  SHORT_MONTH.format(new Date(`${date}T12:00:00Z`));

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

export const hoveredDaySummary = (
  day: ProgressHeatmapDay,
  today: string
): string => {
  const dateLabel = formatDayMonth(day.date);
  const outcome =
    day.expected > 0
      ? `${day.done}/${day.expected} done`
      : dayOutcome(day, today);
  if (day.extras > 0) {
    const extraLabel = day.extras === 1 ? "1 extra" : `${day.extras} extras`;
    return `${dateLabel} · ${outcome} · ${extraLabel}`;
  }
  return `${dateLabel} · ${outcome}`;
};

export const buildWeekColumns = (
  days: ProgressHeatmapDay[]
): { days: ProgressHeatmapDay[]; monthLabel: string | null }[] => {
  const columns: ProgressHeatmapDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    columns.push(days.slice(index, index + 7));
  }

  return columns.map((column, index) => {
    const firstOfMonth = column.find((day) => day.date.endsWith("-01"));
    if (firstOfMonth) {
      return { days: column, monthLabel: formatMonthShort(firstOfMonth.date) };
    }
    if (index === 0 && column[0]) {
      const nextHasMonthStart = columns[1]?.some((day) =>
        day.date.endsWith("-01")
      );
      if (!nextHasMonthStart) {
        return { days: column, monthLabel: formatMonthShort(column[0].date) };
      }
    }
    return { days: column, monthLabel: null };
  });
};

const DayTable = ({
  days,
  today,
}: {
  days: ProgressHeatmapDay[];
  today: string;
}) => {
  const recentFirst = days.toReversed();

  return (
    <div className="max-h-80 overflow-auto rounded-xl border">
      <table className="w-full min-w-[480px] text-left text-sm">
        <caption className="sr-only">
          Daily record for the last 12 weeks
        </caption>
        <thead>
          <tr className="border-border bg-card text-muted-foreground border-b">
            <th
              scope="col"
              className="bg-card sticky top-0 py-2.5 pr-3 pl-3 font-medium"
            >
              Date
            </th>
            <th
              scope="col"
              className="bg-card sticky top-0 py-2.5 pr-3 font-medium"
            >
              Expected
            </th>
            <th
              scope="col"
              className="bg-card sticky top-0 py-2.5 pr-3 font-medium"
            >
              Done
            </th>
            <th
              scope="col"
              className="bg-card sticky top-0 py-2.5 pr-3 font-medium"
            >
              Extras
            </th>
            <th
              scope="col"
              className="bg-card sticky top-0 py-2.5 pr-3 font-medium"
            >
              Outcome
            </th>
          </tr>
        </thead>
        <tbody>
          {recentFirst.map((day) => (
            <tr
              key={day.date}
              className="border-border/60 border-b last:border-0"
            >
              <th scope="row" className="py-1 pr-3 pl-3 text-left font-normal">
                <Link
                  to="/day/$date"
                  params={{ date: day.date }}
                  className="hover:text-foreground text-muted-foreground focus-visible:ring-ring inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:ring-1 focus-visible:outline-none"
                >
                  {formatLogicalDate(day.date)}
                </Link>
              </th>
              <td className="py-1 pr-3 tabular-nums">{day.expected}</td>
              <td className="py-1 pr-3 tabular-nums">{day.done}</td>
              <td className="py-1 pr-3 tabular-nums">{day.extras}</td>
              <td className="py-1 pr-3">{dayOutcome(day, today)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DayGrid = ({ heatmap, today }: { heatmap: Heatmap; today: string }) => {
  const [hoveredDay, setHoveredDay] = useState<ProgressHeatmapDay | null>(null);
  const weekdays = Array.from(
    { length: 7 },
    (_, index) => ((heatmap.weekStartsOn - 1 + index) % 7) + 1
  ).map((value) => WEEKDAYS.find((day) => day.value === value));
  const columns = buildWeekColumns(heatmap.days);

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1.5">
          <div aria-hidden="true" className="flex gap-1.5">
            <span className="w-3.5 shrink-0" />
            <div className="flex gap-1">
              {columns.map((column) => (
                <span
                  key={column.days[0]?.date ?? "empty"}
                  className="text-muted-foreground relative h-5 w-4 shrink-0 text-sm leading-none sm:w-5"
                >
                  {column.monthLabel ? (
                    <span className="absolute left-0 whitespace-nowrap">
                      {column.monthLabel}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-1.5">
            <div aria-hidden="true" className="grid w-3.5 grid-rows-7 gap-1">
              {weekdays.map((day) => (
                <span
                  key={day?.value}
                  className="text-muted-foreground flex h-4 items-center text-sm leading-none sm:h-5"
                >
                  {day?.short.slice(0, 1)}
                </span>
              ))}
            </div>
            <div
              aria-hidden="true"
              className="flex gap-1"
              onMouseLeave={() => setHoveredDay(null)}
            >
              {columns.map((column) => (
                <div
                  key={column.days[0]?.date ?? "col"}
                  className="grid grid-rows-7 gap-1"
                >
                  {column.days.map((day) => (
                    <span
                      key={day.date}
                      onMouseEnter={() => setHoveredDay(day)}
                      className={cn(
                        "flex size-4 items-center justify-center rounded-[4px] border transition-colors sm:size-5",
                        INTENSITY_CLASS[day.intensity],
                        day.date === today && "ring-foreground/35 ring-1",
                        hoveredDay?.date === day.date &&
                          "ring-foreground ring-1"
                      )}
                    >
                      {day.extras > 0 ? (
                        <span className="bg-warm size-1 rounded-full sm:size-1.5" />
                      ) : null}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm"
      >
        <span className="min-h-5 tabular-nums">
          {hoveredDay ? hoveredDaySummary(hoveredDay, today) : null}
        </span>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span>Less</span>
            {LEGEND_LEVELS.map((level) => (
              <span
                key={level}
                className={cn(
                  "size-3 rounded-[3px] border",
                  INTENSITY_CLASS[level]
                )}
              />
            ))}
            <span>More</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="bg-muted flex size-3 items-center justify-center rounded-[3px]">
              <span className="bg-warm size-1 rounded-full" />
            </span>
            <span>Extra</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ProgressHeatmap = ({
  heatmap,
  today,
  defaultAsTable = false,
}: {
  heatmap: Heatmap;
  today: string;
  defaultAsTable?: boolean;
}) => {
  const [asTable, setAsTable] = useState(defaultAsTable);

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

      {asTable ? null : (
        <p className="sr-only">
          The heatmap is visual only. Use View as table to read the daily
          record.
        </p>
      )}
      <div
        id="progress-heatmap-table"
        className="bg-card mt-2 rounded-2xl border p-4"
      >
        {asTable ? (
          <DayTable days={heatmap.days} today={today} />
        ) : (
          <DayGrid heatmap={heatmap} today={today} />
        )}
      </div>
    </section>
  );
};
