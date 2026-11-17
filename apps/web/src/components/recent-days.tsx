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
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

import type { LocalSession } from "@/lib/offline";
import {
  cacheServerSessions,
  deleteLocalSession,
  markSessionDone,
  updateLocalSession,
  useLocalSessions,
} from "@/lib/offline";
import {
  MINUTES_MAX,
  MOOD_LABELS,
  NOTE_MAX,
  validateMinutes,
  validateNote,
} from "@/lib/session-details";
import { formatLogicalDate } from "@/lib/time";

const SAVE_DELAY_MS = 500;
const SAVED_VISIBLE_MS = 1500;

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

const announceSaved = (
  setSaved: (value: boolean) => void,
  savedTimer: { current: ReturnType<typeof setTimeout> | null },
  alive: { current: boolean }
): void => {
  setSaved(true);
  if (savedTimer.current) {
    clearTimeout(savedTimer.current);
  }
  savedTimer.current = setTimeout(() => {
    if (alive.current) {
      setSaved(false);
    }
  }, SAVED_VISIBLE_MS);
};

const initialDraft = (session: LocalSession | null, row: GoalRecentDayDto) => ({
  minutes: session?.minutes?.toString() ?? row.minutes?.toString() ?? "",
  note: session?.note ?? row.note ?? "",
  mood: session?.mood ?? row.mood ?? null,
});

const useDayDetailsDraft = ({
  session,
  row,
  onClose,
}: {
  session: LocalSession | null;
  row: GoalRecentDayDto;
  onClose: () => void;
}) => {
  const [draft, setDraft] = useState(() => initialDraft(session, row));
  const [saved, setSaved] = useState(false);
  const latest = useRef({ ...draft });
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const flush = useCallback(
    (announce: boolean) => {
      if (!dirty.current || !session) {
        return;
      }
      const check = validateMinutes(latest.current.minutes);
      const noteValue = validateNote(latest.current.note);
      if (check.error || noteValue.error) {
        return;
      }
      updateLocalSession(session.id, {
        minutes: check.value,
        note: noteValue.value,
        mood: latest.current.mood,
      });
      dirty.current = false;
      if (!announce || !alive.current) {
        return;
      }
      announceSaved(setSaved, savedTimer, alive);
    },
    [session, setSaved]
  );

  const clearSavedTimer = useCallback(() => {
    if (savedTimer.current) {
      clearTimeout(savedTimer.current);
    }
  }, []);

  const flushPending = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    flush(false);
  }, [flush]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearSavedTimer();
    };
  }, [clearSavedTimer]);

  useEffect(() => () => flushPending(), [flushPending]);

  useEffect(() => {
    const onHide = () => flushPending();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flushPending]);

  const scheduleSave = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      flush(true);
    }, SAVE_DELAY_MS);
  };

  const changeMinutes = (value: string) => {
    latest.current = { ...latest.current, minutes: value };
    dirty.current = true;
    setSaved(false);
    setDraft((current) => ({ ...current, minutes: value }));
    scheduleSave();
  };

  const changeNote = (value: string) => {
    latest.current = { ...latest.current, note: value };
    dirty.current = true;
    setSaved(false);
    setDraft((current) => ({ ...current, note: value }));
    scheduleSave();
  };

  const changeMood = (value: Mood) => {
    const next = draft.mood === value ? null : value;
    latest.current = { ...latest.current, mood: next };
    dirty.current = true;
    setSaved(false);
    setDraft((current) => ({ ...current, mood: next }));
    scheduleSave();
  };

  const close = () => {
    flushPending();
    onClose();
  };

  return {
    minutes: draft.minutes,
    note: draft.note,
    mood: draft.mood,
    saved,
    minutesCheck: validateMinutes(draft.minutes),
    noteCheck: validateNote(draft.note),
    changeMinutes,
    changeNote,
    changeMood,
    close,
  };
};

