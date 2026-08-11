CREATE INDEX `idx_family_members_user_id` ON `family_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_workouts_family_started` ON `workouts` (`family_id`,`started_at`);