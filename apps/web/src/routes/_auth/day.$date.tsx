import type {
  DayDetailDto,
  DayGoalDto,
  DaySessionDto,
} from "@mostly/api/routers/days";
import type { DayExpectationStatus, WeeklyOutcome } from "@mostly/domain";
import {
  isDayEditable,
  isIsoDate,
  isWithinLastLogicalDays,
  logicalDate,
  weeklyOutcome,
} from "@mostly/domain";
import { Button } from "@mostly/ui/components/button";
import { cn } from "@mostly/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  MOOD_LABELS,
  SessionDetails,
  SessionDetailsEditor,
} from "@/components/session-details-inline";
import type { SessionDetailValues } from "@/components/session-details-inline";
import { cacheDayDetail, cachedDayDetail } from "@/lib/day-cache";
import { cadenceSummary } from "@/lib/goals";
import {
  cacheServerSessions,
  deleteLocalSession,
  markSessionDone,
  updateLocalSession,
  useLocalSessions,
  useSyncStatus,
} from "@/lib/offline";
import { formatLogicalDate } from "@/lib/time";
import { orpc } from "@/utils/orpc";

type Status = DayExpectationStatus;
type DisplaySession = Pick<
  DaySessionDto,
  "id" | "goalId" | "logicalDate" | "minutes" | "note" | "mood"
>;

const PRIORITY_RANK: Record<DayGoalDto["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const STATUS_LABELS: Record<Status, string> = {
  done: "Done",
  missed: "Missed",
  no_session: "No session",
};

const statusFor = (
  date: string,
  today: string,
  session: DisplaySession | null
): Status => {
  if (session) {
    return "done";
  }
  return date < today ? "missed" : "no_session";
};

const weeklyCopy = (entry: {
  status: WeeklyOutcome;
  sessions: number;
  target: number;
}) => {
  if (entry.status === "met") {
    return "Target met";
  }
  if (entry.status === "not_scored") {
    return "Not enough days this week";
  }
  if (entry.status === "missed") {
    return `${entry.sessions} of ${entry.target} this week · Missed`;
  }
  return `${entry.sessions} of ${entry.target} this week`;
};

interface DayExpectationView {
  goal: DayGoalDto;
  session: DisplaySession | null;
  status: Status;
  editable: boolean;
}

interface DayWeeklyView {
  goal: DayGoalDto;
  weekStart: string;
  weekEnd: string;
  target: number;
  sessions: number;
  activeDays: number;
  status: WeeklyOutcome;
  session: DisplaySession | null;
  editable: boolean;
}

interface DayExtraView {
  goal: DayGoalDto;
  session: DisplaySession;
  editable: boolean;
}

interface DayView {
  readOnly: boolean;
  expectations: DayExpectationView[];
  weekly: DayWeeklyView[];
  extras: DayExtraView[];
  weeklySessions: DayWeeklyView[];
  candidates: DayGoalDto[];
  isEmpty: boolean;
}

const buildExtras = ({
  daySessions,
  expectedIds,
  weeklyIds,
  goalsById,
  date,
  today,
}: {
  daySessions: readonly DisplaySession[];
  expectedIds: ReadonlySet<string>;
  weeklyIds: ReadonlySet<string>;
  goalsById: ReadonlyMap<string, DayGoalDto>;
  date: string;
  today: string;
}): DayView["extras"] =>
  daySessions
    .flatMap((session) => {
      if (expectedIds.has(session.goalId) || weeklyIds.has(session.goalId)) {
        return [];
      }
      const goal = goalsById.get(session.goalId);
      return goal
        ? [{ goal, session, editable: isDayEditable(goal, date, today) }]
        : [];
    })
    .toSorted(
      (left, right) =>
        PRIORITY_RANK[left.goal.priority] -
          PRIORITY_RANK[right.goal.priority] ||
        left.goal.name.localeCompare(right.goal.name)
    );

