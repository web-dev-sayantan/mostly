import type {
  ProgressGoalCard,
  ProgressRange,
  ProgressResult,
  ProgressToday,
  ProgressWeekCell,
  ProgressWeekStatus,
} from "@mostly/domain";
import { PROGRESS_RANGES } from "@mostly/domain";
import { cn } from "@mostly/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { formatDayMonth } from "@/lib/goals";
import {
  consistencyValue as formatConsistency,
  formatMinutes,
  NOT_SCORED_COPY,
} from "@/lib/stats-format";

import { ProgressHeatmap } from "./progress-heatmap";

const WEEK_CLASS: Record<ProgressWeekStatus, string> = {
  met: "border-transparent bg-primary text-primary-foreground",
  partial: "border-warm/50 bg-warm/20 text-foreground",
  none: "border-border bg-muted text-muted-foreground",
  not_scored: "border-border border-dashed text-muted-foreground",
};

const DOT_CLASS: Record<ProgressGoalCard["days"][number]["status"], string> = {
  done: "border-transparent bg-primary",
  missed: "border-transparent bg-muted-foreground/25",
  open: "border-foreground/45 bg-transparent",
  none: "border-border bg-transparent",
};

const weekLabel = (week: ProgressWeekCell): string => {
  if (week.status === "met") {
    return `Target met (${week.sessions} sessions)`;
  }
  if (week.status === "partial") {
    return `${week.sessions} of ${week.target} this week`;
  }
  if (week.status === "not_scored") {
    return NOT_SCORED_COPY;
  }
  return "No session";
};

