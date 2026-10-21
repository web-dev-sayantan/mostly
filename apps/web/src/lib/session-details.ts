import type { GoalDto } from "@mostly/api/routers/goals";
import type { Mood } from "@mostly/domain";
import { isWithinLastLogicalDays } from "@mostly/domain";

import type { LocalSession } from "./offline/store";

export const MINUTES_MAX = 1440;
export const NOTE_MAX = 500;
export const MINUTES_ERROR = "Minutes must be a whole number from 0 to 1440.";
export const NOTE_ERROR = "Notes can be up to 500 characters.";

export const MOOD_LABELS: Record<Mood, string> = {
  great: "Great",
  meh: "Meh",
  rough: "Rough",
};

export interface MinutesCheck {
  value: number | null;
  error: string | null;
}

export const validateMinutes = (raw: string): MinutesCheck => {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { value: null, error: null };
  }
  if (!/^\d+$/u.test(trimmed)) {
    return { value: null, error: MINUTES_ERROR };
  }

  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value > MINUTES_MAX) {
    return { value: null, error: MINUTES_ERROR };
  }
  return { value, error: null };
};

export const validateNote = (
  raw: string
): { value: string | null; error: string | null } => {
  if (raw.length > NOTE_MAX) {
    return { value: null, error: NOTE_ERROR };
  }
  return { value: raw.length === 0 ? null : raw, error: null };
};

/** The row line for a session's optional details. */
export const detailsSummary = (
  session: Pick<LocalSession, "minutes" | "note" | "mood">
): string | null => {
  const parts: string[] = [];
  if (session.minutes !== null) {
    parts.push(`${session.minutes} min`);
  }
  if (session.mood !== null) {
    parts.push(`felt ${MOOD_LABELS[session.mood].toLowerCase()}`);
  }
  if (session.note !== null && session.note.length > 0) {
    parts.push("Note");
  }
  return parts.length > 0 ? parts.join(" · ") : null;
};

/** Screen-reader copy: status and details, never the note's contents. */
export const describeSession = (
  goalName: string,
  session: Pick<LocalSession, "minutes" | "note" | "mood">
): string => {
  const parts = [`${goalName}, done`];
  if (session.minutes !== null) {
    parts.push(
      `${session.minutes} ${session.minutes === 1 ? "minute" : "minutes"}`
    );
  }
  if (session.mood !== null) {
    parts.push(`felt ${MOOD_LABELS[session.mood].toLowerCase()}`);
  }
  if (session.note !== null && session.note.length > 0) {
    parts.push("note added");
  }
  return `${parts.join(", ")}.`;
};

/** The check target's accessible name, shared with its tests. */
export const checkButtonLabel = (
  goalName: string,
  done: boolean,
  detailsSupported: boolean
): string => {
  if (!done) {
    return `Mark ${goalName} done`;
  }
  return detailsSupported
    ? `${goalName} done. Edit details.`
    : `${goalName} done.`;
};

/** Last 7 logical days and active-goal history stay editable. */
export const isSessionReadOnly = (
  goal: GoalDto,
  logicalDate: string,
  today: string
): boolean => {
  if (logicalDate > today || !isWithinLastLogicalDays(logicalDate, today)) {
    return true;
  }
  return goal.archivedOn !== null && goal.archivedOn < today;
};
