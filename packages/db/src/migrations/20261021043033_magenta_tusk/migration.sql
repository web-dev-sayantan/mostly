CREATE TABLE `account_deletion` (
	`user_id` text PRIMARY KEY,
	`deleted_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `user_setting_version` ADD `skipped_dates` text;