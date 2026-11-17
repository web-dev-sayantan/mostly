import type { GoalConsistency, WeeklyOutcome } from "@mostly/domain";

export const NOT_SCORED_COPY = "Not enough days this week";

export const formatMinutes = (total: number): string => {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${minutes} min`;
};

export const consistencyValue = (consistency: GoalConsistency): string => {
  if (consistency.percent !== null) {
    return `${consistency.percent}%`;
  }
  if (consistency.expected === 0) {
    return "Just started";
  }
  return `${consistency.done} of ${consistency.expected}`;
};

export const weekOutcomeCopy = (
  status: WeeklyOutcome,
  sessions: number,
  target: number
): string => {
  if (status === "met") {
    return "Target met";
  }
  if (status === "not_scored") {
    return NOT_SCORED_COPY;
  }
  if (status === "missed") {
    return `${sessions} of ${target} this week · Missed`;
  }
  return `${sessions} of ${target} this week`;
};