const buildDayView = (
  data: DayDetailDto,
  date: string,
  knownSessions: readonly DisplaySession[],
  today: string
): DayView => {
  const daySessions = knownSessions.filter(
    (session) => session.logicalDate === date
  );
  const sessionByGoal = new Map(
    daySessions.map((session) => [session.goalId, session])
  );

  const goalsById = new Map<string, DayGoalDto>();
  for (const entry of data.expectations) {
    goalsById.set(entry.goal.id, entry.goal);
  }
  for (const entry of data.extras) {
    goalsById.set(entry.goal.id, entry.goal);
  }
  for (const entry of data.weekly) {
    goalsById.set(entry.goal.id, entry.goal);
  }
  for (const entry of data.candidates) {
    goalsById.set(entry.id, entry);
  }

  const expectations = data.expectations.map((entry) => {
    const session = sessionByGoal.get(entry.goal.id) ?? null;
    return {
      ...entry,
      session,
      status: statusFor(date, today, session),
      editable: isDayEditable(entry.goal, date, today),
    };
  });
  const expectedIds = new Set(expectations.map((entry) => entry.goal.id));

  const weekly = data.weekly.map((entry) => {
    const session = sessionByGoal.get(entry.goal.id) ?? null;
    const sessions = knownSessions.filter(
      (known) =>
        known.goalId === entry.goal.id &&
        known.logicalDate >= entry.weekStart &&
        known.logicalDate <= entry.weekEnd
    ).length;
    return {
      ...entry,
      session,
      sessions,
      status: weeklyOutcome({
        target: entry.target,
        sessions,
        activeDays: entry.activeDays,
        weekEnd: entry.weekEnd,
        today,
      }),
      editable: isDayEditable(entry.goal, date, today),
    };
  });
  const weeklyIds = new Set(weekly.map((entry) => entry.goal.id));

  const extras = buildExtras({
    daySessions,
    expectedIds,
    weeklyIds,
    goalsById,
    date,
    today,
  });

  const weeklySessions = weekly.filter((entry) => entry.session !== null);
  const candidates = data.candidates.filter(
    (goal) => !sessionByGoal.has(goal.id) && isDayEditable(goal, date, today)
  );

  return {
    readOnly: !isWithinLastLogicalDays(date, today),
    expectations,
    weekly,
    extras,
    weeklySessions,
    candidates,
    isEmpty:
      expectations.length === 0 &&
      weeklySessions.length === 0 &&
      extras.length === 0,
  };
};

