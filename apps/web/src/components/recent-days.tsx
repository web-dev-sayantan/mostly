import type { GoalDto } from "@mostly/api/routers/goals";
import type { GoalRecentDayDto } from "@mostly/api/routers/stats";
import { MOODS, addLogicalDays, isWithinLastLogicalDays } from "@mostly/domain";
import type { Mood } from "@mostly/domain";
import { Button } from "@mostly/ui/components/button";
import { Input } from "@mostly/ui/components/input";
import { Label } from "@mostly/ui/components/label";
import { Textarea } from "@mostly/ui/components/textarea";
import { cn } from "@mostly/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

import {
  cacheServerSessions,
  deleteLocalSession,
  markSessionDone,
  updateLocalSession,
  useLocalSessions,
} from "@/lib/offline";
import { formatLogicalDate } from "@/lib/time";

const MOOD_LABELS: Record<Mood, string> = {
  great: "Great",
  meh: "Meh",
  rough: "Rough",
};

const detailSummary = (row: GoalRecentDayDto): string[] => {
  const parts: string[] = [];
  if (row.minutes !== null && row.minutes > 0) {
    parts.push(`${row.minutes} min`);
  }
  if (row.mood) {
    parts.push(MOOD_LABELS[row.mood]);
  }
  if (row.note) {
    parts.push(row.note);
  }
  return parts;
};

const DayDetails = ({
  row,
  goalId,
  readOnly,
  initialFocus,
  onClose,
  onDeleted,
  onRestored,
}: {
  row: GoalRecentDayDto;
  goalId: string;
  readOnly: boolean;
  initialFocus: RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
  onDeleted: (date: string) => void;
  onRestored: (date: string) => void;
}) => {
  const sessions = useLocalSessions();
  const session = sessions.find(
    (entry) => entry.goalId === goalId && entry.logicalDate === row.date
  );
  const [minutes, setMinutes] = useState(
    session?.minutes?.toString() ?? row.minutes?.toString() ?? ""
  );
  const [note, setNote] = useState(session?.note ?? row.note ?? "");
  const [mood, setMood] = useState<Mood | null>(
    session?.mood ?? row.mood ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const headingId = `day-${row.date}`;

  useEffect(() => {
    initialFocus.current?.focus();
  }, [initialFocus]);

  const save = () => {
    const trimmed = minutes.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (
      parsed !== null &&
      (!Number.isInteger(parsed) || parsed < 0 || parsed > 1440)
    ) {
      setError("Minutes must be a whole number from 0 to 1440.");
      return;
    }
    if (!session) {
      return;
    }
    updateLocalSession(session.id, {
      minutes: parsed,
      note: note.trim() === "" ? null : note,
      mood,
    });
    onClose();
  };

  const summary = detailSummary(row);
  let body: ReactNode;
  if (readOnly) {
    body = (
      <>
        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
          <Lock aria-hidden="true" className="size-3.5" />
          This day is read-only.
        </p>
        <p className="mt-3 text-sm">
          {row.status === "done" ? "Done" : "Missed"}
          {summary.length > 0 ? ` · ${summary.join(" · ")}` : null}
        </p>
      </>
    );
  } else if (session) {
    body = (
      <div className="mt-4 grid gap-4">
        <div className="grid gap-2 sm:max-w-[180px]">
          <Label htmlFor={`${headingId}-minutes`}>Minutes</Label>
          <Input
            id={`${headingId}-minutes`}
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${headingId}-error` : undefined}
            className="h-11 text-base"
          />
          {error ? (
            <p
              id={`${headingId}-error`}
              role="alert"
              className="text-destructive text-sm"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${headingId}-note`}>Note (optional)</Label>
          <Textarea
            id={`${headingId}-note`}
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-24 text-base"
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium">How did it feel?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {MOODS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={mood === option}
                onClick={() => setMood(mood === option ? null : option)}
                className={cn(
                  "border-border focus-visible:ring-ring/50 min-h-11 rounded-full border px-4 text-sm focus-visible:ring-2 focus-visible:outline-none",
                  mood === option &&
                    "bg-primary text-primary-foreground border-primary"
                )}
              >
                {MOOD_LABELS[option]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={save}
            className="min-h-11 rounded-full px-5 text-sm"
          >
            Save details
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              deleteLocalSession(session.id);
              onDeleted(row.date);
              onClose();
            }}
            className="min-h-11 rounded-full px-4 text-sm"
          >
            Delete session
          </Button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="mt-4">
        <p className="text-muted-foreground text-sm">
          {row.status === "missed" ? "Missed" : "No session"}
        </p>
        <Button
          type="button"
          onClick={() => {
            markSessionDone({ goalId, logicalDate: row.date });
            onRestored(row.date);
          }}
          className="mt-3 min-h-11 rounded-full px-5 text-sm"
        >
          Mark done
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className="bg-muted/40 mt-3 rounded-2xl border p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          id={headingId}
          ref={initialFocus}
          tabIndex={-1}
          className="focus-visible:ring-ring/50 rounded-lg text-base font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          {formatLogicalDate(row.date)}
        </h3>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          className="min-h-11 rounded-full px-3 text-sm"
        >
          Close
        </Button>
      </div>

      {body}
    </section>
  );
};

