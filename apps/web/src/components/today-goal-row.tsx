import type { GoalDto } from "@mostly/api/routers/goals";
import { cn } from "@mostly/ui/lib/utils";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cadenceSummary } from "@/lib/goals";
import { describeSession, detailsSummary } from "@/lib/session-details";
import type { TodayGoal, WeeklyGoal } from "@/lib/today";
import {
  hasSessionDetails,
  weeklyCountCopy,
  weeklyTargetCopy,
} from "@/lib/today";

const GoalMark = ({ goal }: { goal: GoalDto }) => (
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
);

const GoalName = ({
  goal,
  done,
  showDetailsDot,
}: {
  goal: GoalDto;
  done: boolean;
  showDetailsDot: boolean;
}) => (
  <span className="min-w-0">
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          "truncate text-base font-medium",
          done && "text-muted-foreground"
        )}
      >
        {goal.name}
      </span>
      {showDetailsDot ? (
        <span
          aria-hidden="true"
          className="bg-primary size-1.5 shrink-0 rounded-full"
        />
      ) : null}
    </span>
  </span>
);

const CheckTarget = ({
  goal,
  done,
  detailsOpen,
  detailsSupported,
  description,
  onMarkDone,
  onOpenDetails,
  registerTrigger,
}: {
  goal: GoalDto;
  done: boolean;
  detailsOpen: boolean;
  detailsSupported: boolean;
  description?: string;
  onMarkDone: (goal: GoalDto) => void;
  onOpenDetails?: (goalId: string) => void;
  registerTrigger?: (goalId: string, node: HTMLButtonElement | null) => void;
}) => {
  const canEditDetails = done && detailsSupported && onOpenDetails;
  let onClick: (() => void) | undefined = () => onMarkDone(goal);
  let label = `Mark ${goal.name} done`;
  if (done) {
    onClick = undefined;
    label = `${goal.name} done.`;
    if (canEditDetails) {
      onClick = () => onOpenDetails(goal.id);
      label = `${goal.name} done. Edit details.`;
    }
  }

  return (
    <button
      ref={(node) => registerTrigger?.(goal.id, node)}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-describedby={
        done && description ? `today-description-${goal.id}` : undefined
      }
      aria-expanded={canEditDetails ? detailsOpen : undefined}
      aria-controls={canEditDetails ? `today-panel-${goal.id}` : undefined}
      className="focus-visible:ring-ring/50 flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full border-2 transition-colors",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border"
        )}
      >
        {done ? (
          <Check
            aria-hidden="true"
            className="mostly-check size-4"
            strokeWidth={2.5}
          />
        ) : null}
      </span>
    </button>
  );
};

const UndoControl = ({
  goalName,
  onUndo,
}: {
  goalName: string;
  onUndo: () => void;
}) => (
  <div className="border-t px-2 py-0.5">
    <button
      type="button"
      onClick={onUndo}
      aria-label={`Undo ${goalName}`}
      className="text-primary focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      Undo
    </button>
  </div>
);

const AddDetails = ({
  goal,
  detailsOpen,
  onOpenDetails,
}: {
  goal: GoalDto;
  detailsOpen: boolean;
  onOpenDetails: (goalId: string) => void;
}) => (
  <button
    type="button"
    onClick={() => onOpenDetails(goal.id)}
    aria-label={`Add details for ${goal.name}`}
    aria-expanded={detailsOpen}
    aria-controls={`today-panel-${goal.id}`}
    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-full px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
  >
    Add details
  </button>
);

export interface TodayRowProps {
  detailsOpen: boolean;
  undoActive: boolean;
  details?: ReactNode;
  onMarkDone: (goal: GoalDto) => void;
  onOpenDetails?: (goalId: string) => void;
  onUndo: () => void;
  registerTrigger?: (goalId: string, node: HTMLButtonElement | null) => void;
}

