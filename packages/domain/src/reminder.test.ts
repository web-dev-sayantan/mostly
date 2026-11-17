import { describe, expect, it } from "vite-plus/test";

import { logicalDate } from "./logical-day";
import type {
  ReminderGoal,
  ReminderSession,
  ReminderSettings,
} from "./reminder";
import { isReminderDue, reminderPayload, reminderPlan } from "./reminder";
import type { ScheduleVersion } from "./schedule";

const settings = (
  overrides: Partial<ReminderSettings> = {}
): ReminderSettings => ({
  enabled: true,
  time: "21:30",
  timeZone: "UTC",
  rolloverHour: 4,
  weekStartsOn: 1,
  ...overrides,
});

const daily = (overrides: Partial<ReminderGoal> = {}): ReminderGoal => ({
  id: "reading",
  startDate: "2026-10-01",
  archivedOn: null,
  scheduleVersions: [
    { effectiveFrom: "2026-10-01", cadence: { type: "daily" } },
  ],
  ...overrides,
});

const weekly = (
  target: number,
  overrides: Partial<ReminderGoal> = {}
): ReminderGoal => ({
  id: "guitar",
  startDate: "2026-10-01",
  archivedOn: null,
  scheduleVersions: [
    { effectiveFrom: "2026-10-01", cadence: { type: "weekly_target", target } },
  ],
  ...overrides,
});

const session = (goalId: string, date: string): ReminderSession => ({
  goalId,
  logicalDate: date,
});

const versions = (...entries: ScheduleVersion[]): ScheduleVersion[] => entries;

const at = (iso: string): Date => new Date(iso);

describe("reminder timing", () => {
  it("waits for the local reminder time", () => {
    const plan = reminderPlan({
      now: at("2026-10-22T21:29:00Z"),
      settings: settings(),
      goals: [daily()],
      sessions: [],
      deliveredDates: [],
    });

    expect(plan).toEqual({ kind: "skip", reason: "not_due" });
  });

  it("is disabled while the reminder is off", () => {
    const plan = reminderPlan({
      now: at("2026-10-22T22:00:00Z"),
      settings: settings({ enabled: false }),
      goals: [daily()],
      sessions: [],
      deliveredDates: [],
    });

    expect(plan).toEqual({ kind: "skip", reason: "disabled" });
  });

  it("uses the previous logical day at 2 AM", () => {
    const late = settings({ time: "02:00" });

    expect(
      isReminderDue({
        now: at("2026-10-22T02:00:00Z"),
        settings: late,
        deliveredDates: [],
      })
    ).toEqual({ due: true, logicalDate: "2026-10-21" });
    expect(
      logicalDate(at("2026-10-22T02:00:00Z"), {
        timeZone: "UTC",
        rolloverHour: 4,
      })
    ).toBe("2026-10-21");

    expect(
      reminderPlan({
        now: at("2026-10-22T02:00:00Z"),
        settings: late,
        goals: [daily()],
        sessions: [session("reading", "2026-10-21")],
        deliveredDates: [],
      })
    ).toEqual({
      kind: "suppressed",
      logicalDate: "2026-10-21",
      reason: "all_done",
    });
  });

  it("does not deliver twice when the time or timezone changes later", () => {
    const deliveredDates = ["2026-10-22"];
    const changed = settings({ time: "08:00", timeZone: "Europe/London" });

    expect(
      reminderPlan({
        now: at("2026-10-22T22:00:00Z"),
        settings: changed,
        goals: [daily()],
        sessions: [],
        deliveredDates,
      })
    ).toEqual({ kind: "skip", reason: "already_delivered" });
  });
});

describe("reminder suppression", () => {
  it("suppresses when every scheduled goal is done", () => {
    const plan = reminderPlan({
      now: at("2026-10-22T22:00:00Z"),
      settings: settings(),
      goals: [daily()],
      sessions: [session("reading", "2026-10-22")],
      deliveredDates: [],
    });

    expect(plan).toEqual({
      kind: "suppressed",
      logicalDate: "2026-10-22",
      reason: "all_done",
    });
  });

  it("suppresses when there are no active goals", () => {
    const plan = reminderPlan({
      now: at("2026-10-22T22:00:00Z"),
      settings: settings(),
      goals: [daily({ archivedOn: "2026-10-21" })],
      sessions: [],
      deliveredDates: [],
    });

    expect(plan).toEqual({
      kind: "suppressed",
      logicalDate: "2026-10-22",
      reason: "no_active_goals",
    });
  });

  it("suppresses when nothing is scheduled today", () => {
    const weekdays: ReminderGoal = daily({
      scheduleVersions: versions({
        effectiveFrom: "2026-10-01",
        cadence: { type: "weekdays", weekdays: [1] },
      }),
    });

    const plan = reminderPlan({
      now: at("2026-10-22T22:00:00Z"),
      settings: settings(),
      goals: [weekdays],
      sessions: [],
      deliveredDates: [],
    });

    expect(plan).toEqual({
      kind: "suppressed",
      logicalDate: "2026-10-22",
      reason: "nothing_open",
    });
  });

  it("counts one open item per goal and per unmet weekly target", () => {
    const plan = reminderPlan({
      now: at("2026-10-22T22:00:00Z"),
      settings: settings(),
      goals: [
        daily(),
        daily({ id: "coding" }),
        weekly(3),
        weekly(2, { id: "exercise" }),
      ],
      sessions: [
        session("coding", "2026-10-22"),
        session("guitar", "2026-10-20"),
      ],
      deliveredDates: [],
    });

    expect(plan).toEqual({
      kind: "send",
      logicalDate: "2026-10-22",
      openCount: 3,
    });
  });

  it("is quiet once a weekly target is met", () => {
    const plan = reminderPlan({
      now: at("2026-10-22T22:00:00Z"),
      settings: settings(),
      goals: [weekly(2)],
      sessions: [
        session("guitar", "2026-10-20"),
        session("guitar", "2026-10-21"),
      ],
      deliveredDates: [],
    });

    expect(plan).toEqual({
      kind: "suppressed",
      logicalDate: "2026-10-22",
      reason: "all_done",
    });
  });

  it("only sends the count, never anything about the goals", () => {
    expect(reminderPayload(2)).toEqual({ count: 2 });
    expect(JSON.stringify(reminderPayload(1))).not.toMatch(
      /reading|note|mood/iu
    );
  });
});
