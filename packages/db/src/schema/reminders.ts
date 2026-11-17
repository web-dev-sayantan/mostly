import { defineRelationsPart, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const pushSubscription = sqliteTable(
  "push_subscription",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("push_subscription_endpoint_idx").on(table.endpoint),
    index("push_subscription_user_idx").on(table.userId),
  ]
);

export const reminderDelivery = sqliteTable(
  "reminder_delivery",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    logicalDate: text("logical_date").notNull(),
    subscriptionId: text("subscription_id").references(
      () => pushSubscription.id,
      { onDelete: "set null" }
    ),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", {
      enum: ["sent", "failed", "suppressed"],
    }).notNull(),
    error: text("error"),
  },
  (table) => [
    uniqueIndex("reminder_delivery_user_logical_date_idx").on(
      table.userId,
      table.logicalDate
    ),
    index("reminder_delivery_user_idx").on(table.userId),
  ]
);

export const reminderRelations = defineRelationsPart(
  { pushSubscription, reminderDelivery, user },
  (r) => ({
    pushSubscription: {
      user: r.one.user({
        from: r.pushSubscription.userId,
        to: r.user.id,
      }),
      deliveries: r.many.reminderDelivery({
        from: r.pushSubscription.id,
        to: r.reminderDelivery.subscriptionId,
      }),
    },
    reminderDelivery: {
      user: r.one.user({
        from: r.reminderDelivery.userId,
        to: r.user.id,
      }),
      subscription: r.one.pushSubscription({
        from: r.reminderDelivery.subscriptionId,
        to: r.pushSubscription.id,
      }),
    },
  })
);
