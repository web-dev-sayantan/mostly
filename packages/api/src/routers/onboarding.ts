import { user } from "@mostly/db/schema/auth";
import { goal } from "@mostly/db/schema/goals";
import { and, eq, isNull } from "drizzle-orm";

import { protectedProcedure } from "../procedures";

export const onboardingRouter = {
  status: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const [row] = await context.db
      .select({ completedAt: user.onboardingCompletedAt })
      .from(user)
      .where(eq(user.id, userId));

    if (row?.completedAt) {
      return { completed: true };
    }

    const [firstGoal] = await context.db
      .select({ id: goal.id })
      .from(goal)
      .where(and(eq(goal.userId, userId), isNull(goal.deletedAt)))
      .limit(1);

    return { completed: Boolean(firstGoal) };
  }),

  complete: protectedProcedure.handler(async ({ context }) => {
    await context.db
      .update(user)
      .set({ onboardingCompletedAt: context.now() })
      .where(eq(user.id, context.session.user.id));

    return { completed: true };
  }),
};
