import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import type { DatabaseConfig } from "./config";
import { relations } from "./relations";

export function createDb(env: DatabaseConfig) {
  const client = createClient({
    url: env.DATABASE_URL || "",
    authToken: env.DATABASE_AUTH_TOKEN,
  });

  return drizzle({ client, relations });
}

export type Database = ReturnType<typeof createDb>;
