import { addLogicalDays, weekEndOf, weekStartOf } from "./logical-day";
import { weekStartsOnFor } from "./settings";

export interface WeekSettingsVersion {
  effectiveFrom: string;
  weekStartsOn: number;
}

export interface WeekSegment {
  start: string;
  end: string;
  /** A week-start change covers the old week and any orphan days: never scored. */
  transition: boolean;
}

interface TransitionBlock {
  start: string;
  end: string;
}

/**
 * A change effective at E leaves the old week containing E-1 plus any days up
 * to E-1 as a transition block: `weekStartOf(E - 2, old)` through `E - 1`.
 */
const transitionBlocks = (
  versions: readonly WeekSettingsVersion[]
): TransitionBlock[] => {
  const sorted = versions.toSorted((left, right) =>
    left.effectiveFrom.localeCompare(right.effectiveFrom)
  );
  const blocks: TransitionBlock[] = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const next = sorted[index];
    if (!(previous && next) || previous.weekStartsOn === next.weekStartsOn) {
      continue;
    }
    blocks.push({
      start: weekStartOf(
        addLogicalDays(next.effectiveFrom, -2),
        previous.weekStartsOn
      ),
      end: addLogicalDays(next.effectiveFrom, -1),
    });
  }

  // Back-to-back changes can overlap; merge so no week is counted twice.
  const merged: TransitionBlock[] = [];
  for (const block of blocks) {
    const last = merged.at(-1);
    if (last && block.start <= addLogicalDays(last.end, 1)) {
      last.end = block.end > last.end ? block.end : last.end;
    } else {
      merged.push({ ...block });
    }
  }

  return merged;
};

/**
 * Split a range into scored weeks and not-scored week-start transition blocks.
 * Weeks before a change keep the old start; the change week owns the orphan
 * days; weeks after the change use the new start.
 */
export const weekSegments = (
  versions: readonly WeekSettingsVersion[],
  from: string,
  to: string
): WeekSegment[] => {
  if (from > to) {
    return [];
  }

  const transitions = transitionBlocks(versions);
  const segments: WeekSegment[] = [];
  let cursor = weekStartOf(from, weekStartsOnFor(versions, from));
  for (const block of transitions) {
    if (from >= block.start && from <= block.end) {
      cursor = block.start;
      break;
    }
  }

  while (cursor <= to) {
    let transition: TransitionBlock | undefined;
    for (const block of transitions) {
      if (cursor >= block.start && cursor <= block.end) {
        transition = block;
        break;
      }
    }
    if (transition) {
      segments.push({ start: cursor, end: transition.end, transition: true });
      cursor = addLogicalDays(transition.end, 1);
      continue;
    }

    const naturalEnd = weekEndOf(cursor, weekStartsOnFor(versions, cursor));
    let nextTransition: TransitionBlock | undefined;
    for (const block of transitions) {
      if (block.start > cursor && block.start <= naturalEnd) {
        nextTransition = block;
        break;
      }
    }
    const end = nextTransition
      ? addLogicalDays(nextTransition.start, -1)
      : naturalEnd;
    segments.push({ start: cursor, end, transition: false });
    cursor = addLogicalDays(end, 1);
  }

  return segments;
};

/** The scored week or transition block containing `date`. */
export const weekSegmentFor = (
  versions: readonly WeekSettingsVersion[],
  date: string
): WeekSegment => {
  const [segment] = weekSegments(versions, date, date);
  if (!segment) {
    throw new Error(`No week segment for ${date}`);
  }
  return segment;
};