const DayDetailsForm = ({
  headingId,
  minutes,
  note,
  mood,
  saved,
  minutesCheck,
  noteCheck,
  changeMinutes,
  changeNote,
  changeMood,
  onClose,
  onDelete,
}: {
  headingId: string;
  minutes: string;
  note: string;
  mood: Mood | null;
  saved: boolean;
  minutesCheck: ReturnType<typeof validateMinutes>;
  noteCheck: ReturnType<typeof validateNote>;
  changeMinutes: (value: string) => void;
  changeNote: (value: string) => void;
  changeMood: (value: Mood) => void;
  onClose: () => void;
  onDelete: () => void;
}) => (
  <div className="mt-4 grid gap-4">
    <div className="grid gap-2 sm:max-w-[180px]">
      <Label htmlFor={`${headingId}-minutes`}>Minutes</Label>
      <Input
        id={`${headingId}-minutes`}
        type="number"
        inputMode="numeric"
        min={0}
        max={MINUTES_MAX}
        value={minutes}
        onChange={(event) => changeMinutes(event.target.value)}
        aria-invalid={Boolean(minutesCheck.error)}
        aria-describedby={minutesCheck.error ? `${headingId}-error` : undefined}
        className="h-11 text-base"
      />
      {minutesCheck.error ? (
        <p
          id={`${headingId}-error`}
          role="alert"
          className="text-destructive text-sm"
        >
          {minutesCheck.error}
        </p>
      ) : null}
    </div>

    <div className="grid gap-2">
      <Label htmlFor={`${headingId}-note`}>Note (optional)</Label>
      <Textarea
        id={`${headingId}-note`}
        value={note}
        maxLength={NOTE_MAX}
        onChange={(event) => changeNote(event.target.value)}
        aria-invalid={Boolean(noteCheck.error)}
        aria-describedby={
          noteCheck.error ? `${headingId}-note-error` : undefined
        }
        className="min-h-24 text-base"
      />
      {noteCheck.error ? (
        <p
          id={`${headingId}-note-error`}
          role="alert"
          className="text-destructive text-sm"
        >
          {noteCheck.error}
        </p>
      ) : null}
    </div>

    <fieldset>
      <legend className="text-sm font-medium">How did it feel?</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {MOODS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mood === option}
            onClick={() => changeMood(option)}
            className={cn(
              "border-border focus-visible:ring-ring min-h-11 rounded-full border px-4 text-sm focus-visible:ring-2 focus-visible:outline-none",
              mood === option &&
                "bg-primary text-primary-foreground border-primary"
            )}
          >
            {MOOD_LABELS[option]}
          </button>
        ))}
      </div>
    </fieldset>

    <div className="flex flex-wrap items-center gap-2">
      <output
        aria-live="polite"
        className="text-muted-foreground inline-block min-w-12 text-sm"
      >
        {saved ? "Saved" : ""}
      </output>
      <Button
        type="button"
        variant="ghost"
        onClick={onClose}
        className="min-h-11 rounded-full px-4 text-sm"
      >
        Close
      </Button>
      <Button
        type="button"
        variant="destructive"
        onClick={onDelete}
        className="min-h-11 rounded-full px-4 text-sm"
      >
        Delete session
      </Button>
    </div>
  </div>
);

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
  const headingId = `day-${row.date}`;
  const {
    minutes,
    note,
    mood,
    saved,
    minutesCheck,
    noteCheck,
    changeMinutes,
    changeNote,
    changeMood,
    close,
  } = useDayDetailsDraft({ session: session ?? null, row, onClose });

  useEffect(() => {
    initialFocus.current?.focus();
  }, [initialFocus]);

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
      <DayDetailsForm
        headingId={headingId}
        minutes={minutes}
        note={note}
        mood={mood}
        saved={saved}
        minutesCheck={minutesCheck}
        noteCheck={noteCheck}
        changeMinutes={changeMinutes}
        changeNote={changeNote}
        changeMood={changeMood}
        onClose={close}
        onDelete={() => {
          deleteLocalSession(session.id);
          onDeleted(row.date);
          onClose();
        }}
      />
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
          className="focus-visible:ring-ring rounded-lg text-base font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          {formatLogicalDate(row.date)}
        </h3>
        <Button
          type="button"
          variant="ghost"
          onClick={close}
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
        className="focus-visible:ring-ring rounded-lg text-lg font-medium focus-visible:ring-2 focus-visible:outline-none"
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
                  className="focus-visible:ring-ring flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg py-2 focus-visible:ring-1 focus-visible:outline-none"
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
