CREATE TABLE `goal` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text,
	`color` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`start_date` text NOT NULL,
	`archived_on` text,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_goal_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `goal_schedule_version` (
	`id` text PRIMARY KEY,
	`goal_id` text NOT NULL,
	`effective_from` text NOT NULL,
	`cadence_type` text NOT NULL,
	`weekdays` text,
	`weekly_target` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_goal_schedule_version_goal_id_goal_id_fk` FOREIGN KEY (`goal_id`) REFERENCES `goal`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`goal_id` text NOT NULL,
	`logical_date` text NOT NULL,
	`minutes` integer,
	`note` text,
	`mood` text,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_session_goal_id_goal_id_fk` FOREIGN KEY (`goal_id`) REFERENCES `goal`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user_setting_version` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`effective_from` text NOT NULL,
	`timezone` text NOT NULL,
	`week_starts_on` integer DEFAULT 1 NOT NULL,
	`day_rollover_hour` integer DEFAULT 4 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_user_setting_version_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `user` ADD `timezone` text;--> statement-breakpoint
ALTER TABLE `user` ADD `week_starts_on` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `day_rollover_hour` integer DEFAULT 4 NOT NULL;--> statement-breakpoint
CREATE INDEX `goal_user_id_idx` ON `goal` (`user_id`);--> statement-breakpoint
CREATE INDEX `goal_schedule_version_goal_effective_idx` ON `goal_schedule_version` (`goal_id`,`effective_from`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_goal_logical_date_live_idx` ON `session` (`goal_id`,`logical_date`) WHERE "session"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `session_user_logical_date_idx` ON `session` (`user_id`,`logical_date`);--> statement-breakpoint
CREATE INDEX `user_setting_version_userId_effectiveFrom_idx` ON `user_setting_version` (`user_id`,`effective_from`);