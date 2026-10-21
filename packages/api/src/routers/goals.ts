import type { Database } from "@mostly/db";
import { goal, goalScheduleVersion } from "@mostly/db/schema/goals";
import type { Cadence, Weekday } from "@mostly/domain";
import {
  initialSchedule,
  isIsoDate,
  normalizeCadence,
  planScheduleChange,
} from "@mostly/domain";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import {
  countGoalSessions,
  findOwnedGoal,
  requireWritableGoal,
  tombstoneGoalSessions,
} from "../goal-access";
import { protectedProcedure } from "../procedures";
import { loadUserClock } from "../user-clock";

type GoalRow = typeof goal.$inferSelect;
type ScheduleRow = typeof goalScheduleVersion.$inferSelect;
type Priority = GoalRow["priority"];

export interface GoalScheduleVersionDto {
  id: string;
  effectiveFrom: string;
  cadence: Cadence;
}

export interface GoalDto {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  priority: Priority;
  startDate: string;
  archivedOn: string | null;
  createdAt: string;
  updatedAt: string;
  sessionCount: number;
  scheduleVersions: GoalScheduleVersionDto[];
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const isWeekday = (value: number): value is Weekday => value >= 1 && value <= 7;

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine(isIsoDate, "Enter a valid date");

const prioritySchema = z.enum(["high", "medium", "low"]);

const cadenceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily") }),
  z.object({
    type: z.literal("weekdays"),
    weekdays: z.array(z.number().int().min(1).max(7)).min(1),
  }),
  z.object({
    type: z.literal("weekly_target"),
    target: z.number().int().min(1).max(7),
  }),
]);

const emojiSchema = z.string().trim().max(8).nullish();
const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-f]{6}$/iu)
  .nullish();

const idSchema = z.object({ id: z.string().min(1) });

const toDomainCadence = (cadence: z.infer<typeof cadenceSchema>): Cadence => {
  if (cadence.type === "weekdays") {
    return { type: "weekdays", weekdays: cadence.weekdays as Weekday[] };
  }
  if (cadence.type === "weekly_target") {
    return { type: "weekly_target", target: cadence.target };
  }
  return { type: "daily" };
};

export const toCadence = (row: ScheduleRow): Cadence => {
  if (row.cadenceType === "weekdays") {
    return { type: "weekdays", weekdays: (row.weekdays ?? []) as Weekday[] };
  }
  if (row.cadenceType === "weekly_target") {
    return { type: "weekly_target", target: row.weeklyTarget ?? 1 };
  }
  return { type: "daily" };
};

const scheduleColumns = (cadence: Cadence) => ({
  cadenceType: cadence.type,
  weekdays: cadence.type === "weekdays" ? cadence.weekdays : null,
  weeklyTarget: cadence.type === "weekly_target" ? cadence.target : null,
});

const toDto = (
  row: GoalRow,
  versions: ScheduleRow[],
  sessionCount: number
): GoalDto => ({
  id: row.id,
  name: row.name,
  emoji: row.emoji,
  color: row.color,
  priority: row.priority,
  startDate: row.startDate,
  archivedOn: row.archivedOn,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  sessionCount,
  scheduleVersions: versions.map((version) => ({
    id: version.id,
    effectiveFrom: version.effectiveFrom,
    cadence: toCadence(version),
  })),
});

const loadVersions = (db: Database, goalId: string) =>
  db
    .select()
    .from(goalScheduleVersion)
    .where(eq(goalScheduleVersion.goalId, goalId))
    .orderBy(asc(goalScheduleVersion.effectiveFrom));

export const loadGoalDto = async (
  db: Database,
  row: GoalRow
): Promise<GoalDto> =>
  toDto(
    row,
    await loadVersions(db, row.id),
    await countGoalSessions(db, row.id)
  );

const byPriorityThenCreation = (a: GoalDto, b: GoalDto) =>
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
  a.createdAt.localeCompare(b.createdAt);

