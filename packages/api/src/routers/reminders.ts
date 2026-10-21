import { user } from "@mostly/db/schema/auth";
import { pushSubscription } from "@mostly/db/schema/reminders";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../procedures";
import { createPushSender } from "../push";
import { getReminderOverview, sendTestReminder } from "../reminder-service";

const timeSchema = z
  .string()
  .regex(
    /^(?<hours>[01]\d|2[0-3]):(?<minutes>[0-5]\d)$/u,
    "Use a local time like 21:30"
  );

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
  userAgent: z.string().max(512).optional(),
});

const senderFor = (context: {
  push: { publicKey: string; privateKey: string; subject: string } | null;
}) => (context.push ? createPushSender(context.push) : null);

export const remindersRouter = {
  overview: protectedProcedure.handler(async ({ context }) => {
    const overview = await getReminderOverview({
      db: context.db,
      userId: context.session.user.id,
      now: context.now(),
    });

    return {
      ...overview,
      configured: context.push !== null,
      publicKey: context.push?.publicKey ?? null,
    };
  }),

  publicKey: protectedProcedure.handler(({ context }) => ({
    publicKey: context.push?.publicKey ?? null,
  })),

  update: protectedProcedure
    .input(
      z
        .object({
          enabled: z.boolean().optional(),
          time: timeSchema.optional(),
        })
        .refine(
          (value) => value.enabled !== undefined || value.time !== undefined,
          { message: "Nothing to update" }
        )
    )
    .handler(async ({ context, input }) => {
      const changes: { reminderEnabled?: boolean; reminderTime?: string } = {};
      if (input.enabled !== undefined) {
        changes.reminderEnabled = input.enabled;
      }
      if (input.time !== undefined) {
        changes.reminderTime = input.time;
      }

      await context.db
        .update(user)
        .set(changes)
        .where(eq(user.id, context.session.user.id));

      const [row] = await context.db
        .select({
          enabled: user.reminderEnabled,
          time: user.reminderTime,
        })
        .from(user)
        .where(eq(user.id, context.session.user.id));

      return row ?? { enabled: false, time: "21:30" };
    }),

  subscription: {
    register: protectedProcedure
      .input(subscriptionSchema)
      .handler(async ({ context, input }) => {
        const userId = context.session.user.id;
        const now = context.now();
        const [existing] = await context.db
          .select()
          .from(pushSubscription)
          .where(eq(pushSubscription.endpoint, input.endpoint));

        if (existing && existing.userId !== userId) {
          if (!existing.revokedAt) {
            throw new ORPCError("NOT_FOUND");
          }
          // A revoked row from a previous account on this browser should not
          // block the new owner of the same endpoint.
          await context.db
            .delete(pushSubscription)
            .where(eq(pushSubscription.id, existing.id));
        } else if (existing) {
          await context.db
            .update(pushSubscription)
            .set({
              p256dh: input.p256dh,
              auth: input.auth,
              userAgent: input.userAgent ?? existing.userAgent,
              lastSeenAt: now,
              revokedAt: null,
            })
            .where(eq(pushSubscription.id, existing.id));
          return { id: existing.id };
        }

        const id = crypto.randomUUID();
        await context.db.insert(pushSubscription).values({
          id,
          userId,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent ?? null,
          createdAt: now,
          lastSeenAt: now,
        });
        return { id };
      }),

    revoke: protectedProcedure
      .input(z.object({ endpoint: z.string().url().max(2048) }))
      .handler(async ({ context, input }) => {
        const revoked = await context.db
          .update(pushSubscription)
          .set({ revokedAt: context.now() })
          .where(
            and(
              eq(pushSubscription.userId, context.session.user.id),
              eq(pushSubscription.endpoint, input.endpoint),
              isNull(pushSubscription.revokedAt)
            )
          )
          .returning({ id: pushSubscription.id });

        return { revoked: revoked.length > 0 };
      }),
  },

  test: protectedProcedure
    .input(
      z.object({ endpoint: z.string().url().max(2048).optional() }).optional()
    )
    .handler(async ({ context, input }) => {
      const result = await sendTestReminder({
        db: context.db,
        userId: context.session.user.id,
        endpoint: input?.endpoint,
        sender: senderFor(context),
      });

      if (result === "unconfigured") {
        throw new ORPCError("PRECONDITION_FAILED", {
          message: "Push is not configured on this server.",
        });
      }
      if (result === "no_subscription") {
        throw new ORPCError("PRECONDITION_FAILED", {
          message: "No push subscription on this device.",
        });
      }

      return { sent: true };
    }),
};