export const RecentDays = ({
  goal,
  today,
  readOnly,
  unit,
  recentDays,
}: {
  goal: GoalDto;
  today: string;
  readOnly: boolean;
  unit: "day" | "week";
  recentDays: GoalRecentDayDto[];
}) => {
  const sessions = useLocalSessions();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [removedDates, setRemovedDates] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const sectionHeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    cacheServerSessions(
      recentDays.flatMap((row) =>
        row.sessionId && row.updatedAt !== null
          ? [
              {
                id: row.sessionId,
                goalId: goal.id,
                logicalDate: row.date,
                minutes: row.minutes,
                note: row.note,
                mood: row.mood,
                updatedAt: row.updatedAt,
                deletedAt: null,
              },
            ]
          : []
      )
    );
  }, [recentDays, goal.id]);

  const historyEnd =
    goal.archivedOn && goal.archivedOn < today ? goal.archivedOn : today;
  const windowStart = addLogicalDays(historyEnd, -6);
  const rows = new Map<string, GoalRecentDayDto>();

  for (const day of recentDays) {
    if (!removedDates.has(day.date)) {
      rows.set(day.date, day);
    }
  }
  for (const session of sessions) {
    if (
      session.goalId !== goal.id ||
      session.logicalDate < windowStart ||
      session.logicalDate > historyEnd ||
      removedDates.has(session.logicalDate)
    ) {
      continue;
    }
    const existing = rows.get(session.logicalDate);
    rows.set(session.logicalDate, {
      date: session.logicalDate,
      status: "done",
      minutes: session.minutes,
      mood: session.mood,
      note: session.note,
      sessionId: session.id,
      updatedAt: session.updatedAt,
      readOnly:
        existing?.readOnly ??
        (readOnly || !isWithinLastLogicalDays(session.logicalDate, today)),
    });
  }

  const visible = [...rows.values()]
    .filter((row) => (unit === "week" ? row.status === "done" : true))
    .toSorted((left, right) => right.date.localeCompare(left.date));
  const selected = selectedDate ? rows.get(selectedDate) : undefined;

  const close = () => {
    setSelectedDate(null);
    requestAnimationFrame(() => {
      const target = triggerRef.current?.isConnected
        ? triggerRef.current
        : sectionHeadingRef.current;
      target?.focus();
    });
  };

  return (
    <section aria-labelledby="recent-heading" className="mt-8">
      <h2
        id="recent-heading"
        ref={sectionHeadingRef}
        tabIndex={-1}
        className="focus-visible:ring-ring/50 rounded-lg text-lg font-medium focus-visible:ring-2 focus-visible:outline-none"
      >
        Recent days
      </h2>
      {readOnly ? (
        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
          <Lock aria-hidden="true" className="size-3.5" />
          This day is read-only.
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">
          No sessions in the last 7 days.
        </p>
      ) : (
        <ul className="bg-card mt-3 divide-y rounded-2xl border">
          {visible.map((row) => {
            const summary = detailSummary(row);
            return (
              <li
                key={row.date}
                className="flex min-h-14 items-center gap-2 px-4 py-2"
              >
                <Link
                  to="/day/$date"
                  params={{ date: row.date }}
                  className="focus-visible:ring-ring/50 flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg py-2 focus-visible:ring-1 focus-visible:outline-none"
                >
                  <span className="block truncate text-base font-medium">
                    {formatLogicalDate(row.date)}
                  </span>
                  <span className="text-muted-foreground block truncate text-sm">
                    {row.status === "done" ? "Done" : "Missed"}
                    {summary.length > 0 ? ` · ${summary.join(" · ")}` : null}
                    {row.readOnly ? (
                      <span className="sr-only"> This day is read-only.</span>
                    ) : null}
                  </span>
                </Link>
                {row.readOnly ? (
                  <Lock
                    aria-hidden="true"
                    className="text-muted-foreground size-4 shrink-0"
                  />
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={(event) => {
                    triggerRef.current = event.currentTarget;
                    setSelectedDate(row.date);
                  }}
                  aria-label={`${
                    row.readOnly ? "View" : "Edit"
                  } details for ${formatLogicalDate(row.date)}`}
                  className="min-h-11 shrink-0 rounded-full px-3 text-sm"
                >
                  {row.readOnly ? "View" : "Edit details"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <DayDetails
          key={`${selected.date}:${sessions.find((entry) => entry.goalId === goal.id && entry.logicalDate === selected.date)?.id ?? "empty"}`}
          row={selected}
          goalId={goal.id}
          readOnly={selected.readOnly}
          initialFocus={headingRef}
          onClose={close}
          onDeleted={(date) =>
            setRemovedDates((current) => new Set(current).add(date))
          }
          onRestored={(date) =>
            setRemovedDates((current) => {
              const next = new Set(current);
              next.delete(date);
              return next;
            })
          }
        />
      ) : null}
    </section>
  );
};
