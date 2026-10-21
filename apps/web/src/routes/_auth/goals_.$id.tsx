import type { GoalDetailStatsDto } from "@mostly/api/routers/stats";
import { Button } from "@mostly/ui/components/button";
import { cn } from "@mostly/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { GoalEditor } from "@/components/goal-editor";
import { GoalHistory } from "@/components/goal-history";
import { RecentDays } from "@/components/recent-days";
import {
  PRIORITY_LABELS,
  cadenceSummary,
  effectiveCadence,
  formatDayMonth,
  isArchived,
  timingNote,
} from "@/lib/goals";
import { useSyncStatus } from "@/lib/offline";
import { useOnline } from "@/lib/online";
import { orpc } from "@/utils/orpc";

const unitCount = (count: number, unit: GoalDetailStatsDto["unit"]): string =>
  unit === "week"
    ? `${count} ${count === 1 ? "week" : "weeks"}`
    : `${count} ${count === 1 ? "day" : "days"}`;

const streakValue = (
  count: number,
  unit: GoalDetailStatsDto["unit"]
): string =>
  count === 0 ? "No streak yet" : `${unitCount(count, unit)} in a row`;

const bestValue = (count: number, unit: GoalDetailStatsDto["unit"]): string =>
  count === 0 ? "No streak yet" : `Best: ${unitCount(count, unit)}`;

const consistencyValue = (stats: GoalDetailStatsDto): string => {
  const { consistency } = stats;
  if (consistency.percent !== null) {
    return `${consistency.percent}%`;
  }
  if (consistency.expected === 0) {
    return "Just started";
  }
  return `${consistency.done} of ${consistency.expected}`;
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

const Stat = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) => (
  <div className="bg-card rounded-2xl border p-4">
    <dt className="text-muted-foreground text-sm">{label}</dt>
    <dd className="mt-1 text-xl font-medium">{value}</dd>
    {detail ? (
      <dd className="text-muted-foreground mt-1 text-sm">{detail}</dd>
    ) : null}
  </div>
);

const StatRow = ({ stats }: { stats: GoalDetailStatsDto }) => (
  <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
    {stats.currentStreak === null ? null : (
      <Stat
        label="Current streak"
        value={streakValue(stats.currentStreak, stats.unit)}
      />
    )}
    <Stat label="Best streak" value={bestValue(stats.bestStreak, stats.unit)} />
    <Stat label="Consistency" value={consistencyValue(stats)} />
    <Stat label="Sessions" value={String(stats.sessions)} />
    {stats.minutes.withMinutes >= 3 ? (
      <Stat
        label="Minutes"
        value={formatMinutes(stats.minutes.total)}
        detail={`from ${stats.minutes.withMinutes} of ${stats.minutes.sessions} sessions${
          stats.minutes.average === null
            ? ""
            : ` · ${stats.minutes.average} min average`
        }`}
      />
    ) : null}
  </dl>
);

const StreakHistory = ({ stats }: { stats: GoalDetailStatsDto }) => {
  const earlier = stats.eras.slice(0, -1).toReversed();
  if (earlier.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="streak-history-heading" className="mt-8">
      <h2 id="streak-history-heading" className="text-lg font-medium">
        Streak history
      </h2>
      <ol className="mt-2 space-y-1 text-sm">
        {earlier.map((era) => (
          <li key={era.startDate} className="text-muted-foreground">
            {formatDayMonth(era.startDate)} – {formatDayMonth(era.endDate)} ·{" "}
            {era.bestStreak === 0
              ? "No streak"
              : unitCount(era.bestStreak, era.unit)}
          </li>
        ))}
      </ol>
    </section>
  );
};

