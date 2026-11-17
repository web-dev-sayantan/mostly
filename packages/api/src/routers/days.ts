import type { Database } from "@mostly/db";
import { goal, goalScheduleVersion } from "@mostly/db/schema/goals";
import { session } from "@mostly/db/schema/sessions";
import type {
  Cadence,
  DayExpectationStatus,
  DaySession,
  Mood,
  ScheduleVersion,
  WeeklyOutcome,
} from "@mostly/domain";
import {
  comparePriority,
  isDayEditable,
  isIsoDate,
  resolveDay,
  resolveSchedule,
  settingsForDate,
  skippedDatesOf,
  weekSegmentFor,
} from "@mostly/domain";
import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { z } from "zod";

import { cadenceFromScheduleRow } from "../cadence";
import { protectedProcedure } from "../procedures";
import { currentLogicalDay, loadCache, loadHistory } from "./settings";

type GoalRow = typeof goal.$inferSelect;
type ScheduleRow = typeof goalScheduleVersion.$inferSelect;
type SessionRow = typeof session.$inferSelect;
type Priority = GoalRow["priority"];

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine(isIsoDate, "Enter a valid date");

export interface DayGoalDto {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  priority: Priority;
  startDate: string;
  archivedOn: string | null;
  cadence: Cadence | null;
}

export interface DaySessionDto {
  id: string;
  goalId: string;
  logicalDate: string;
  minutes: number | null;
  note: string | null;
  mood: Mood | null;
  updatedAt: number;
  deletedAt: null;
}

export interface DayExpectationDto {
  goal: DayGoalDto;
  status: DayExpectationStatus;
  session: DaySessionDto | null;
  editable: boolean;
}

export interface DayExtraDto {
  goal: DayGoalDto;
  session: DaySessionDto;
  editable: boolean;
}

export interface DayWeeklyDto {
  goal: DayGoalDto;
  weekStart: string;
  weekEnd: string;
  target: number;
  sessions: number;
  activeDays: number;
  status: WeeklyOutcome;
  session: DaySessionDto | null;
  editable: boolean;
}

export interface DayDetailDto {
  date: string;
  today: string;
  readOnly: boolean;
  skipped: boolean;
  weekStartsOn: number;
  timeZone: string;
  dayRolloverHour: number;
  expectations: DayExpectationDto[];
  extras: DayExtraDto[];
  weekly: DayWeeklyDto[];
  candidates: DayGoalDto[];
  /** Every live session in the week, for the offline cache. */
  weekSessions: DaySessionDto[];
}

const toCadence = cadenceFromScheduleRow;

const toScheduleVersion = (row: ScheduleRow): ScheduleVersion => ({
  effectiveFrom: row.effectiveFrom,
  cadence: toCadence(row),
});

const toDayGoal = (
  row: GoalRow,
  versions: readonly ScheduleVersion[],
  date: string
): DayGoalDto => ({
  id: row.id,
  name: row.name,
  emoji: row.emoji,
  color: row.color,
  priority: row.priority,
  startDate: row.startDate,
  archivedOn: row.archivedOn,
  cadence:
    resolveSchedule(versions, date) ?? resolveSchedule(versions, row.startDate),
});

const toSessionDto = (row: SessionRow): DaySessionDto => ({
  id: row.id,
  goalId: row.goalId,
  logicalDate: row.logicalDate,
  minutes: row.minutes,
  note: row.note,
  mood: row.mood,
  updatedAt: row.updatedAt.getTime(),
  deletedAt: null,
});

const byPriority = <Entry extends { goal: DayGoalDto }>(a: Entry, b: Entry) =>
  comparePriority(a.goal.priority, b.goal.priority) ||
  a.goal.name.localeCompare(b.goal.name);

const loadVersions = async (db: Database, goalIds: string[]) => {
  const rows =
    goalIds.length === 0
      ? []
      : await db
          .select()
          .from(goalScheduleVersion)
          .where(inArray(goalScheduleVersion.goalId, goalIds))
          .orderBy(asc(goalScheduleVersion.effectiveFrom));

  const byGoal = new Map<string, ScheduleRow[]>();
  for (const row of rows) {
    const list = byGoal.get(row.goalId) ?? [];
    list.push(row);
    byGoal.set(row.goalId, list);
  }
  return byGoal;
};

