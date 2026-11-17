import type { GoalDayCellDto, GoalHeatmapDto } from "@mostly/api/routers/stats";
import type { GoalWeek } from "@mostly/domain";
import { Button } from "@mostly/ui/components/button";
import { cn } from "@mostly/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { WEEKDAYS, formatDayMonth } from "@/lib/goals";
import { NOT_SCORED_COPY } from "@/lib/stats-format";
import { formatLogicalDate } from "@/lib/time";

const DAY_OUTCOME: Record<GoalDayCellDto["status"], string> = {
  done: "Done",
  missed: "Missed",
  open: "Open",
  none: "No expectation",
};

const WEEK_OUTCOME: Record<GoalWeek["status"], string> = {
  met: "Met",
  missed: "Missed",
  in_progress: "In progress",
  not_scored: NOT_SCORED_COPY,
};

const dayOutcome = (day: GoalDayCellDto): string => {
  if (day.status === "done" && day.extra) {
    return "Done (extra)";
  }
  return DAY_OUTCOME[day.status];
};

const weekLabel = (week: GoalWeek): string => {
  if (week.status === "met" && !week.completed) {
    return "Target met";
  }
  if (week.status === "not_scored") {
    return "Not scored";
  }
  return WEEK_OUTCOME[week.status];
};

const cellClass = (status: GoalDayCellDto["status"]): string => {
  if (status === "done") {
    return "border-transparent";
  }
  if (status === "missed") {
    return "border-border bg-muted-foreground/20";
  }
  if (status === "open") {
    return "border-dashed border-foreground/30";
  }
  return "border-border/60";
};

const DayTable = ({ days }: { days: GoalDayCellDto[] }) => (
  <div className="mt-4 overflow-x-auto">
    <table className="w-full min-w-[520px] text-left text-sm">
      <caption className="sr-only">Daily history for the last 12 weeks</caption>
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
            Extra
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
                className="hover:text-foreground text-muted-foreground focus-visible:ring-ring inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:ring-1 focus-visible:outline-none"
              >
                {formatLogicalDate(day.date)}
              </Link>
            </th>
            <td className="py-1 pr-3">{day.expected ? "1" : "0"}</td>
            <td className="py-1 pr-3">{day.status === "done" ? "1" : "0"}</td>
            <td className="py-1 pr-3">{day.extra ? "1" : "0"}</td>
            <td className="py-1">{dayOutcome(day)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const WeekTable = ({ weeks }: { weeks: GoalWeek[] }) => (
  <div className="mt-4 overflow-x-auto">
    <table className="w-full min-w-[520px] text-left text-sm">
      <caption className="sr-only">
        Weekly history for the last 12 weeks
      </caption>
      <thead>
        <tr className="border-border text-muted-foreground border-b">
          <th scope="col" className="py-2 pr-3 font-medium">
            Week
          </th>
          <th scope="col" className="py-2 pr-3 font-medium">
            Sessions
          </th>
          <th scope="col" className="py-2 pr-3 font-medium">
            Target
          </th>
          <th scope="col" className="py-2 font-medium">
            Outcome
          </th>
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr
            key={week.start}
            className="border-border/60 border-b last:border-0"
          >
            <th scope="row" className="py-1 pr-3 text-left font-normal">
              <Link
                to="/day/$date"
                params={{ date: week.start }}
                className="hover:text-foreground text-muted-foreground focus-visible:ring-ring inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:ring-1 focus-visible:outline-none"
              >
                {formatDayMonth(week.start)} – {formatDayMonth(week.end)}
              </Link>
            </th>
            <td className="py-1 pr-3">{week.sessions}</td>
            <td className="py-1 pr-3">{week.target ?? "—"}</td>
            <td className="py-1">{WEEK_OUTCOME[week.status]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const DayHeatmap = ({
  days,
  weekStartsOn,
  color,
}: {
  days: GoalDayCellDto[];
  weekStartsOn: number;
  color: string | null;
}) => {
  const weekdays = Array.from(
    { length: 7 },
    (_, index) => ((weekStartsOn - 1 + index) % 7) + 1
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
          {days.map((day) => (
            <span
              key={day.date}
              className={cn(
                "flex size-4 items-center justify-center rounded-[3px] border",
                cellClass(day.status)
              )}
              style={
                day.status === "done"
                  ? { backgroundColor: color ?? "var(--primary)" }
                  : undefined
              }
            >
              {day.extra ? (
                <span className="bg-background size-1 rounded-full" />
              ) : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const WeekStrip = ({ weeks }: { weeks: GoalWeek[] }) => (
  <ol
    className="mt-4 flex gap-2 overflow-x-auto pb-1"
    aria-label="Weekly outcomes for the last 12 weeks"
  >
    {weeks.map((week) => (
      <li
        key={week.start}
        className={cn(
          "min-h-14 min-w-[76px] shrink-0 rounded-xl border px-2 py-2 text-center",
          week.status === "met" &&
            "bg-primary text-primary-foreground border-transparent",
          week.status === "missed" && "bg-muted",
          week.status === "in_progress" && "border-dashed",
          week.status === "not_scored" && "text-muted-foreground border-border"
        )}
      >
        <span className="block text-sm font-medium">
          {week.target ? `${week.sessions}/${week.target}` : "—"}
        </span>
        <span className="block text-sm">{weekLabel(week)}</span>
        <span className="sr-only">
          {formatDayMonth(week.start)} to {formatDayMonth(week.end)}:{" "}
          {WEEK_OUTCOME[week.status]}
        </span>
      </li>
    ))}
  </ol>
);

export const GoalHistory = ({
  heatmap,
  color,
}: {
  heatmap: GoalHeatmapDto;
  color: string | null;
}) => {
  const [asTable, setAsTable] = useState(false);
  const table =
    heatmap.unit === "day" ? (
      <DayTable days={heatmap.days} />
    ) : (
      <WeekTable weeks={heatmap.weeks} />
    );
  const chart =
    heatmap.unit === "day" ? (
      <DayHeatmap
        days={heatmap.days}
        weekStartsOn={heatmap.weekStartsOn}
        color={color}
      />
    ) : (
      <WeekStrip weeks={heatmap.weeks} />
    );

  return (
    <section aria-labelledby="history-heading" className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 id="history-heading" className="text-lg font-medium">
          Last 12 weeks
        </h2>
        <Button
          type="button"
          variant="ghost"
          aria-expanded={asTable}
          aria-controls="history-table"
          onClick={() => setAsTable((open) => !open)}
          className="min-h-11 rounded-full px-3 text-sm"
        >
          {asTable ? "View as chart" : "View as table"}
        </Button>
      </div>

      <div id="history-table">{asTable ? table : chart}</div>
    </section>
  );
};
