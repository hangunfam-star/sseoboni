ALTER TABLE `orders` ADD `seller_account_enc` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `trial_paused_ms` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `wait_shift_ms` integer DEFAULT 0 NOT NULL;