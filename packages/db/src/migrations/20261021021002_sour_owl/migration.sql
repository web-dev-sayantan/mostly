ALTER TABLE `user` ADD `onboarding_completed_at` integer;--> statement-breakpoint
-- Existing accounts predate onboarding and should go straight to Today.
UPDATE `user`
SET `onboarding_completed_at` = (cast(unixepoch('subsecond') * 1000 as integer))
WHERE `onboarding_completed_at` IS NULL;