export const daysRouter = {
  get: protectedProcedure
    .input(z.object({ date: dateSchema }))
    .handler(async ({ context, input }): Promise<DayDetailDto> => {
      const userId = context.session.user.id;
      const cached = await loadCache(context.db, userId);
      const history = await loadHistory(context.db, userId);
      const today = currentLogicalDay(history, cached, context.now());
      const settings = settingsForDate(history, input.date) ??
        cached ?? {
          timeZone: "UTC",
          weekStartsOn: 1,
          dayRolloverHour: 4,
        };
      const weekStartHistory =
        history.length > 0
          ? history
          : [
              {
                effectiveFrom: "0000-01-01",
                weekStartsOn: settings.weekStartsOn,
              },
            ];
      const week = weekSegmentFor(weekStartHistory, input.date);
      const { start: weekStart, end: weekEnd } = week;

      const [goalRows, sessionRows] = await Promise.all([
        context.db
          .select()
          .from(goal)
          .where(and(eq(goal.userId, userId), isNull(goal.deletedAt))),
        context.db
          .select()
          .from(session)
          .where(
            and(
              eq(session.userId, userId),
              isNull(session.deletedAt),
              gte(session.logicalDate, weekStart),
              lte(session.logicalDate, weekEnd)
            )
          )
          .orderBy(asc(session.logicalDate), asc(session.goalId)),
      ]);

      const versionsByGoal = await loadVersions(
        context.db,
        goalRows.map((row) => row.id)
      );

      const goalsById = new Map<string, DayGoalDto>();
      const resolvableGoals = goalRows.map((row) => {
        const versions = (versionsByGoal.get(row.id) ?? []).map(
          toScheduleVersion
        );
        const dto = toDayGoal(row, versions, input.date);
        goalsById.set(dto.id, dto);
        return { ...dto, scheduleVersions: versions };
      });

      const sessionsById = new Map<string, DaySessionDto>();
      const domainSessions: DaySession[] = sessionRows.map((row) => {
        const dto = toSessionDto(row);
        sessionsById.set(dto.id, dto);
        return dto;
      });

      const resolution = resolveDay({
        date: input.date,
        today,
        weekStartsOn: settings.weekStartsOn,
        goals: resolvableGoals,
        sessions: domainSessions,
        weekStartHistory,
        skippedDates: skippedDatesOf(history),
      });

      const goalDto = (id: string): DayGoalDto => {
        const dto = goalsById.get(id);
        if (!dto) {
          throw new Error("Missing goal for day detail");
        }
        return dto;
      };

      const sessionDto = (id: string): DaySessionDto => {
        const dto = sessionsById.get(id);
        if (!dto) {
          throw new Error("Missing session for day detail");
        }
        return dto;
      };

      const expectations = resolution.expectations
        .map((entry) => ({
          goal: goalDto(entry.goal.id),
          status: entry.status,
          session: entry.session ? sessionDto(entry.session.id) : null,
          editable: isDayEditable(goalDto(entry.goal.id), input.date, today),
        }))
        .toSorted(byPriority);

      const extras = resolution.extras
        .map((entry) => ({
          goal: goalDto(entry.goal.id),
          session: sessionDto(entry.session.id),
          editable: isDayEditable(goalDto(entry.goal.id), input.date, today),
        }))
        .toSorted(byPriority);

      const weekly = resolution.weekly
        .map((entry) => ({
          goal: goalDto(entry.goal.id),
          weekStart: entry.weekStart,
          weekEnd: entry.weekEnd,
          target: entry.target,
          sessions: entry.sessions,
          activeDays: entry.activeDays,
          status: entry.status,
          session: entry.session ? sessionDto(entry.session.id) : null,
          editable: isDayEditable(goalDto(entry.goal.id), input.date, today),
        }))
        .toSorted(byPriority);

      const candidates = resolution.candidates
        .map((entry) => goalDto(entry.id))
        .toSorted(
          (a, b) =>
            comparePriority(a.priority, b.priority) ||
            a.name.localeCompare(b.name)
        );

      return {
        date: input.date,
        today,
        readOnly: resolution.readOnly,
        skipped: resolution.skipped,
        weekStartsOn: settings.weekStartsOn,
        timeZone: settings.timeZone,
        dayRolloverHour: settings.dayRolloverHour,
        expectations,
        extras,
        weekly,
        candidates,
        weekSessions: sessionRows.map(toSessionDto),
      };
    }),
};
