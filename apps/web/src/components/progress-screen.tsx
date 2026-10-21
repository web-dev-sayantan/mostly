import type {
  ProgressGoalCard,
  ProgressRange,
  ProgressResult,
  ProgressToday,
  ProgressWeekCell,
  ProgressWeekStatus,
  ProgressWeeklyRow,
} from "@mostly/domain";
import { PROGRESS_RANGES } from "@mostly/domain";
import { cn } from "@mostly/ui/lib/utils";
import { Link } from "@tanstack/react-router";

import { PRIORITY_LABELS, formatDayMonth } from "@/lib/goals";

import { ProgressHeatmap } from "./progress-heatmap";

const WEEK_CLASS: Record<ProgressWeekStatus, string> = {
  met: "border-transparent bg-primary text-primary-foreground",
  partial: "border-warm/50 bg-warm/25 text-foreground",
  none: "border-border bg-muted text-muted-foreground",
  not_scored: "border-border border-dashed text-muted-foreground",
};

const WEEK_GLYPH: Record<ProgressWeekStatus, string> = {
  met: "✓",
  partial: "·",
  none: "",
  not_scored: "–",
};

const DOT_CLASS: Record<ProgressGoalCard["days"][number]["status"], string> = {
  done: "border-transparent bg-primary",
  missed: "border-transparent bg-muted-foreground/25",
  open: "border-foreground/40 bg-transparent",
  none: "border-border bg-transparent",
};

const weekLabel = (status: ProgressWeekStatus): string => {
  if (status === "met") {
    return "Target met";
  }
  if (status === "partial") {
    return "Some sessions";
  }
  if (status === "not_scored") {
    return "Not enough days this week";
  }
  return "No session";
};

