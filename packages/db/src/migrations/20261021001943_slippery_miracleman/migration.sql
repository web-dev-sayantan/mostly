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
CREATE UNIQUE INDEX `session_goal_logical_date_live_idx` ON `session` (`goal_id`,`logical_date`) WHERE "session"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `session_user_logical_date_idx` ON `session` (`user_id`,`logical_date`);