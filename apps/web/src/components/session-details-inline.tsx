import type { Mood } from "@mostly/domain";
import { MOODS } from "@mostly/domain";
import { Button } from "@mostly/ui/components/button";
import { Input } from "@mostly/ui/components/input";
import { Label } from "@mostly/ui/components/label";
import { Textarea } from "@mostly/ui/components/textarea";
import { cn } from "@mostly/ui/lib/utils";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  MINUTES_MAX,
  MOOD_LABELS,
  NOTE_MAX,
  validateMinutes,
  validateNote,
} from "@/lib/session-details";

export type { Mood } from "@mostly/domain";
export { MOOD_LABELS } from "@/lib/session-details";

export interface SessionDetailValues {
  minutes: number | null;
  note: string | null;
  mood: Mood | null;
}

export const sessionSummary = (session: SessionDetailValues): string => {
  const parts: string[] = [];
  if (session.minutes !== null) {
    parts.push(`${session.minutes} min`);
  }
  if (session.mood) {
    parts.push(MOOD_LABELS[session.mood]);
  }
  return parts.join(" · ");
};

/** The compact minutes, mood, and note line used in day rows. */
export const SessionDetails = ({
  session,
}: {
  session: SessionDetailValues;
}) => {
  const summary = sessionSummary(session);

  if (!summary && !session.note) {
    return null;
  }

  return (
    <span className="text-muted-foreground mt-0.5 block text-sm">
      {summary ? <span>{summary}</span> : null}
      {summary && session.note ? <span aria-hidden="true"> · </span> : null}
      {session.note ? (
        <span className="break-words">{session.note}</span>
      ) : null}
    </span>
  );
};

const SAVE_DELAY_MS = 500;
const SAVED_VISIBLE_MS = 1500;

/** Debounced inline editor: every valid change saves, and leaving flushes. */
export const SessionDetailsEditor = ({
  session,
  onSave,
  onRemove,
  onCancel,
}: {
  session: SessionDetailValues;
  onSave: (values: SessionDetailValues) => void;
  onRemove: () => void;
  onCancel: () => void;
}) => {
  const minutesId = useId();
  const noteId = useId();
  const [minutes, setMinutes] = useState(
    session.minutes === null ? "" : String(session.minutes)
  );
  const [note, setNote] = useState(session.note ?? "");
  const [mood, setMood] = useState<Mood | null>(session.mood);
  const [saved, setSaved] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const latest = useRef({
    minutesText: session.minutes === null ? "" : String(session.minutes),
    note: session.note ?? "",
    mood: session.mood,
  });
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const flush = useCallback(
    (announce: boolean) => {
      if (!dirty.current) {
        return;
      }

      const minutesCheck = validateMinutes(latest.current.minutesText);
      const noteCheck = validateNote(latest.current.note);
      if (minutesCheck.error || noteCheck.error) {
        return;
      }

      onSave({
        minutes: minutesCheck.value,
        note: noteCheck.value,
        mood: latest.current.mood,
      });
      dirty.current = false;
      if (!announce || !alive.current) {
        return;
      }

      setSaved(true);
      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
      }
      savedTimer.current = setTimeout(() => {
        if (alive.current) {
          setSaved(false);
        }
      }, SAVED_VISIBLE_MS);
    },
    [onSave]
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
      }
    };
  }, []);

  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      flush(false);
    },
    [flush]
  );

  useEffect(() => {
    const onHide = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      flush(false);
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

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
    latest.current = { ...latest.current, minutesText: value };
    dirty.current = true;
    setSaved(false);
    setMinutes(value);
    scheduleSave();
  };

  const changeNote = (value: string) => {
    latest.current = { ...latest.current, note: value };
    dirty.current = true;
    setSaved(false);
    setNote(value);
    scheduleSave();
  };

  const changeMood = (value: Mood) => {
    const next = mood === value ? null : value;
    latest.current = { ...latest.current, mood: next };
    dirty.current = true;
    setSaved(false);
    setMood(next);
    scheduleSave();
  };

  const minutesCheck = validateMinutes(minutes);
  const noteCheck = validateNote(note);
  const minutesErrorId = `${minutesId}-error`;
  const noteErrorId = `${noteId}-error`;

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={minutesId} className="text-sm font-medium">
          Minutes
        </Label>
        <Input
          id={minutesId}
          type="number"
          inputMode="numeric"
          min={0}
          max={MINUTES_MAX}
          value={minutes}
          onChange={(event) => changeMinutes(event.target.value)}
          aria-invalid={Boolean(minutesCheck.error)}
          aria-describedby={minutesCheck.error ? minutesErrorId : undefined}
          className="min-h-11 max-w-32 text-sm"
          autoFocus
        />
        {minutesCheck.error ? (
          <p
            id={minutesErrorId}
            role="alert"
            className="text-destructive text-sm"
          >
            {minutesCheck.error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={noteId} className="text-sm font-medium">
          Note (optional)
        </Label>
        <Textarea
          id={noteId}
          value={note}
          maxLength={NOTE_MAX}
          rows={3}
          onChange={(event) => changeNote(event.target.value)}
          aria-invalid={Boolean(noteCheck.error)}
          aria-describedby={noteCheck.error ? noteErrorId : undefined}
          className="min-h-20 text-sm"
        />
        {noteCheck.error ? (
          <p id={noteErrorId} role="alert" className="text-destructive text-sm">
            {noteCheck.error}
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend className="text-sm font-medium">How did it feel?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {MOODS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mood === value}
              onClick={() => changeMood(value)}
              className={cn(
                "border-border hover:bg-muted focus-visible:ring-ring min-h-11 rounded-full border px-4 text-sm focus-visible:ring-2 focus-visible:outline-none",
                mood === value && "bg-accent border-foreground/40"
              )}
            >
              {MOOD_LABELS[value]}
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
          onClick={() => {
            if (saveTimer.current) {
              clearTimeout(saveTimer.current);
              saveTimer.current = null;
            }
            flush(false);
            onCancel();
          }}
          className="min-h-11 rounded-full px-4 text-sm"
        >
          Close
        </Button>
        <span className="ml-auto">
          {confirmingRemove ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm">Remove this session?</span>
              <Button
                type="button"
                variant="destructive"
                onClick={onRemove}
                className="min-h-11 rounded-full px-4 text-sm"
              >
                Remove
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmingRemove(false)}
                className="min-h-11 rounded-full px-4 text-sm"
              >
                Keep
              </Button>
            </span>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmingRemove(true)}
              className="text-destructive min-h-11 rounded-full px-4 text-sm"
            >
              Remove session
            </Button>
          )}
        </span>
      </div>
    </div>
  );
};