export const cardMetaCopy = (card: ProgressGoalCard): string | null => {
  const parts: string[] = [];

  if (card.unit === "week") {
    const currentWeek = card.weeks.at(-1);
    if (
      currentWeek &&
      currentWeek.status !== "not_scored" &&
      currentWeek.target > 0
    ) {
      parts.push(`${currentWeek.sessions}/${currentWeek.target} this week`);
    }
  }

  if (card.currentStreak !== null && card.currentStreak > 0) {
    const unit = card.unit === "week" ? "w" : "d";
    parts.push(`${card.currentStreak}${unit} streak`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
};

const WeekCells = ({
  weeks,
  label,
}: {
  weeks: ProgressWeekCell[];
  label: string;
}) => (
  <div className="shrink-0">
    <ol aria-hidden="true" className="flex gap-1.5">
      {weeks.map((week, index) => {
        const isCurrent = index === weeks.length - 1;
        return (
          <li
            key={week.weekStart}
            className={cn(
              "flex size-6 items-center justify-center rounded-md border text-sm leading-none",
              WEEK_CLASS[week.status],
              isCurrent &&
                "ring-foreground/30 ring-offset-card ring-1 ring-offset-1"
            )}
          >
            {week.status === "met" ? (
              <Check
                aria-hidden="true"
                className="size-3.5"
                strokeWidth={2.5}
              />
            ) : null}
            {week.status === "partial" ? (
              <span className="bg-warm size-1.5 rounded-full" />
            ) : null}
            {week.status === "not_scored" ? "–" : null}
          </li>
        );
      })}
    </ol>
    <span className="sr-only">
      {label}:{" "}
      {weeks
        .map(
          (week) =>
            `${formatDayMonth(week.weekStart)} to ${formatDayMonth(week.weekEnd)} ${weekLabel(week)}`
        )
        .join("; ")}
      .
    </span>
  </div>
);

const DayDots = ({ card }: { card: ProgressGoalCard }) => (
  <div>
    <ol aria-hidden="true" className="flex items-center gap-1.5">
      {card.days.map((dot, index) => {
        const isToday = index === card.days.length - 1;
        return (
          <li
            key={dot.date}
            className={cn(
              "size-3 rounded-full border",
              DOT_CLASS[dot.status],
              dot.extra && "ring-warm/60 ring-2",
              isToday &&
                !dot.extra &&
                dot.status !== "open" &&
                "ring-foreground/30 ring-offset-card ring-1 ring-offset-1"
            )}
          />
        );
      })}
    </ol>
    <span className="sr-only">
      Last 7 days:{" "}
      {card.days
        .map((dot) => {
          const status =
            dot.extra && dot.status === "done"
              ? "done as an extra"
              : dot.status;
          return `${formatDayMonth(dot.date)} ${status}`;
        })
        .join("; ")}
      .
    </span>
  </div>
);

const RangeSelector = ({
  range,
  onChange,
}: {
  range: ProgressRange;
  onChange: (range: ProgressRange) => void;
}) => (
  <fieldset className="border-border bg-card inline-flex rounded-full border p-1">
    <legend className="sr-only">Progress range</legend>
    {PROGRESS_RANGES.map((value) => (
      <button
        key={value}
        type="button"
        aria-pressed={range === value}
        aria-label={`${value} days`}
        onClick={() => onChange(value)}
        className={cn(
          "focus-visible:ring-ring min-h-11 rounded-full px-3.5 text-sm font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
          range === value
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {value}D
      </button>
    ))}
  </fieldset>
);

const TodayBanner = ({ today }: { today: ProgressToday }) => {
  if (!today.incomplete) {
    return null;
  }

  return (
    <Link
      to="/today"
      className="bg-accent/55 border-primary/20 hover:bg-accent/80 focus-visible:ring-ring mt-4 flex min-h-11 items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="font-medium tabular-nums">
        {today.done} of {today.total} today
      </span>
      <span className="text-foreground/80">
        Close the day <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
};

const Hero = ({ result }: { result: ProgressResult }) => {
  const { consistency, sessions, minutes } = result.hero;
  const showMinutes = minutes.withMinutes >= 3;

  return (
    <section aria-label="Summary" className="mt-6">
      <dl
        className={cn(
          "grid gap-3",
          showMinutes ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"
        )}
      >
        <div className="bg-card rounded-2xl border p-4">
          <dt className="text-muted-foreground text-sm">Consistency</dt>
          {consistency.percent === null ? (
            <dd className="text-muted-foreground mt-1 text-base font-medium">
              Not enough data
            </dd>
          ) : (
            <>
              <dd className="mt-1 text-2xl font-medium tabular-nums">
                {consistency.percent}%
              </dd>
              {consistency.qualifying < consistency.total ? (
                <dd className="text-muted-foreground mt-0.5 text-sm tabular-nums">
                  {consistency.qualifying} of {consistency.total} goals
                </dd>
              ) : null}
            </>
          )}
        </div>

        <div className="bg-card rounded-2xl border p-4">
          <dt className="text-muted-foreground text-sm">Sessions</dt>
          <dd className="mt-1 text-2xl font-medium tabular-nums">{sessions}</dd>
        </div>

        {showMinutes ? (
          <div className="bg-card col-span-2 rounded-2xl border p-4 sm:col-span-1">
            <dt className="text-muted-foreground text-sm">Time</dt>
            <dd className="mt-1 text-2xl font-medium tabular-nums">
              {formatMinutes(minutes.total)}
            </dd>
            <dd className="text-muted-foreground mt-0.5 text-sm tabular-nums">
              {minutes.withMinutes}/{minutes.sessions} logged
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
};

const GoalCard = ({ card }: { card: ProgressGoalCard }) => {
  const meta = cardMetaCopy(card);
  const consistency = formatConsistency(card.consistency);
  const isMutedConsistency = card.consistency.percent === null;

  return (
    <Link
      to="/goals/$id"
      params={{ id: card.goalId }}
      className="bg-card hover:border-foreground/25 hover:bg-muted/30 focus-visible:ring-ring flex min-h-11 flex-col justify-between gap-4 rounded-2xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center text-xl"
          >
            {card.emoji ?? (
              <span
                className="bg-muted-foreground/40 block size-3 rounded-full"
                style={card.color ? { backgroundColor: card.color } : undefined}
              />
            )}
          </span>
          <div className="min-w-0">
            <span className="block truncate text-base font-medium">
              {card.name}
            </span>
            {meta ? (
              <span className="text-muted-foreground block truncate text-sm tabular-nums">
                {meta}
              </span>
            ) : null}
          </div>
        </div>

        <span
          className={cn(
            "shrink-0 tabular-nums",
            isMutedConsistency
              ? "text-muted-foreground text-sm"
              : "text-lg font-medium"
          )}
        >
          {consistency}
        </span>
      </div>

      {card.unit === "week" ? (
        <WeekCells weeks={card.weeks} label={`${card.name} last 7 weeks`} />
      ) : (
        <DayDots card={card} />
      )}
    </Link>
  );
};

const GoalCards = ({
  cards,
  range,
}: {
  cards: ProgressGoalCard[];
  range: ProgressRange;
}) => {
  if (cards.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="progress-goals-heading" className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="progress-goals-heading"
          className="text-muted-foreground text-sm font-medium tracking-wide uppercase"
        >
          Goals
        </h2>
        <span className="text-muted-foreground text-sm tabular-nums">
          Last {range} days
        </span>
      </div>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.goalId}>
            <GoalCard card={card} />
          </li>
        ))}
      </ul>
    </section>
  );
};

const EmptyState = ({ today }: { today: ProgressToday }) => (
  <section aria-labelledby="progress-empty-heading" className="mt-6">
    <div className="bg-card rounded-2xl border p-6">
      <h2 id="progress-empty-heading" className="text-lg font-medium">
        Progress fills in after a week.
      </h2>
      {today.total === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">
          Nothing scheduled today.
        </p>
      ) : (
        <p className="text-muted-foreground mt-2 text-sm">
          {today.done} of {today.total} today
        </p>
      )}

      {today.total > 0 ? (
        <div className="mt-4">
          <ol aria-hidden="true" className="flex gap-1.5">
            {today.goals.map((goal) => (
              <li
                key={goal.goalId}
                className={cn(
                  "size-2.5 rounded-full border",
                  goal.done
                    ? "bg-primary border-transparent"
                    : "border-foreground/40 bg-transparent"
                )}
              />
            ))}
          </ol>
          <span className="sr-only">
            {today.goals
              .map((goal) => `${goal.name}: ${goal.done ? "done" : "not yet"}`)
              .join("; ")}
            .
          </span>
        </div>
      ) : null}

      {today.incomplete ? (
        <Link
          to="/today"
          className="focus-visible:ring-ring mt-4 inline-flex min-h-11 items-center rounded-full text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
        >
          Close the day <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </div>
  </section>
);

export const ProgressScreen = ({
  result,
  range,
  onRangeChange,
}: {
  result: ProgressResult;
  range: ProgressRange;
  onRangeChange: (range: ProgressRange) => void;
}) => (
  <div className="max-w-[960px]">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-[28px] leading-tight font-medium">Progress</h1>
      <RangeSelector range={range} onChange={onRangeChange} />
    </header>

    {result.empty ? (
      <EmptyState today={result.todayProgress} />
    ) : (
      <>
        <TodayBanner today={result.todayProgress} />
        <Hero result={result} />
        <ProgressHeatmap heatmap={result.heatmap} today={result.today} />
        <GoalCards cards={result.cards} range={result.range} />
      </>
    )}
  </div>
);
