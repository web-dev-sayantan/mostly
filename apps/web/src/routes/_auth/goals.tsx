import type { GoalDto } from "@mostly/api/routers/goals";
import { Button } from "@mostly/ui/components/button";
import { cn } from "@mostly/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { GoalEditor } from "@/components/goal-editor";
import {
  PRIORITY_LABELS,
  cadenceSummary,
  effectiveCadence,
  isArchived,
  localToday,
  timingNote,
} from "@/lib/goals";
import { useOnline } from "@/lib/online";
import { orpc } from "@/utils/orpc";

type Filter = "active" | "archived";
type EditorState = { goal: GoalDto | null } | null;

const PRIORITY_RANK: Record<GoalDto["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const GoalRow = ({
  goal,
  today,
  online,
  onEdit,
}: {
  goal: GoalDto;
  today: string;
  online: boolean;
  onEdit: (goal: GoalDto) => void;
}) => {
  const cadence = cadenceSummary(effectiveCadence(goal, today));
  const note = timingNote(goal, today);
  const archived = isArchived(goal, today);

  return (
    <li className="bg-card flex items-center rounded-2xl border">
      <Link
        to="/goals/$id"
        params={{ id: goal.id }}
        className="focus-visible:ring-ring/50 flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-l-2xl px-4 py-3 focus-visible:ring-1 focus-visible:outline-none"
      >
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center text-xl"
        >
          {goal.emoji ?? (
            <span
              className="bg-muted-foreground/40 size-2.5 rounded-full"
              style={goal.color ? { backgroundColor: goal.color } : undefined}
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-base font-medium",
              archived && "text-muted-foreground"
            )}
          >
            {goal.name}
          </span>
          <span className="text-muted-foreground block text-sm">
            {note ? `${cadence} · ${note}` : cadence}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-1 text-sm",
            goal.priority === "high"
              ? "border-foreground/30 text-foreground"
              : "border-border text-muted-foreground"
          )}
        >
          {PRIORITY_LABELS[goal.priority]}
        </span>
      </Link>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onEdit(goal)}
        disabled={!online}
        aria-label={`${archived ? "Manage" : "Edit"} ${goal.name}`}
        className="mr-1 min-h-11 shrink-0 rounded-full px-3 text-sm"
      >
        {archived ? "Manage" : "Edit"}
      </Button>
    </li>
  );
};

const GoalsPage = () => {
  const [filter, setFilter] = useState<Filter>("active");
  const [editor, setEditor] = useState<EditorState>(null);
  const online = useOnline();
  const today = localToday();
  const goalsQuery = useQuery(orpc.goals.list.queryOptions());

  const all = [
    ...(goalsQuery.data?.active ?? []),
    ...(goalsQuery.data?.archived ?? []),
  ];
  const visible = all
    .filter((goal) =>
      filter === "archived" ? isArchived(goal, today) : !isArchived(goal, today)
    )
    .toSorted(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.createdAt.localeCompare(b.createdAt)
    );

  return (
    <div className="max-w-[720px]">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-[28px] leading-tight font-medium">Goals</h1>
        {editor ? null : (
          <Button
            type="button"
            onClick={() => setEditor({ goal: null })}
            disabled={!online}
            className="min-h-11 rounded-full px-4 text-sm"
          >
            <Plus aria-hidden="true" className="size-4" />
            New goal
          </Button>
        )}
      </header>

      {online ? null : (
        <output className="border-border bg-muted mt-4 block rounded-xl border p-3 text-sm">
          Connect to edit goals.
        </output>
      )}

      {editor ? (
        <GoalEditor
          key={editor.goal?.id ?? "new"}
          goal={editor.goal}
          onClose={() => setEditor(null)}
          onDone={() => setEditor(null)}
        />
      ) : (
        <>
          <fieldset className="border-border mt-4 inline-flex rounded-full border p-1">
            <legend className="sr-only">Goal status</legend>
            {(
              [
                { value: "active", label: "Active" },
                { value: "archived", label: "Archived" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  "min-h-11 rounded-full px-4 text-sm",
                  filter === option.value && "bg-accent text-accent-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </fieldset>

          {goalsQuery.isPending ? (
            <p className="text-muted-foreground mt-6 text-sm">Loading goals…</p>
          ) : null}

          {goalsQuery.isError ? (
            <div className="mt-6 space-y-3">
              <p role="alert" className="text-destructive text-sm">
                Could not load goals.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => goalsQuery.refetch()}
                className="min-h-11 rounded-full px-4 text-sm"
              >
                Retry
              </Button>
            </div>
          ) : null}

          {goalsQuery.isSuccess && visible.length === 0 ? (
            <p className="text-muted-foreground mt-6 text-sm">
              {filter === "active"
                ? "No goals yet. Start with one small thing."
                : "No archived goals."}
            </p>
          ) : null}

          {visible.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {visible.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  today={today}
                  online={online}
                  onEdit={(entry) => setEditor({ goal: entry })}
                />
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
};

export const Route = createFileRoute("/_auth/goals")({
  component: GoalsPage,
});
