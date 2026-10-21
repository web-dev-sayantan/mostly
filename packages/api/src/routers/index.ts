import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../procedures";
import { accountRouter } from "./account";
import { daysRouter } from "./days";
import { goalsRouter } from "./goals";
import { onboardingRouter } from "./onboarding";
import { remindersRouter } from "./reminders";
import { sessionsRouter } from "./sessions";
import { settingsRouter } from "./settings";
import { statsRouter } from "./stats";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => "OK"),
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    user: context.session?.user,
  })),
  account: accountRouter,
  days: daysRouter,
  goals: goalsRouter,
  onboarding: onboardingRouter,
  reminders: remindersRouter,
  settings: settingsRouter,
  sessions: sessionsRouter,
  stats: statsRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
