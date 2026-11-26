import { createAuth as createConfiguredAuth } from "@mostly/auth";
import { localDevAuthPlugin, resolveDevAuthAccount } from "@mostly/auth/dev";
import type { Database } from "@mostly/db";

import { createServerApp } from "./app";

export interface DevServerAppOptions {
  env: DevEnv;
  getDb: () => Database;
}

export const createDevServerApp = ({ env, getDb }: DevServerAppOptions) => {
  const devAccount = resolveDevAuthAccount(env);
  const googleEnabled =
    env.GOOGLE_CLIENT_ID.trim().length > 0 && env.GOOGLE_CLIENT_SECRET.trim().length > 0;

  const createAuth = (database?: Database) =>
    Promise.resolve(
      createConfiguredAuth(env, database ?? getDb(), {
        plugins: devAccount ? [localDevAuthPlugin(devAccount)] : [],
      }),
    );

  return createServerApp({
    env,
    createAuth,
    getDb,
    registerDevRoutes: (app) => {
      app.get("/api/auth/dev/status", (c) => {
        c.header("Cache-Control", "no-store");
        return c.json({
          enabled: devAccount !== null,
          account: devAccount,
          googleEnabled,
        });
      });
    },
  });
};
