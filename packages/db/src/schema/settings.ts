import { defineRelationsPart, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const userSettingVersion = sqliteTable(
  "user_setting_version",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    effectiveFrom: text("effective_from").notNull(),
    timeZone: text("timezone").notNull(),
    weekStartsOn: integer("week_starts_on").notNull().default(1),
    dayRolloverHour: integer("day_rollover_hour").notNull().default(4),
    skippedDates: text("skipped_dates", { mode: "json" }).$type<string[]>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("user_setting_version_userId_effectiveFrom_idx").on(
      table.userId,
      table.effectiveFrom
    ),
  ]
);

export const settingRelations = defineRelationsPart(
  { user, userSettingVersion },
  (r) => ({
    userSettingVersion: {
      user: r.one.user({
        from: r.userSettingVersion.userId,
        to: r.user.id,
      }),
    },
  })
);
