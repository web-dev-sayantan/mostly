import { defineRelationsPart, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { goal } from "./goals";

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    goalId: text("goal_id")
      .notNull()
      .references(() => goal.id, { onDelete: "cascade" }),
    logicalDate: text("logical_date").notNull(),
    minutes: integer("minutes"),
    note: text("note"),
    mood: text("mood", { enum: ["great", "meh", "rough"] }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("session_goal_logical_date_live_idx")
      .on(table.goalId, table.logicalDate)
      .where(sql`${table.deletedAt} is null`),
    index("session_user_logical_date_idx").on(table.userId, table.logicalDate),
  ]
);

export const sessionRelations = defineRelationsPart(
  { goal, session, user },
  (r) => ({
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
      goal: r.one.goal({
        from: r.session.goalId,
        to: r.goal.id,
      }),
    },
  })
);
