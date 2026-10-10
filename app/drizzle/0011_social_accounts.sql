CREATE TABLE `social_accounts` (
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_accounts_provider_uid` ON `social_accounts` (`provider`,`provider_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `social_accounts_provider_user` ON `social_accounts` (`provider`,`user_id`);