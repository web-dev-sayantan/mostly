import type { Session } from "@mostly/auth";
import type { Database } from "@mostly/db";

export interface Context {
  session: Session | null;
  db: Database;
  /** Injected clock so API tests can pin time-sensitive boundaries. */
  now: () => Date;
}
