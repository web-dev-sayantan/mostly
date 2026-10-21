import type { Database } from "@mostly/db";
import { goal } from "@mostly/db/schema/goals";
import { session } from "@mostly/db/schema/sessions";
import type {
  Mood,
  SessionConflict,
  SessionOp,
  SessionRecord,
  SyncRejection,
} from "@mostly/domain";
import {
  MOODS,
  createSessionConflict,
  rejectSessionOp,
  resolveSessionOp,
} from "@mostly/domain";
import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

const isIsoDate = (value: string): boolean => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

const dateSchema = z
  .string()
  .regex(DATE_PATTERN)
  .refine(isIsoDate, "Enter a valid date");

const opSchema = z.object({
  opId: z.string().min(1).max(128),
  id: z.string().min(1).max(128),
  goalId: z.string().min(1).max(128),
  logicalDate: dateSchema,
  minutes: z.number().int().min(0).max(1440).nullable(),
  note: z.string().max(500).nullable(),
  mood: z.enum(MOODS).nullable(),
  updatedAt: z.number().int().nonnegative(),
  deleted: z.boolean(),
});

const listSchema = z
  .object({ from: dateSchema, to: dateSchema })
  .refine((input) => input.from <= input.to, {
    message: "The range must end on or after it starts.",
    path: ["to"],
  });

type SessionRow = typeof session.$inferSelect;

const toRecord = (row: SessionRow): SessionRecord => ({
  id: row.id,
  goalId: row.goalId,
  logicalDate: row.logicalDate,
  minutes: row.minutes,
  note: row.note,
  mood: row.mood as Mood | null,
  updatedAt: row.updatedAt.getTime(),
  deletedAt: row.deletedAt?.getTime() ?? null,
});

const keyOf = (goalId: string, logicalDate: string): string =>
  `${goalId}:${logicalDate}`;

const findLatest = async (
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  goalId: string,
  logicalDate: string
): Promise<SessionRow | null> => {
  const [row] = await tx
    .select()
    .from(session)
    .where(
      and(eq(session.goalId, goalId), eq(session.logicalDate, logicalDate))
    )
    .orderBy(desc(session.updatedAt))
    .limit(1);
  return row ?? null;
};

export interface SessionSyncResult {
  applied: string[];
  winners: SessionRecord[];
  conflicts: SessionConflict[];
  rejected: { opId: string; reason: SyncRejection }[];
}

export const sessionsRouter = {
  list: protectedProcedure
    .input(listSchema)
    .handler(async ({ context, input }) => {
      const rows = await context.db
        .select()
        .from(session)
        .where(
          and(
            eq(session.userId, context.session.user.id),
            isNull(session.deletedAt),
            gte(session.logicalDate, input.from),
            lte(session.logicalDate, input.to)
          )
        )
        .orderBy(asc(session.logicalDate), asc(session.goalId));

      return rows.map(toRecord);
    }),

  sync: protectedProcedure
    .input(z.object({ ops: z.array(opSchema) }))
    .handler(({ context, input }): Promise<SessionSyncResult> => {
      const userId = context.session.user.id;
      const now = Date.now();
      const goalIds = [...new Set(input.ops.map((op) => op.goalId))];
      const sorted = input.ops.toSorted(
        (a, b) =>
          a.updatedAt - b.updatedAt ||
          a.id.localeCompare(b.id) ||
          a.opId.localeCompare(b.opId)
      );

      return context.db.transaction(async (tx) => {
        const goals =
          goalIds.length === 0
            ? []
            : await tx
                .select()
                .from(goal)
                .where(and(eq(goal.userId, userId), inArray(goal.id, goalIds)));
        const goalsById = new Map(goals.map((row) => [row.id, row]));

        const applied: string[] = [];
        const winners = new Map<string, SessionRecord>();
        const conflicts: SessionConflict[] = [];
        const rejected: { opId: string; reason: SyncRejection }[] = [];

        for (const op of sorted) {
          const goalRow = goalsById.get(op.goalId);
          const rejection = rejectSessionOp(
            op as SessionOp,
            goalRow
              ? {
                  startDate: goalRow.startDate,
                  archivedOn: goalRow.archivedOn,
                  deletedAt: goalRow.deletedAt?.getTime() ?? null,
                }
              : null
          );

          if (rejection) {
            rejected.push({ opId: op.opId, reason: rejection });
            continue;
          }

          // eslint-disable-next-line no-await-in-loop -- the batch stays ordered inside one transaction
          const currentRow = await findLatest(tx, op.goalId, op.logicalDate);
          const resolution = resolveSessionOp(
            currentRow ? toRecord(currentRow) : null,
            op as SessionOp
          );
          const key = keyOf(op.goalId, op.logicalDate);

          if (resolution.outcome === "applied") {
            const winner = resolution.session;
            const write = currentRow
              ? tx
                  .update(session)
                  .set({
                    minutes: winner.minutes,
                    note: winner.note,
                    mood: winner.mood,
                    deletedAt:
                      winner.deletedAt === null
                        ? null
                        : new Date(winner.deletedAt),
                    updatedAt: new Date(winner.updatedAt),
                  })
                  .where(eq(session.id, currentRow.id))
              : tx.insert(session).values({
                  id: winner.id,
                  userId,
                  goalId: winner.goalId,
                  logicalDate: winner.logicalDate,
                  minutes: winner.minutes,
                  note: winner.note,
                  mood: winner.mood,
                  deletedAt:
                    winner.deletedAt === null
                      ? null
                      : new Date(winner.deletedAt),
                  updatedAt: new Date(winner.updatedAt),
                  createdAt: new Date(now),
                });

            // eslint-disable-next-line no-await-in-loop -- writes stay ordered inside one transaction
            await write;

            applied.push(op.opId);
            winners.set(key, winner);
          } else if (resolution.outcome === "conflict") {
            conflicts.push(
              createSessionConflict(op as SessionOp, resolution.winner, now)
            );
            winners.set(key, resolution.winner);
          } else {
            // Already at this value: settle the replay so the client clears it.
            applied.push(op.opId);
            winners.set(key, resolution.winner);
          }
        }

        return {
          applied,
          winners: [...winners.values()],
          conflicts,
          rejected,
        };
      });
    }),
};
