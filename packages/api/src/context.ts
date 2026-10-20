import type { Session } from "@mostly/auth";
import type { Database } from "@mostly/db";

export type Context = {
  session: Session | null;
  db: Database;
};
