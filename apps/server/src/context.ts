import type { Context as ApiContext } from "@mostly/api/context";
import { pushConfigFromEnv } from "@mostly/api/push";
import type { AuthInstance } from "@mostly/auth";
import type { Database } from "@mostly/db";
import type { Context as HonoContext } from "hono";

export interface CreateContextOptions {
  context: HonoContext;
  env: Env;
  createAuth: (database?: Database) => Promise<AuthInstance>;
  getDb: () => Database;
}

export const createContext = async ({
  context,
  env,
  createAuth,
  getDb,
}: CreateContextOptions): Promise<ApiContext> => {
  const db = getDb();
  const auth = await createAuth(db);
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    db,
    session,
    now: () => new Date(),
    push: pushConfigFromEnv(env),
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