const formatMinutes = (total: number): string => {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${minutes} min`;
};

const streakCopy = (card: ProgressGoalCard): string => {
  if (card.currentStreak === null || card.currentStreak === 0) {
    return "No streak yet";
  }
  const unit = card.unit === "week" ? "week" : "day";
  return `${card.currentStreak} ${unit}${card.currentStreak === 1 ? "" : "s"} in a row`;
};

const consistencyValue = (card: ProgressGoalCard): string => {
  if (card.consistency.percent !== null) {
    return `${card.consistency.percent}%`;
  }
  if (card.consistency.expected === 0) {
    return "Just started";
  }
  return `${card.consistency.done} of ${card.consistency.expected}`;
};

const WeekCells = ({
  weeks,
  label,
  compact = false,
}: {
  weeks: ProgressWeekCell[];
  label: string;
  compact?: boolean;
}) => (
  <div className="shrink-0">
    <ol aria-hidden="true" className="flex gap-1">
      {weeks.map((week) => (
        <li
          key={week.weekStart}
          className={cn(
            "flex items-center justify-center rounded-[4px] border text-sm leading-none",
            compact ? "size-4" : "size-7",
            WEEK_CLASS[week.status]
          )}
        >
          {WEEK_GLYPH[week.status]}
        </li>
      ))}
    </ol>
    <span className="sr-only">
      {label}:{" "}
      {weeks
        .map(
          (week) =>
            `${formatDayMonth(week.weekStart)} to ${formatDayMonth(week.weekEnd)} ${weekLabel(week.status)}`
        )
        .join("; ")}
      .
    </span>
  </div>
);

const DayDots = ({ card }: { card: ProgressGoalCard }) => (
  <div>
    <ol aria-hidden="true" className="flex gap-1.5">
      {card.days.map((dot) => (
        <li
          key={dot.date}
          className={cn(
            "size-2.5 rounded-full border",
            DOT_CLASS[dot.status],
            dot.extra && "ring-warm/60 ring-2"
          )}
        />
      ))}
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
  <fieldset className="border-border inline-flex rounded-full border p-1">
    <legend className="sr-only">Progress range</legend>
    {PROGRESS_RANGES.map((value) => (
      <button
        key={value}
        type="button"
        aria-pressed={range === value}
        aria-label={`${value} days`}
        onClick={() => onChange(value)}
        className={cn(
          "focus-visible:ring-ring/50 min-h-11 rounded-full px-3 text-sm tabular-nums focus-visible:ring-2 focus-visible:outline-none",
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
      className="bg-card focus-visible:ring-ring/50 mt-4 flex min-h-11 flex-wrap items-center gap-x-2 rounded-2xl border px-4 py-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="font-medium">
        {today.done} of {today.total} today
      </span>
      <span aria-hidden="true">·</span>
      <span>
        Close the day <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
};

const Hero = ({ result }: { result: ProgressResult }) => {
  const { consistency, sessions, minutes } = result.hero;

  return (
    <section aria-labelledby="progress-hero-heading" className="mt-6">
      <h2
        id="progress-hero-heading"
        className="text-muted-foreground text-sm font-medium tracking-wide uppercase"
      >
        Average goal consistency
      </h2>
      <div className="mt-2">
        {consistency.percent === null ? (
          <p className="text-xl font-medium">Not enough data yet.</p>
        ) : (
          <>
            <p className="text-[28px] leading-tight font-medium tabular-nums">
              {consistency.percent}%
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Based on {consistency.qualifying} of {consistency.total} goals.
            </p>
          </>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="bg-card rounded-2xl border p-4">
          <dt className="text-muted-foreground text-sm">Sessions</dt>
          <dd className="mt-1 text-xl font-medium tabular-nums">{sessions}</dd>
        </div>
        {minutes.withMinutes >= 3 ? (
          <div className="bg-card rounded-2xl border p-4">
            <dt className="text-muted-foreground text-sm">Minutes</dt>
            <dd className="mt-1 text-xl font-medium tabular-nums">
              {formatMinutes(minutes.total)}
            </dd>
            <dd className="text-muted-foreground mt-1 text-sm">
              from {minutes.withMinutes} of {minutes.sessions} sessions
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
};

const WeeklyStrip = ({ rows }: { rows: ProgressWeeklyRow[] }) => {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="progress-weekly-heading" className="mt-8">
      <h2
        id="progress-weekly-heading"
        className="text-muted-foreground text-sm font-medium tracking-wide uppercase"
      >
        Weekly targets
      </h2>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li
            key={row.goalId}
            className="bg-card flex items-center gap-3 overflow-x-auto rounded-2xl border p-3"
          >
            <Link
              to="/goals/$id"
              params={{ id: row.goalId }}
              className="focus-visible:ring-ring/50 flex min-h-11 w-32 shrink-0 items-center gap-2 rounded-lg focus-visible:ring-1 focus-visible:outline-none"
            >
              <span aria-hidden="true" className="text-lg">
                {row.emoji ?? (
                  <span
                    className="bg-muted-foreground/40 block size-2.5 rounded-full"
                    style={
                      row.color ? { backgroundColor: row.color } : undefined
                    }
                  />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {row.name}
                </span>
                <span className="text-muted-foreground block text-sm">
                  {row.target} {row.target === 1 ? "time" : "times"} a week
                </span>
              </span>
            </Link>
            <WeekCells
              weeks={row.weeks}
              label={`${row.name} weekly outcomes`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
};

const GoalCard = ({
  card,
  range,
}: {
  card: ProgressGoalCard;
  range: ProgressRange;
}) => (
  <Link
    to="/goals/$id"
    params={{ id: card.goalId }}
    className="bg-card focus-visible:ring-ring/50 block min-h-11 rounded-2xl border p-4 focus-visible:ring-2 focus-visible:outline-none"
  >
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="text-2xl">
        {card.emoji ?? (
          <span
            className="bg-muted-foreground/40 block size-3 rounded-full"
            style={card.color ? { backgroundColor: card.color } : undefined}
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium">
          {card.name}
        </span>
        <span className="text-muted-foreground block text-sm">
          {streakCopy(card)}
        </span>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full border px-2 py-1 text-sm",
          card.priority === "high"
            ? "border-foreground/30 text-foreground"
            : "border-border text-muted-foreground"
        )}
      >
        {PRIORITY_LABELS[card.priority]}
      </span>
    </div>

    <div className="mt-4 flex items-end justify-between gap-3">
      {card.unit === "week" ? (
        <WeekCells
          weeks={card.weeks}
          label={`${card.name} last 7 weeks`}
          compact
        />
      ) : (
        <DayDots card={card} />
      )}
      <span className="shrink-0 text-right text-sm">
        <span className="block font-medium tabular-nums">
          {consistencyValue(card)}
        </span>
        <span className="text-muted-foreground block">
          consistency · {range} days
        </span>
      </span>
    </div>
  </Link>
);

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
      <h2
        id="progress-goals-heading"
        className="text-muted-foreground text-sm font-medium tracking-wide uppercase"
      >
        Goals
      </h2>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.goalId}>
            <GoalCard card={card} range={range} />
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
          className="focus-visible:ring-ring/50 mt-4 inline-flex min-h-11 items-center rounded-full text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
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
        <WeeklyStrip rows={result.weekly} />
        <GoalCards cards={result.cards} range={result.range} />
      </>
    )}
  </div>
);