const requireActiveForEdit = (row: GoalRow, today: string) => {
  if (row.archivedOn && row.archivedOn < today) {
    throw new ORPCError("BAD_REQUEST", { message: "This goal is archived." });
  }
};

export const goalsRouter = {
  list: protectedProcedure.handler(async ({ context }) => {
    const { id: userId } = context.session.user;
    const rows = await context.db
      .select()
      .from(goal)
      .where(and(eq(goal.userId, userId), isNull(goal.deletedAt)));

    const versions =
      rows.length === 0
        ? []
        : await context.db
            .select()
            .from(goalScheduleVersion)
            .where(
              inArray(
                goalScheduleVersion.goalId,
                rows.map((row) => row.id)
              )
            )
            .orderBy(asc(goalScheduleVersion.effectiveFrom));

    const versionsByGoal = new Map<string, ScheduleRow[]>();
    for (const version of versions) {
      const list = versionsByGoal.get(version.goalId) ?? [];
      list.push(version);
      versionsByGoal.set(version.goalId, list);
    }

    const { today } = await loadUserClock(context.db, userId, context.now());
    const dtos = await Promise.all(
      rows.map(async (row) =>
        toDto(
          row,
          versionsByGoal.get(row.id) ?? [],
          await countGoalSessions(context.db, row.id)
        )
      )
    );

    return {
      active: dtos
        .filter((dto) => !dto.archivedOn || dto.archivedOn >= today)
        .toSorted(byPriorityThenCreation),
      archived: dtos
        .filter((dto) => dto.archivedOn && dto.archivedOn < today)
        .toSorted(byPriorityThenCreation),
    };
  }),

  get: protectedProcedure
    .input(idSchema)
    .handler(async ({ context, input }) => {
      const row = await findOwnedGoal(
        context.db,
        context.session.user.id,
        input.id
      );

      if (!row) {
        throw new ORPCError("NOT_FOUND");
      }

      return loadGoalDto(context.db, row);
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(40),
        emoji: emojiSchema,
        color: colorSchema,
        priority: prioritySchema.default("medium"),
        cadence: cadenceSchema.default({ type: "daily" }),
        startDate: dateSchema,
      })
    )
    .handler(async ({ context, input }) => {
      const { today } = await loadUserClock(
        context.db,
        context.session.user.id,
        context.now()
      );

      if (input.startDate < today) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Start date can't be in the past.",
        });
      }

      const cadence = normalizeCadence(toDomainCadence(input.cadence));
      const now = new Date();
      const id = crypto.randomUUID();
      const schedule = initialSchedule(input.startDate, cadence);

      await context.db.transaction(async (tx) => {
        await tx.insert(goal).values({
          id,
          userId: context.session.user.id,
          name: input.name,
          emoji: input.emoji || null,
          color: input.color || null,
          priority: input.priority,
          startDate: input.startDate,
          createdAt: now,
          updatedAt: now,
        });

        await tx.insert(goalScheduleVersion).values({
          id: crypto.randomUUID(),
          goalId: id,
          effectiveFrom: schedule.effectiveFrom,
          ...scheduleColumns(schedule.cadence),
          createdAt: now,
        });
      });

      const row = await requireWritableGoal(
        context.db,
        context.session.user.id,
        id
      );
      return loadGoalDto(context.db, row);
    }),

  update: protectedProcedure
    .input(
      idSchema.extend({
        name: z.string().trim().min(1).max(40).optional(),
        emoji: emojiSchema,
        color: colorSchema,
        priority: prioritySchema.optional(),
        cadence: cadenceSchema.optional(),
        startDate: dateSchema.optional(),
      })
    )
    .handler(async ({ context, input }) => {
      const { id: userId } = context.session.user;
      const current = await requireWritableGoal(context.db, userId, input.id);
      const clock = await loadUserClock(context.db, userId, context.now());
      const { today } = clock;
      requireActiveForEdit(current, today);

      let { startDate } = current;
      const { startDate: requestedStartDate } = input;
      if (
        requestedStartDate !== undefined &&
        requestedStartDate !== current.startDate
      ) {
        if (requestedStartDate < today) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Start date can't be in the past.",
          });
        }
        if (current.startDate <= today) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Start date can't change after a goal has started.",
          });
        }
        startDate = requestedStartDate;
      }

      const startDateChanged = startDate !== current.startDate;
      const now = new Date();
      const changes: Partial<typeof goal.$inferInsert> = {
        startDate,
        updatedAt: now,
      };

      if (input.name !== undefined) {
        changes.name = input.name;
      }
      if (input.emoji !== undefined) {
        changes.emoji = input.emoji || null;
      }
      if (input.color !== undefined) {
        changes.color = input.color || null;
      }
      if (input.priority !== undefined) {
        changes.priority = input.priority;
      }

      await context.db.transaction(async (tx) => {
        if (input.cadence !== undefined) {
          const versionRows = await tx
            .select()
            .from(goalScheduleVersion)
            .where(eq(goalScheduleVersion.goalId, current.id));
          const existing = versionRows.map((row) => ({
            effectiveFrom: row.effectiveFrom,
            cadence: toCadence(row),
          }));
          const plan = planScheduleChange({
            versions: existing,
            today,
            cadence: toDomainCadence(input.cadence),
            startDate,
            weekStartsOn: isWeekday(clock.weekStartsOn)
              ? clock.weekStartsOn
              : 1,
          });

          const pendingOnly =
            startDate > today
              ? eq(goalScheduleVersion.goalId, current.id)
              : and(
                  eq(goalScheduleVersion.goalId, current.id),
                  gt(goalScheduleVersion.effectiveFrom, today)
                );
          await tx.delete(goalScheduleVersion).where(pendingOnly);

          if (plan.pending) {
            await tx.insert(goalScheduleVersion).values({
              id: crypto.randomUUID(),
              goalId: current.id,
              effectiveFrom: plan.pending.effectiveFrom,
              ...scheduleColumns(plan.pending.cadence),
              createdAt: now,
            });
          }
        } else if (startDateChanged) {
          await tx
            .update(goalScheduleVersion)
            .set({ effectiveFrom: startDate })
            .where(eq(goalScheduleVersion.goalId, current.id));
        }

        await tx
          .update(goal)
          .set(changes)
          .where(
            and(
              eq(goal.id, current.id),
              eq(goal.userId, context.session.user.id)
            )
          );
      });

      const row = await requireWritableGoal(
        context.db,
        context.session.user.id,
        current.id
      );
      return loadGoalDto(context.db, row);
    }),

  archive: protectedProcedure
    .input(idSchema)
    .handler(async ({ context, input }) => {
      const current = await requireWritableGoal(
        context.db,
        context.session.user.id,
        input.id
      );

      if (current.archivedOn) {
        return loadGoalDto(context.db, current);
      }

      const clock = await loadUserClock(
        context.db,
        context.session.user.id,
        context.now()
      );
      const now = new Date();
      await context.db
        .update(goal)
        .set({ archivedOn: clock.today, updatedAt: now })
        .where(
          and(eq(goal.id, current.id), eq(goal.userId, context.session.user.id))
        );

      const row = await requireWritableGoal(
        context.db,
        context.session.user.id,
        current.id
      );
      return loadGoalDto(context.db, row);
    }),

  delete: protectedProcedure
    .input(
      idSchema.extend({ sessionCount: z.number().int().min(0).optional() })
    )
    .handler(async ({ context, input }) => {
      const current = await requireWritableGoal(
        context.db,
        context.session.user.id,
        input.id
      );
      const sessionCount = await countGoalSessions(context.db, current.id);

      if (
        input.sessionCount !== undefined &&
        input.sessionCount !== sessionCount
      ) {
        throw new ORPCError("CONFLICT", {
          message: "The session count changed. Review the goal again.",
        });
      }

      const now = new Date();
      await tombstoneGoalSessions(context.db, current.id, now);
      await context.db
        .update(goal)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(eq(goal.id, current.id), eq(goal.userId, context.session.user.id))
        );

      return { sessionCount };
    }),
};
