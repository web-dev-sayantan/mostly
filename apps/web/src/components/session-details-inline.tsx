import type { Mood } from "@mostly/domain";
import { MOODS } from "@mostly/domain";
import { Button } from "@mostly/ui/components/button";
import { Input } from "@mostly/ui/components/input";
import { Label } from "@mostly/ui/components/label";
import { Textarea } from "@mostly/ui/components/textarea";
import { cn } from "@mostly/ui/lib/utils";
import { useId, useState } from "react";

export interface SessionDetailValues {
  minutes: number | null;
  note: string | null;
  mood: Mood | null;
}

export const MOOD_LABELS: Record<Mood, string> = {
  great: "Great",
  meh: "Meh",
  rough: "Rough",
};

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

/** Minimal inline editor until the session details panel lands. */
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
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = Number(minutes);
        onSave({
          minutes:
            minutes.trim() === "" || Number.isNaN(parsed)
              ? null
              : Math.min(1440, Math.max(0, Math.trunc(parsed))),
          note: note.trim() === "" ? null : note,
          mood,
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor={minutesId} className="text-sm font-medium">
          Minutes
        </Label>
        <Input
          id={minutesId}
          type="number"
          inputMode="numeric"
          min={0}
          max={1440}
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
          className="min-h-11 max-w-32 text-sm"
          autoFocus
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={noteId} className="text-sm font-medium">
          Note (optional)
        </Label>
        <Textarea
          id={noteId}
          value={note}
          maxLength={500}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
          className="min-h-20 text-sm"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">How did it feel?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {MOODS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mood === value}
              onClick={() => setMood(mood === value ? null : value)}
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
        <Button type="submit" className="min-h-11 rounded-full px-4 text-sm">
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="min-h-11 rounded-full px-4 text-sm"
        >
          Cancel
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
    </form>
  );
};
