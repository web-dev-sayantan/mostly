export type Priority = "high" | "medium" | "low";

export const PRIORITY_RANK: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const comparePriority = (left: Priority, right: Priority): number =>
  PRIORITY_RANK[left] - PRIORITY_RANK[right];