const GoalDetailPage = () => {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const online = useOnline();
  const syncStatus = useSyncStatus();
  const [editing, setEditing] = useState(false);
  const editTrigger = useRef<HTMLButtonElement>(null);
  const detailQuery = useQuery(orpc.stats.goal.queryOptions({ input: { id } }));
  const detail = detailQuery.data;

  useEffect(() => {
    if (syncStatus.lastSyncedAt !== null) {
      void queryClient.invalidateQueries({
        queryKey: orpc.stats.goal.queryKey({ input: { id } }),
      });
    }
  }, [syncStatus.lastSyncedAt, queryClient, id]);

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.stats.goal.queryKey({ input: { id } }),
    });
  };

  if (detailQuery.isPending) {
    return (
      <div className="max-w-[840px]">
        <p className="text-muted-foreground text-sm">Loading goal…</p>
      </div>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <div className="max-w-[840px] space-y-3">
        <p role="alert" className="text-destructive text-sm">
          Could not load this goal.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => detailQuery.refetch()}
          className="min-h-11 rounded-full px-4 text-sm"
        >
          Retry
        </Button>
        <p>
          <Link to="/goals" className="text-sm underline underline-offset-4">
            Back to goals
          </Link>
        </p>
      </div>
    );
  }

  const { goal, today } = detail;
  const archived = isArchived(goal, today);
  const cadence = cadenceSummary(effectiveCadence(goal, today));
  const note = timingNote(goal, today);
  const closeEditor = () => {
    setEditing(false);
    requestAnimationFrame(() => editTrigger.current?.focus());
  };

  let content: ReactNode = null;
  if (editing) {
    content = (
      <GoalEditor
        key={goal.id}
        goal={goal}
        onClose={closeEditor}
        onDone={() => {
          closeEditor();
          refresh();
        }}
        onDeleted={() => navigate({ to: "/goals" })}
      />
    );
  } else if (detail.futureStart) {
    content = (
      <div className="bg-card mt-6 rounded-2xl border p-6">
        <p className="text-lg font-medium">
          Starts {formatDayMonth(detail.startsOn ?? goal.startDate)}
        </p>
      </div>
    );
  } else if (detail.stats && detail.heatmap) {
    content = (
      <>
        <StatRow stats={detail.stats} />
        <GoalHistory heatmap={detail.heatmap} color={goal.color} />
        <RecentDays
          goal={goal}
          today={today}
          readOnly={detail.readOnly}
          unit={detail.stats.unit}
          recentDays={detail.recentDays}
        />
        <StreakHistory stats={detail.stats} />
      </>
    );
  }

  return (
    <div className="max-w-[840px]">
      <Link
        to="/goals"
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Goals
      </Link>

      <header className="mt-2 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center text-3xl"
        >
          {goal.emoji ?? (
            <span
              className="bg-muted-foreground/40 size-3 rounded-full"
              style={goal.color ? { backgroundColor: goal.color } : undefined}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] leading-tight font-medium break-words">
            {goal.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span
              className={cn(
                "rounded-full border px-2 py-1",
                goal.priority === "high"
                  ? "border-foreground/30 text-foreground"
                  : "border-border text-muted-foreground"
              )}
            >
              {PRIORITY_LABELS[goal.priority]}
            </span>
            <span className="border-border text-muted-foreground rounded-full border px-2 py-1">
              {cadence}
            </span>
            {note && !detail.futureStart ? (
              <span className="text-muted-foreground">{note}</span>
            ) : null}
          </div>
        </div>
        <Button
          ref={editTrigger}
          type="button"
          variant="outline"
          onClick={() => setEditing(true)}
          disabled={!online || editing}
          aria-label={`${archived ? "Manage" : "Edit"} ${goal.name}`}
          className="min-h-11 shrink-0 rounded-full px-4 text-sm"
        >
          {archived ? "Manage" : "Edit"}
        </Button>
      </header>

      {online ? null : (
        <output className="border-border bg-muted mt-4 block rounded-xl border p-3 text-sm">
          Connect to edit goals.
        </output>
      )}

      {content}
    </div>
  );
};

export const Route = createFileRoute("/_auth/goals_/$id")({
  component: GoalDetailPage,
});
