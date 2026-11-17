import type { GoalDto } from "@mostly/api/routers/goals";
import { describe, expect, it } from "vite-plus/test";

import {
  cadenceSummary,
  defaultStartDate,
  formatDayMonth,
  isArchived,
  timingNote,
} from "./goals";

const goal = (overrides: Partial<GoalDto> = {}): GoalDto => ({
  id: "goal-1",
  name: "Reading",
  emoji: null,
  color: null,
  priority: "medium",
  startDate: "2026-10-20",
  archivedOn: null,
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  sessionCount: 0,
  scheduleVersions: [
    {
      id: "version-1",
      effectiveFrom: "2026-10-20",
      cadence: { type: "daily" },
    },
  ],
  ...overrides,
});

describe("goal presentation", () => {
  it("defaults a new start date to the logical today, or tomorrow after 9:30 PM", () => {
    expect(defaultStartDate("2026-10-20", new Date(2026, 9, 20, 21, 29))).toBe(
      "2026-10-20"
    );
    expect(defaultStartDate("2026-10-20", new Date(2026, 9, 20, 21, 30))).toBe(
      "2026-10-21"
    );
    // A logical yesterday (before rollover) still advances from that day.
    expect(defaultStartDate("2026-10-19", new Date(2026, 9, 20, 23, 0))).toBe(
      "2026-10-20"
    );
  });

  it("summarizes each cadence", () => {
    expect(cadenceSummary({ type: "daily" })).toBe("Daily");
    expect(cadenceSummary({ type: "weekdays", weekdays: [1, 3, 5] })).toBe(
      "Mon / Wed / Fri"
    );
    expect(cadenceSummary({ type: "weekly_target", target: 4 })).toBe(
      "4 times a week"
    );
  });

  it("labels future, archive-day, and archived goals", () => {
    expect(timingNote(goal({ startDate: "2026-11-12" }), "2026-10-20")).toBe(
      "Starts 12 Nov"
    );
    expect(timingNote(goal({ archivedOn: "2026-10-20" }), "2026-10-20")).toBe(
      "Archives tomorrow"
    );
    expect(timingNote(goal({ archivedOn: "2026-10-04" }), "2026-10-20")).toBe(
      "Archived 4 Oct"
    );
    expect(isArchived(goal({ archivedOn: "2026-10-19" }), "2026-10-20")).toBe(
      true
    );
    expect(isArchived(goal({ archivedOn: "2026-10-20" }), "2026-10-20")).toBe(
      false
    );
    expect(formatDayMonth("2026-11-12")).toBe("12 Nov");
  });
});
