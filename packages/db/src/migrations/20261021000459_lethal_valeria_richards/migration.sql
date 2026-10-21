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
CREATE INDEX `goal_user_id_idx` ON `goal` (`user_id`);--> statement-breakpoint
CREATE INDEX `goal_schedule_version_goal_effective_idx` ON `goal_schedule_version` (`goal_id`,`effective_from`);