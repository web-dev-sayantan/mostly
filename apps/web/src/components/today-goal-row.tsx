import type { GoalDto } from "@mostly/api/routers/goals";
import { cn } from "@mostly/ui/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { cadenceSummary } from "@/lib/goals";
import {
  checkButtonLabel,
  describeSession,
  detailsSummary,
} from "@/lib/session-details";
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

const CheckStatus = ({ done }: { done: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      "flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
      done
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border"
    )}
  >
    {done ? <Check className="mostly-check size-4" strokeWidth={2.5} /> : null}
  </span>
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
    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-full px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
  >
    Add details
  </button>
);

const UndoControl = ({
  goal,
  onOpenDetails,
  onUndo,
}: {
  goal: GoalDto;
  onOpenDetails?: (goalId: string) => void;
  onUndo: () => void;
}) => (
  <div className="flex items-center justify-between border-t px-2 py-0.5">
    <button
      type="button"
      onClick={onUndo}
      aria-label={`Undo ${goal.name}`}
      className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      Undo
    </button>
    {onOpenDetails ? (
      <AddDetails
        goal={goal}
        detailsOpen={false}
        onOpenDetails={onOpenDetails}
      />
    ) : null}
  </div>
);

export interface TodayRowProps {
  detailsOpen: boolean;
  undoActive: boolean;
  details?: ReactNode;
  onMarkDone: (goal: GoalDto) => void;
  onOpenDetails?: (goalId: string) => void;
  onUndo: () => void;
  onRegisterAction?: (goalId: string, node: HTMLButtonElement | null) => void;
}

const GoalRow = ({
  goal,
  session,
  logAnother = false,
  children,
  detailsOpen,
  undoActive,
  details,
  onMarkDone,
  onOpenDetails,
  onUndo,
  onRegisterAction,
}: TodayRowProps & {
  goal: GoalDto;
  session: TodayGoal["session"];
  logAnother?: boolean;
  children: ReactNode;
}) => {
  const done = session !== null;
  const canEditDetails = done && Boolean(onOpenDetails);
  const description = session ? describeSession(goal.name, session) : undefined;
  const label =
    logAnother && !done
      ? `Log another session for ${goal.name}`
      : checkButtonLabel(goal.name, done, canEditDetails);

  return (
    <li
      className={cn(
        "bg-card overflow-hidden rounded-2xl border",
        done && "bg-muted/40"
      )}
    >
      <button
        ref={(node) => onRegisterAction?.(goal.id, node)}
        type="button"
        disabled={done && !onOpenDetails}
        onClick={() => {
          if (done) {
            onOpenDetails?.(goal.id);
          } else {
            onMarkDone(goal);
          }
        }}
        aria-label={label}
        aria-describedby={
          description ? `today-description-${goal.id}` : undefined
        }
        aria-expanded={canEditDetails ? detailsOpen : undefined}
        aria-controls={canEditDetails ? `today-panel-${goal.id}` : undefined}
        className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-default"
      >
        {children}
        {logAnother && !done ? (
          <span className="text-muted-foreground max-w-24 text-right text-sm">
            Log another session
          </span>
        ) : null}
        <CheckStatus done={done} />
        <span aria-hidden="true" className="flex size-4 shrink-0 items-center">
          {canEditDetails ? (
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "text-muted-foreground size-4 shrink-0 motion-safe:transition-transform",
                detailsOpen && "rotate-180"
              )}
            />
          ) : null}
        </span>
      </button>
      {description ? (
        <span id={`today-description-${goal.id}`} className="sr-only">
          {description}
        </span>
      ) : null}
      {undoActive ? (
        <UndoControl
          goal={goal}
          onUndo={onUndo}
          onOpenDetails={onOpenDetails}
        />
      ) : null}
      {details}
    </li>
  );
};

export const TodayGoalRow = ({
  entry,
  ...props
}: TodayRowProps & { entry: TodayGoal }) => {
  const { goal, cadence, session } = entry;
  const done = session !== null;
  const detailsDot = hasSessionDetails(session);
  const detailsSupported = Boolean(props.onOpenDetails);
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
    <GoalRow {...props} goal={goal} session={session}>
      {content}
    </GoalRow>
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
  ...props
}: TodayRowProps & { entry: WeeklyGoal }) => {
  const { goal, session } = entry;
  const done = session !== null;
  const detailsDot = hasSessionDetails(session);
  const detailsSupported = Boolean(props.onOpenDetails);
  const status = weeklyTargetCopy(entry);
  const countCopy = entry.scored && entry.met ? weeklyCountCopy(entry) : null;
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
    <GoalRow {...props} goal={goal} session={session} logAnother={entry.met}>
      {content}
    </GoalRow>
  );
};
