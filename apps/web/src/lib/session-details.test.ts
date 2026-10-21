import type { GoalDto } from "@mostly/api/routers/goals";
import { describe, expect, it } from "vite-plus/test";

import type { LocalSession } from "./offline/store";
import {
  describeSession,
  detailsSummary,
  isSessionReadOnly,
  NOTE_ERROR,
  NOTE_MAX,
  validateMinutes,
  validateNote,
} from "./session-details";

const session = (overrides: Partial<LocalSession> = {}): LocalSession => ({
  id: "session-1",
  goalId: "goal-1",
  logicalDate: "2026-10-20",
  minutes: null,
  note: null,
  mood: null,
  updatedAt: 1,
  pending: true,
  ...overrides,
});

const goal = (overrides: Partial<GoalDto> = {}): GoalDto => ({
  id: "goal-1",
  name: "Reading",
  emoji: "📖",
  color: null,
  priority: "medium",
  startDate: "2026-10-01",
  archivedOn: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  sessionCount: 0,
  scheduleVersions: [
    {
      id: "version-1",
      effectiveFrom: "2026-10-01",
      cadence: { type: "daily" },
    },
  ],
  ...overrides,
});

describe("validateMinutes", () => {
  it("accepts empty, zero, and the maximum", () => {
    expect(validateMinutes("")).toEqual({ value: null, error: null });
    expect(validateMinutes("0")).toEqual({ value: 0, error: null });
    expect(validateMinutes(" 30 ")).toEqual({ value: 30, error: null });
    expect(validateMinutes("1440")).toEqual({ value: 1440, error: null });
  });

  it("rejects non-integers and values over a day", () => {
    const error = "Minutes must be a whole number from 0 to 1440.";

    expect(validateMinutes("1441")).toEqual({ value: null, error });
    expect(validateMinutes("-1")).toEqual({ value: null, error });
    expect(validateMinutes("1.5")).toEqual({ value: null, error });
    expect(validateMinutes("half an hour")).toEqual({ value: null, error });
  });
});

describe("validateNote", () => {
  it("turns an empty note into null", () => {
    expect(validateNote("")).toEqual({ value: null, error: null });
  });

  it("keeps plain text up to the limit", () => {
    const note = "a".repeat(NOTE_MAX);

    expect(validateNote(note)).toEqual({ value: note, error: null });
  });

  it("rejects a note over the limit", () => {
    expect(validateNote("a".repeat(NOTE_MAX + 1))).toEqual({
      value: null,
      error: NOTE_ERROR,
    });
  });
});

describe("describeSession", () => {
  it("includes the status and optional details", () => {
    expect(
      describeSession("Reading", session({ minutes: 32, mood: "great" }))
    ).toBe("Reading, done, 32 minutes, felt great.");
  });

  it("uses the singular minute and a plain note", () => {
    expect(describeSession("Reading", session({ minutes: 1 }))).toBe(
      "Reading, done, 1 minute."
    );
    expect(describeSession("Reading", session({ note: "A page" }))).toBe(
      "Reading, done, note added."
    );
  });

  it("says only done for a bare session", () => {
    expect(describeSession("Reading", session())).toBe("Reading, done.");
  });
});

describe("detailsSummary", () => {
  it("builds the row's short details line", () => {
    expect(
      detailsSummary(session({ minutes: 32, mood: "great", note: "A page" }))
    ).toBe("32 min · felt great · Note");
  });

  it("is empty without details", () => {
    expect(detailsSummary(session())).toBeNull();
  });
});

describe("isSessionReadOnly", () => {
  it("allows today and the last seven logical days", () => {
    expect(isSessionReadOnly(goal(), "2026-10-20", "2026-10-20")).toBe(false);
    expect(isSessionReadOnly(goal(), "2026-10-14", "2026-10-20")).toBe(false);
  });

  it("blocks older days and future dates", () => {
    expect(isSessionReadOnly(goal(), "2026-10-13", "2026-10-20")).toBe(true);
    expect(isSessionReadOnly(goal(), "2026-10-21", "2026-10-20")).toBe(true);
  });

  it("blocks archived history from the day after archiving", () => {
    expect(
      isSessionReadOnly(
        goal({ archivedOn: "2026-10-19" }),
        "2026-10-18",
        "2026-10-20"
      )
    ).toBe(true);
    expect(
      isSessionReadOnly(
        goal({ archivedOn: "2026-10-20" }),
        "2026-10-18",
        "2026-10-20"
      )
    ).toBe(false);
  });
});
