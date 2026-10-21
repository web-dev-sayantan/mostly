import type { Session } from "@mostly/auth";
import type { Database } from "@mostly/db";

import type { PushConfig } from "./push";

export interface Context {
  session: Session | null;
  db: Database;
  /** Injected clock so API tests can pin time-sensitive boundaries. */
  now: () => Date;
  /** VAPID configuration, or null when push is not configured. */
  push: PushConfig | null;
}
