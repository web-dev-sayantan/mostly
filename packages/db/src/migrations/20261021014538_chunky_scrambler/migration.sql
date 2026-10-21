CREATE TABLE `push_subscription` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_agent` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`last_seen_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`revoked_at` integer,
	CONSTRAINT `fk_push_subscription_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `reminder_delivery` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`logical_date` text NOT NULL,
	`subscription_id` text,
	`sent_at` integer NOT NULL,
	`status` text NOT NULL,
	`error` text,
	CONSTRAINT `fk_reminder_delivery_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_reminder_delivery_subscription_id_push_subscription_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `push_subscription`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
ALTER TABLE `user` ADD `reminder_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `reminder_time` text DEFAULT '21:30' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscription_endpoint_idx` ON `push_subscription` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_subscription_user_idx` ON `push_subscription` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_delivery_user_logical_date_idx` ON `reminder_delivery` (`user_id`,`logical_date`);--> statement-breakpoint
CREATE INDEX `reminder_delivery_user_idx` ON `reminder_delivery` (`user_id`);