export const TodayGoalRow = ({
  entry,
  detailsOpen,
  undoActive,
  details,
  onMarkDone,
  onOpenDetails,
  onUndo,
  registerTrigger,
}: TodayRowProps & { entry: TodayGoal }) => {
  const { goal, cadence, session } = entry;
  const done = session !== null;
  const detailsDot = hasSessionDetails(session);
  const detailsSupported = Boolean(onOpenDetails);
  const description = session ? describeSession(goal.name, session) : undefined;
  const summary = session ? detailsSummary(session) : null;

  const content = (
    <>
      <GoalMark goal={goal} />
      <span className="min-w-0 flex-1 text-left">
        <GoalName
          goal={goal}
          done={done}
          showDetailsDot={detailsDot && detailsSupported}
        />
        <span className="text-muted-foreground block truncate text-sm">
          {cadenceSummary(cadence)}
          {summary ? ` · ${summary}` : ""}
        </span>
      </span>
    </>
  );

  return (
    <li
      className={cn(
        "bg-card overflow-hidden rounded-2xl border",
        done && "bg-muted/40"
      )}
    >
      <div className="flex min-h-14 items-center">
        {done && onOpenDetails ? (
          <button
            type="button"
            onClick={() => onOpenDetails(goal.id)}
            aria-describedby={
              description ? `today-description-${goal.id}` : undefined
            }
            aria-expanded={detailsOpen}
            aria-controls={`today-panel-${goal.id}`}
            className="focus-visible:ring-ring/50 flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-l-2xl px-4 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
          >
            {content}
          </button>
        ) : (
          <div className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2">
            {content}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1 pr-2">
          {done && onOpenDetails ? (
            <AddDetails
              goal={goal}
              detailsOpen={detailsOpen}
              onOpenDetails={onOpenDetails}
            />
          ) : null}
          <CheckTarget
            goal={goal}
            done={done}
            detailsOpen={detailsOpen}
            detailsSupported={detailsSupported}
            description={description}
            onMarkDone={onMarkDone}
            onOpenDetails={onOpenDetails}
            registerTrigger={registerTrigger}
          />
        </div>
      </div>
      {description ? (
        <span id={`today-description-${goal.id}`} className="sr-only">
          {description}
        </span>
      ) : null}
      {undoActive ? <UndoControl goalName={goal.name} onUndo={onUndo} /> : null}
      {details}
    </li>
  );
};

const ProgressDots = ({ entry }: { entry: WeeklyGoal }) => {
  if (!entry.scored) {
    return null;
  }

  return (
    <span aria-hidden="true" className="mt-1.5 flex gap-1">
      {Array.from({ length: entry.target }, (_, index) => (
        <span
          key={`${entry.goal.id}-dot-${index}`}
          className={cn(
            "size-2 rounded-full",
            index < entry.count ? "bg-warm" : "border-border border"
          )}
        />
      ))}
    </span>
  );
};

export const WeeklyGoalRow = ({
  entry,
  detailsOpen,
  undoActive,
  details,
  onMarkDone,
  onOpenDetails,
  onUndo,
  registerTrigger,
}: TodayRowProps & { entry: WeeklyGoal }) => {
  const { goal, session } = entry;
  const done = session !== null;
  const detailsDot = hasSessionDetails(session);
  const detailsSupported = Boolean(onOpenDetails);
  const status = weeklyTargetCopy(entry);
  const countCopy = entry.scored && entry.met ? weeklyCountCopy(entry) : null;
  const description = session ? describeSession(goal.name, session) : undefined;
  const summary = session ? detailsSummary(session) : null;

  const content = (
    <>
      <GoalMark goal={goal} />
      <span className="min-w-0 flex-1 text-left">
        <GoalName
          goal={goal}
          done={done}
          showDetailsDot={detailsDot && detailsSupported}
        />
        <span className="text-muted-foreground block text-sm">
          {status}
          {entry.scored && entry.met ? ". More sessions are welcome." : null}
        </span>
        {countCopy ? (
          <span className="text-muted-foreground block text-sm">
            {countCopy}
          </span>
        ) : null}
        {summary ? (
          <span className="text-muted-foreground block text-sm">{summary}</span>
        ) : null}
        <ProgressDots entry={entry} />
      </span>
    </>
  );

  return (
    <li
      className={cn(
        "bg-card overflow-hidden rounded-2xl border",
        done && "bg-muted/40"
      )}
    >
      <div className="flex min-h-14 items-center">
        {done && onOpenDetails ? (
          <button
            type="button"
            onClick={() => onOpenDetails(goal.id)}
            aria-describedby={
              description ? `today-description-${goal.id}` : undefined
            }
            aria-expanded={detailsOpen}
            aria-controls={`today-panel-${goal.id}`}
            className="focus-visible:ring-ring/50 flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-l-2xl px-4 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
          >
            {content}
          </button>
        ) : (
          <div className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2">
            {content}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1 pr-2">
          {done && onOpenDetails ? (
            <AddDetails
              goal={goal}
              detailsOpen={detailsOpen}
              onOpenDetails={onOpenDetails}
            />
          ) : null}
          {!done && entry.met ? (
            <button
              type="button"
              onClick={() => onMarkDone(goal)}
              aria-label={`Log another session for ${goal.name}`}
              className="border-border hover:bg-muted focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-full border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              Log another session
            </button>
          ) : (
            <CheckTarget
              goal={goal}
              done={done}
              detailsOpen={detailsOpen}
              detailsSupported={detailsSupported}
              description={description}
              onMarkDone={onMarkDone}
              onOpenDetails={onOpenDetails}
              registerTrigger={registerTrigger}
            />
          )}
        </div>
      </div>
      {description ? (
        <span id={`today-description-${goal.id}`} className="sr-only">
          {description}
        </span>
      ) : null}
      {undoActive ? <UndoControl goalName={goal.name} onUndo={onUndo} /> : null}
      {details}
    </li>
  );
};
