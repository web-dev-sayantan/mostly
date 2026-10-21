import type { Mood } from "@mostly/domain";
import { MOODS } from "@mostly/domain";
import { Button } from "@mostly/ui/components/button";
import { Input } from "@mostly/ui/components/input";
import { Label } from "@mostly/ui/components/label";
import { Textarea } from "@mostly/ui/components/textarea";
import { cn } from "@mostly/ui/lib/utils";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { LocalSession } from "@/lib/offline";
import { deleteLocalSession, updateLocalSession } from "@/lib/offline";
import {
  describeSession,
  detailsSummary,
  MINUTES_MAX,
  MOOD_LABELS,
  NOTE_MAX,
  validateMinutes,
  validateNote,
} from "@/lib/session-details";

const MINUTE_CHIPS = [15, 30, 45, 60] as const;
const SAVE_DELAY_MS = 500;
const SAVED_VISIBLE_MS = 1500;

export const SessionDetails = ({
  panelId,
  goalName,
  session,
  logicalDate,
  today,
  readOnly,
  onClose,
  onRemoved,
}: {
  panelId: string;
  goalName: string;
  session: LocalSession;
  logicalDate: string;
  today: string;
  readOnly: boolean;
  onClose: () => void;
  onRemoved: (goalName: string) => void;
}) => {
  const headingId = useId();
  const minutesId = useId();
  const minutesHelpId = useId();
  const noteId = useId();
  const noteHelpId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const removeTrigger = useRef<HTMLButtonElement>(null);
  const [minutesText, setMinutesText] = useState(
    session.minutes === null ? "" : String(session.minutes)
  );
  const [note, setNote] = useState(session.note ?? "");
  const [mood, setMood] = useState<Mood | null>(session.mood);
  const [saved, setSaved] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const latest = useRef({ minutesText, note, mood });
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const flush = useCallback(
    (announce: boolean) => {
      if (readOnly || !dirty.current) {
        return;
      }

      const minutes = validateMinutes(latest.current.minutesText);
      const noteCheck = validateNote(latest.current.note);
      const patch: {
        minutes?: number | null;
        note?: string | null;
        mood: Mood | null;
      } = {
        mood: latest.current.mood,
      };
      if (!minutes.error) {
        patch.minutes = minutes.value;
      }
      if (!noteCheck.error) {
        patch.note = noteCheck.value;
      }

      updateLocalSession(session.id, patch);
      dirty.current = false;
      if (!announce || minutes.error || noteCheck.error || !alive.current) {
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
    [readOnly, session.id]
  );

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
      }
    };
  }, []);

  const minutesCheck = validateMinutes(minutesText);
  const noteCheck = validateNote(note);
  const noteError = noteCheck.error;
  const minutesErrorId = `${minutesHelpId}-error`;
  const noteErrorId = `${noteHelpId}-error`;

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
    setMinutesText(value);
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

  const remove = () => {
    deleteLocalSession(session.id);
    onRemoved(goalName);
  };

  if (readOnly) {
    return (
      <section
        id={panelId}
        ref={panelRef}
        tabIndex={-1}
        aria-labelledby={headingId}
        className="bg-muted/30 border-t p-4 outline-none"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 id={headingId} className="text-base font-medium">
            {goalName} details
          </h3>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            aria-label={`Close details for ${goalName}`}
            className="min-h-11 rounded-full px-4 text-sm"
          >
            Close
          </Button>
        </div>
        <p className="mt-3 text-sm">This day is read-only.</p>
        <p className="text-muted-foreground mt-2 text-sm">
          {describeSession(goalName, session)}
        </p>
      </section>
    );
  }

  const summary = detailsSummary({
    minutes: minutesCheck.error ? session.minutes : minutesCheck.value,
    note: noteCheck.error ? session.note : noteCheck.value,
    mood,
  });

  return (
    <section
      id={panelId}
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby={headingId}
      className="bg-muted/30 border-t p-4 outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id={headingId} className="text-base font-medium">
            {goalName} details
          </h3>
          {summary ? (
            <p className="text-muted-foreground mt-1 text-sm">{summary}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <output
            aria-live="polite"
            className="text-muted-foreground inline-block min-w-10 text-sm"
          >
            {saved ? "Saved" : ""}
          </output>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            aria-label={`Close details for ${goalName}`}
            className="min-h-11 rounded-full px-4 text-sm"
          >
            Close
          </Button>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Minutes</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {MINUTE_CHIPS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={minutesText === String(value)}
              onClick={() => changeMinutes(String(value))}
              className={cn(
                "border-border focus-visible:ring-ring/50 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none",
                minutesText === String(value) &&
                  "bg-accent border-foreground/30"
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Label htmlFor={minutesId} className="text-sm font-medium">
            Custom
          </Label>
          <Input
            id={minutesId}
            inputMode="numeric"
            value={minutesText}
            onChange={(event) => changeMinutes(event.target.value)}
            aria-invalid={Boolean(minutesCheck.error)}
            aria-describedby={
              minutesCheck.error ? minutesErrorId : minutesHelpId
            }
            className="h-11 max-w-24 text-base"
          />
          <span className="text-muted-foreground text-sm">minutes</span>
        </div>
        {minutesCheck.error ? (
          <p
            id={minutesErrorId}
            role="alert"
            className="text-destructive mt-1 text-sm"
          >
            {minutesCheck.error}
          </p>
        ) : (
          <p id={minutesHelpId} className="text-muted-foreground mt-1 text-sm">
            Up to {MINUTES_MAX} minutes.
          </p>
        )}
      </fieldset>

      <div className="mt-5">
        <Label htmlFor={noteId} className="text-sm font-medium">
          Note (optional)
        </Label>
        <Textarea
          id={noteId}
          value={note}
          onChange={(event) => changeNote(event.target.value)}
          aria-invalid={Boolean(noteError)}
          aria-describedby={noteError ? noteErrorId : noteHelpId}
          className="mt-2 min-h-11 text-base"
        />
        <div className="mt-1 flex items-start justify-between gap-3">
          {noteError ? (
            <p
              id={noteErrorId}
              role="alert"
              className="text-destructive text-sm"
            >
              {noteError}
            </p>
          ) : (
            <p id={noteHelpId} className="text-muted-foreground text-sm">
              Private. Plain text.
            </p>
          )}
          <span className="text-muted-foreground shrink-0 text-sm">
            {note.length}/{NOTE_MAX}
          </span>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">How did it feel?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {MOODS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mood === value}
              onClick={() => changeMood(value)}
              className={cn(
                "border-border focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-full border px-4 text-sm focus-visible:ring-2 focus-visible:outline-none",
                mood === value && "bg-accent border-foreground/30"
              )}
            >
              {MOOD_LABELS[value]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 border-t pt-4">
        <Button
          ref={removeTrigger}
          type="button"
          variant="outline"
          onClick={() => setConfirmingRemove(true)}
          className="min-h-11 rounded-full px-4 text-sm"
        >
          Mark as not done
        </Button>
        {confirmingRemove ? (
          <div className="bg-background/60 mt-3 rounded-xl border p-3">
            <p className="text-sm">
              {logicalDate === today
                ? `Mark ${goalName} as not done? This removes today's session.`
                : `Mark ${goalName} as not done? This removes the session.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={remove}
                className="min-h-11 rounded-full px-4 text-sm"
              >
                Mark as not done
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setConfirmingRemove(false);
                  requestAnimationFrame(() => removeTrigger.current?.focus());
                }}
                className="min-h-11 rounded-full px-4 text-sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
