import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../procedures";
import { goalsRouter } from "./goals";
import { settingsRouter } from "./settings";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => "OK"),
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    user: context.session?.user,
  })),
  goals: goalsRouter,
  settings: settingsRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
