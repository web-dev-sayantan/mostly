import { goal } from "@mostly/db/schema/goals";
import { session } from "@mostly/db/schema/sessions";
import type { ProgressResult } from "@mostly/domain";
import { buildProgress, comparePriority } from "@mostly/domain";
import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../procedures";
import { loadUserClock } from "../user-clock";
import { loadGoalDto } from "./goals";

const rangeSchema = z.union([z.literal(7), z.literal(30), z.literal(90)]);

export const progressRouter = {
  get: protectedProcedure
    .input(z.object({ range: rangeSchema.default(30) }))
    .handler(async ({ context, input }): Promise<ProgressResult> => {
      const userId = context.session.user.id;
      const clock = await loadUserClock(context.db, userId, context.now());
      const goalRows = await context.db
        .select()
        .from(goal)
        .where(and(eq(goal.userId, userId), isNull(goal.deletedAt)))
        .orderBy(asc(goal.createdAt));
      const goalDtos = await Promise.all(
        goalRows.map((row) => loadGoalDto(context.db, row))
      );
      const goalIds = goalRows.map((row) => row.id);
      const sessions =
        goalIds.length === 0
          ? []
          : await context.db
              .select()
              .from(session)
              .where(
                and(
                  eq(session.userId, userId),
                  isNull(session.deletedAt),
                  inArray(session.goalId, goalIds),
                  lte(session.logicalDate, clock.today)
                )
              )
              .orderBy(asc(session.logicalDate));

      return buildProgress({
        goals: goalDtos.toSorted(
          (a, b) =>
            comparePriority(a.priority, b.priority) ||
            a.createdAt.localeCompare(b.createdAt)
        ),
        sessions: sessions.map((row) => ({
          goalId: row.goalId,
          logicalDate: row.logicalDate,
          minutes: row.minutes,
        })),
        settings: clock.history,
        today: clock.today,
        range: input.range,
        skippedDates: clock.skippedDates,
      });
    }),
};
