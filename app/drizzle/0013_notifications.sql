CREATE TABLE `notification_prefs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`chat` integer DEFAULT true NOT NULL,
	`interest` integer DEFAULT true NOT NULL,
	`review` integer DEFAULT true NOT NULL,
	`quiet` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`url` text NOT NULL,
	`dedupe_key` text,
	`deliver_after` text NOT NULL,
	`pushed_at` text,
	`read_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notifications_user` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe` ON `notifications` (`user_id`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `notifications_pending` ON `notifications` (`pushed_at`,`deliver_after`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_agent` text,
	`fail_count` integer DEFAULT 0 NOT NULL,
	`last_success_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `push_subscriptions_user` ON `push_subscriptions` (`user_id`);