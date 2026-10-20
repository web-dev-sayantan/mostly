import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import { relations } from "./relations";

/** A disposable in-memory database with the committed migrations applied. */
export const createTestDb = async () => {
  const client = createClient({ url: ":memory:" });
  const db = drizzle({ client, relations });

  await migrate(db, {
    migrationsFolder: `${import.meta.dirname}/migrations`,
  });

  return {
    db,
    close: () => client.close(),
  };
};
