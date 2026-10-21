import type { Context as ApiContext } from "@mostly/api/context";
import type { Context as HonoContext } from "hono";

import { createAuth, getDb } from "./services";

export interface CreateContextOptions {
  context: HonoContext;
}

export const createContext = async ({
  context,
}: CreateContextOptions): Promise<ApiContext> => {
  const db = await getDb();
  const auth = await createAuth(db);
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    db,
    session,
    now: () => new Date(),
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
