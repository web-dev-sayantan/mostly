import { session } from "@mostly/db/schema/sessions";
import type {
  GoalConsistency,
  GoalDayStatus,
  GoalMinutes,
  GoalWeek,
  Mood,
  StreakEra,
  StreakUnit,
} from "@mostly/domain";
import {
  addLogicalDays,
  goalStats,
  isWithinLastLogicalDays,
} from "@mostly/domain";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { findOwnedGoal } from "../goal-access";
import { protectedProcedure } from "../procedures";
import { loadUserClock } from "../user-clock";
import { loadGoalDto } from "./goals";
import type { GoalDto } from "./goals";

export interface GoalDayCellDto {
  date: string;
  expected: boolean;
  extra: boolean;
  status: GoalDayStatus;
}

export type GoalHeatmapDto =
  | { unit: "day"; weekStartsOn: number; days: GoalDayCellDto[] }
  | { unit: "week"; weekStartsOn: number; weeks: GoalWeek[] };

export interface GoalRecentDayDto {
  date: string;
  status: "done" | "missed";
  minutes: number | null;
  mood: Mood | null;
  note: string | null;
  sessionId: string | null;
  updatedAt: number | null;
  readOnly: boolean;
}

export interface GoalDetailStatsDto {
  unit: StreakUnit;
  consistency: GoalConsistency;
  currentStreak: number | null;
  bestStreak: number;
  eras: StreakEra[];
  sessions: number;
  minutes: GoalMinutes;
}

export interface GoalDetailDto {
  goal: GoalDto;
  today: string;
  readOnly: boolean;
  futureStart: boolean;
  startsOn: string | null;
  stats: GoalDetailStatsDto | null;
  heatmap: GoalHeatmapDto | null;
  recentDays: GoalRecentDayDto[];
}

const idSchema = z.object({ id: z.string().min(1) });

const recentDaysFor = (
  days: ReturnType<typeof goalStats>["days"],
  unit: StreakUnit,
  historyEnd: string,
  today: string,
  readOnly: boolean,
  sessionByDate: ReadonlyMap<string, { id: string; updatedAt: Date }>
): GoalRecentDayDto[] => {
  const start = addLogicalDays(historyEnd, -6);

  return days
    .filter((day) => {
      if (day.date < start || day.date > historyEnd) {
        return false;
      }
      return unit === "week"
        ? day.status === "done"
        : day.status === "done" || day.status === "missed";
    })
    .map((day) => {
      const row = sessionByDate.get(day.date);
      return {
        date: day.date,
        status: day.status === "done" ? "done" : "missed",
        minutes: day.minutes,
        mood: day.mood,
        note: day.note,
        sessionId: row?.id ?? null,
        updatedAt: row?.updatedAt.getTime() ?? null,
        readOnly: readOnly || !isWithinLastLogicalDays(day.date, today),
      };
    });
};

export const statsRouter = {
  goal: protectedProcedure
    .input(idSchema)
    .handler(async ({ context, input }): Promise<GoalDetailDto> => {
      const goalRow = await findOwnedGoal(
        context.db,
        context.session.user.id,
        input.id
      );
      if (!goalRow) {
        throw new ORPCError("NOT_FOUND");
      }

      const goalDto = await loadGoalDto(context.db, goalRow);
      const clock = await loadUserClock(
        context.db,
        context.session.user.id,
        context.now()
      );
      const readOnly = Boolean(
        goalRow.archivedOn && goalRow.archivedOn < clock.today
      );

      if (goalRow.startDate > clock.today) {
        return {
          goal: goalDto,
          today: clock.today,
          readOnly,
          futureStart: true,
          startsOn: goalRow.startDate,
          stats: null,
          heatmap: null,
          recentDays: [],
        };
      }

      const sessions = await context.db
        .select()
        .from(session)
        .where(
          and(
            eq(session.goalId, goalRow.id),
            eq(session.userId, context.session.user.id),
            isNull(session.deletedAt)
          )
        );
      const sessionByDate = new Map(
        sessions.map((row) => [row.logicalDate, row])
      );

      const record = goalStats({
        goal: {
          startDate: goalRow.startDate,
          archivedOn: goalRow.archivedOn,
          scheduleVersions: goalDto.scheduleVersions.map((version) => ({
            effectiveFrom: version.effectiveFrom,
            cadence: version.cadence,
          })),
        },
        sessions: sessions.map((row) => ({
          logicalDate: row.logicalDate,
          minutes: row.minutes,
          note: row.note,
          mood: row.mood,
        })),
        settings: clock.history,
        today: clock.today,
      });

      const heatmap: GoalHeatmapDto =
        record.unit === "week"
          ? {
              unit: "week",
              weekStartsOn: record.weekStartsOn,
              weeks: record.weeks,
            }
          : {
              unit: "day",
              weekStartsOn: record.weekStartsOn,
              days: record.days.map((day) => ({
                date: day.date,
                expected: day.expected,
                extra: day.extra,
                status: day.status,
              })),
            };

      return {
        goal: goalDto,
        today: clock.today,
        readOnly,
        futureStart: false,
        startsOn: null,
        stats: {
          unit: record.unit,
          consistency: record.consistency,
          currentStreak: record.currentStreak,
          bestStreak: record.bestStreak,
          eras: record.eras,
          sessions: record.sessions,
          minutes: record.minutes,
        },
        heatmap,
        recentDays: recentDaysFor(
          record.days,
          record.unit,
          record.historyEnd,
          clock.today,
          readOnly,
          sessionByDate
        ),
      };
    }),
};
