import { defineRelationsPart, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const goal = sqliteTable(
  "goal",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji"),
    color: text("color"),
    priority: text("priority", { enum: ["high", "medium", "low"] })
      .default("medium")
      .notNull(),
    startDate: text("start_date").notNull(),
    archivedOn: text("archived_on"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("goal_user_id_idx").on(table.userId)]
);

export const goalScheduleVersion = sqliteTable(
  "goal_schedule_version",
  {
    id: text("id").primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goal.id, { onDelete: "cascade" }),
    effectiveFrom: text("effective_from").notNull(),
    cadenceType: text("cadence_type", {
      enum: ["daily", "weekdays", "weekly_target"],
    }).notNull(),
    weekdays: text("weekdays", { mode: "json" }).$type<number[]>(),
    weeklyTarget: integer("weekly_target"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("goal_schedule_version_goal_effective_idx").on(
      table.goalId,
      table.effectiveFrom
    ),
  ]
);

export const goalsRelations = defineRelationsPart(
  { goal, goalScheduleVersion },
  (r) => ({
    goal: {
      scheduleVersions: r.many.goalScheduleVersion({
        from: r.goal.id,
        to: r.goalScheduleVersion.goalId,
      }),
    },
    goalScheduleVersion: {
      goal: r.one.goal({
        from: r.goalScheduleVersion.goalId,
        to: r.goal.id,
      }),
    },
  })
);