const GoalMark = ({ goal }: { goal: DayGoalDto }) => (
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

const StatusLabel = ({ status }: { status: Status }) => (
  <span
    className={cn(
      "inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-sm",
      status === "done"
        ? "border-foreground/25 text-foreground"
        : "border-border text-muted-foreground"
    )}
  >
    {status === "done" ? <Check aria-hidden="true" className="size-4" /> : null}
    {STATUS_LABELS[status]}
  </span>
);

const DayRow = ({
  goal,
  session,
  status,
  meta,
  editable,
  onMarkDone,
  onUpdate,
  onRemove,
}: {
  goal: DayGoalDto;
  session: DisplaySession | null;
  status: Status;
  meta?: string;
  editable: boolean;
  onMarkDone: () => void;
  onUpdate: (values: SessionDetailValues) => void;
  onRemove: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const row = useRef<HTMLLIElement>(null);
  const subtitle = [
    meta,
    goal.archivedOn ? "Archived" : null,
    cadenceSummary(goal.cadence),
  ]
    .filter(Boolean)
    .join(" · ");
  const detailText = session
    ? [
        session.minutes === null ? null : `${session.minutes} minutes`,
        session.mood ? `felt ${MOOD_LABELS[session.mood].toLowerCase()}` : null,
        session.note ? `note: ${session.note}` : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "";
  const accessibleName = `${goal.name}, ${STATUS_LABELS[status].toLowerCase()}${
    detailText ? `, ${detailText}` : ""
  }${editable && session ? ". Edit details." : "."}`;

  const close = () => {
    setEditing(false);
    requestAnimationFrame(() => {
      const target = trigger.current?.isConnected
        ? trigger.current
        : row.current;
      target?.focus();
    });
  };

  const complete = () => {
    onMarkDone();
    requestAnimationFrame(() => {
      const button = row.current?.querySelector<HTMLButtonElement>("button");
      (button ?? row.current)?.focus();
    });
  };

  return (
    <li
      ref={row}
      id={`day-goal-${goal.id}`}
      tabIndex={-1}
      className="bg-card focus-visible:ring-ring/50 rounded-2xl border focus-visible:ring-2 focus-visible:outline-none"
    >
      {session && editable ? (
        <button
          ref={trigger}
          type="button"
          aria-expanded={editing}
          aria-controls={editing ? `day-details-${goal.id}` : undefined}
          aria-label={accessibleName}
          onClick={() => setEditing((open) => !open)}
          className="hover:bg-muted/50 focus-visible:ring-ring/50 flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left focus-visible:ring-1 focus-visible:outline-none"
        >
          <GoalMark goal={goal} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-medium">
              {goal.name}
            </span>
            <span className="text-muted-foreground block text-sm">
              {subtitle}
            </span>
            <SessionDetails session={session} />
          </span>
          <StatusLabel status="done" />
        </button>
      ) : (
        <div className="flex min-h-14 items-center gap-3 px-4 py-3">
          <GoalMark goal={goal} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium">{goal.name}</p>
            <p className="text-muted-foreground text-sm">{subtitle}</p>
            {session ? <SessionDetails session={session} /> : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusLabel status={status} />
            {editable && status !== "done" ? (
              <Button
                type="button"
                variant="outline"
                onClick={complete}
                aria-label={`Mark ${goal.name} done`}
                className="min-h-11 rounded-full px-3 text-sm"
              >
                Mark done
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {editing && session ? (
        <div id={`day-details-${goal.id}`} className="border-t p-4">
          <SessionDetailsEditor
            session={session}
            onSave={(values) => {
              onUpdate(values);
              close();
            }}
            onRemove={() => {
              onRemove();
              close();
            }}
            onCancel={close}
          />
        </div>
      ) : null}
    </li>
  );
};

const DayFallback = ({
  date,
  isOffline,
  isPending,
  isError,
  onRetry,
}: {
  date: string;
  isOffline: boolean;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) => (
  <section className="max-w-[720px] py-4">
    <h1 className="text-[28px] leading-tight font-medium">
      {formatLogicalDate(date)}
    </h1>
    {isOffline ? (
      <p className="mt-4 text-sm">
        You are offline. This day is not saved on this device yet.
      </p>
    ) : null}
    {isPending && !isOffline ? (
      <p className="text-muted-foreground mt-4 text-sm">Loading this day…</p>
    ) : null}
    {isError && !isOffline ? (
      <div className="mt-4 grid gap-3">
        <p role="alert" className="text-destructive text-sm">
          Could not load this day.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          className="min-h-11 w-fit rounded-full px-4 text-sm"
        >
          Try again
        </Button>
      </div>
    ) : null}
  </section>
);

const rowActions = (
  date: string,
  goalId: string,
  session: DisplaySession | null
) => ({
  onMarkDone: () => {
    markSessionDone({ goalId, logicalDate: date });
    toast.success("Saved");
  },
  onUpdate: (values: SessionDetailValues) => {
    if (session) {
      updateLocalSession(session.id, values);
      toast.success("Saved");
    }
  },
  onRemove: () => {
    if (session) {
      deleteLocalSession(session.id);
      toast.success("Session removed.");
    }
  },
});

const DayPage = () => {
  const { date } = Route.useParams();
  const valid = isIsoDate(date);
  const query = useQuery({
    ...orpc.days.get.queryOptions({ input: { date } }),
    enabled: valid,
    retry: false,
  });
  const sync = useSyncStatus();
  const localSessions = useLocalSessions();
  const cached = useMemo(() => cachedDayDetail(date), [date]);
  const [hydratedDate, setHydratedDate] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const remote = query.data;
  useEffect(() => {
    if (!remote) {
      return;
    }
    cacheServerSessions(remote.weekSessions);
    cacheDayDetail(remote);
    // The local store is the source after its server cache is seeded.
    // eslint-disable-next-line react/set-state-in-effect -- hydration flag for the offline overlay
    setHydratedDate(remote.date);
  }, [remote]);

  if (!valid) {
    return (
      <section className="max-w-[720px] py-4">
        <h1 className="text-[28px] leading-tight font-medium">Day</h1>
        <p className="mt-4 text-sm">That date is not valid.</p>
        <Link to="/today" className="mt-4 inline-flex min-h-11 items-center">
          Back to Today
        </Link>
      </section>
    );
  }

  const data = remote ?? cached;
  const isOffline = sync.state === "offline";
  const stale = isOffline || query.isError;

  if (!data) {
    return (
      <DayFallback
        date={date}
        isOffline={isOffline}
        isPending={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
      />
    );
  }

  const hydrated = remote ? hydratedDate === date : true;
  const knownSessions: readonly DisplaySession[] = hydrated
    ? localSessions
    : data.weekSessions;
  // Offline, advance the rollover locally so the 7-day lock still moves.
  const today = stale
    ? logicalDate(now, {
        timeZone: data.timeZone,
        rolloverHour: data.dayRolloverHour,
      })
    : data.today;
  const view = buildDayView(data, date, knownSessions, today);
  const selected = view.candidates.some((goal) => goal.id === selectedGoal)
    ? selectedGoal
    : "";
  const offlineCopy = isOffline
    ? "Offline. Showing the last saved copy of this day."
    : "Could not refresh this day. Showing the last saved copy.";

  return (
    <section
      className="max-w-[720px] py-4"
      aria-describedby={view.readOnly ? "read-only-note" : undefined}
    >
      <Link
        to="/today"
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm"
      >
        ← Today
      </Link>
      <h1 className="text-[28px] leading-tight font-medium">
        {formatLogicalDate(date)}
      </h1>

      {view.readOnly ? (
        <output
          id="read-only-note"
          aria-live="polite"
          className="text-muted-foreground mt-3 block text-sm"
        >
          This day is read-only.
        </output>
      ) : null}

      {stale ? (
        <output
          aria-live="polite"
          className="border-border bg-muted mt-3 block rounded-xl border p-3 text-sm"
        >
          {offlineCopy}
        </output>
      ) : null}

      {view.weekly.length > 0 ? (
        <section
          aria-labelledby="this-week-heading"
          className="bg-card mt-6 rounded-2xl border"
        >
          <h2
            id="this-week-heading"
            className="border-b px-4 py-3 text-base font-medium"
          >
            This week
          </h2>
          <ul className="divide-y px-4">
            {view.weekly.map((entry) => (
              <li
                key={entry.goal.id}
                className="flex min-h-11 items-center gap-3 py-2"
              >
                <GoalMark goal={entry.goal} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {entry.goal.name}
                </span>
                <span className="text-muted-foreground flex items-center gap-1 text-sm">
                  {entry.status === "met" ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : null}
                  {weeklyCopy(entry)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="day-list-heading" className="mt-6">
        <h2 id="day-list-heading" className="sr-only">
          This day
        </h2>
        {view.isEmpty ? (
          <p className="text-muted-foreground text-sm">
            Nothing was expected this day.
          </p>
        ) : (
          <ul className="space-y-2">
            {view.expectations.map((entry) => (
              <DayRow
                key={entry.goal.id}
                goal={entry.goal}
                session={entry.session}
                status={entry.status}
                editable={entry.editable}
                {...rowActions(date, entry.goal.id, entry.session)}
              />
            ))}
            {view.weeklySessions.map((entry) => (
              <DayRow
                key={`weekly:${entry.goal.id}`}
                goal={entry.goal}
                session={entry.session}
                status="done"
                meta="Weekly goal"
                editable={entry.editable}
                {...rowActions(date, entry.goal.id, entry.session)}
              />
            ))}
            {view.extras.map((entry) => (
              <DayRow
                key={`extra:${entry.goal.id}`}
                goal={entry.goal}
                session={entry.session}
                status="done"
                meta="Extra"
                editable={entry.editable}
                {...rowActions(date, entry.goal.id, entry.session)}
              />
            ))}
          </ul>
        )}
      </section>

      {!view.readOnly && view.candidates.length > 0 ? (
        <section aria-labelledby="log-something-else-heading" className="mt-6">
          <h2 id="log-something-else-heading" className="text-base font-medium">
            Log something else
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Choose a goal that was active on this day and not scheduled.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="extra-goal" className="sr-only">
              Goal
            </label>
            <select
              id="extra-goal"
              value={selected}
              onChange={(event) => setSelectedGoal(event.target.value)}
              className="border-input bg-background min-h-11 w-full rounded-full border px-3 text-sm sm:max-w-64"
            >
              <option value="">Choose a goal</option>
              {view.candidates.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.emoji ? `${goal.emoji} ` : ""}
                  {goal.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              disabled={selected === ""}
              onClick={() => {
                const goalId = selected;
                markSessionDone({
                  goalId,
                  logicalDate: date,
                });
                setSelectedGoal("");
                toast.success("Saved");
                requestAnimationFrame(() => {
                  const target = document.querySelector<HTMLElement>(
                    `#day-goal-${CSS.escape(goalId)}`
                  );
                  const button =
                    target?.querySelector<HTMLButtonElement>("button");
                  (button ?? target)?.focus();
                });
              }}
              className="min-h-11 rounded-full px-4 text-sm"
            >
              Log session
            </Button>
          </div>
        </section>
      ) : null}
    </section>
  );
};

export const Route = createFileRoute("/_auth/day/$date")({
  component: DayPage,
});
