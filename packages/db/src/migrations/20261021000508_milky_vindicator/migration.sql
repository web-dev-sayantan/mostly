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
CREATE INDEX `user_setting_version_userId_effectiveFrom_idx` ON `user_setting_version` (`user_id`,`effective_from`);