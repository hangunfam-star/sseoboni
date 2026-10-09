CREATE TABLE `disputes` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`opener_id` text NOT NULL,
	`reason` text NOT NULL,
	`detail` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`resolution` text,
	`buyer_fault` integer,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opener_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `disputes_order` ON `disputes` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`actor_id` text,
	`type` text NOT NULL,
	`data` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_events_order` ON `order_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`seller_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`snapshot` text NOT NULL,
	`price` integer NOT NULL,
	`shipping_fee` integer DEFAULT 0 NOT NULL,
	`tiers` text,
	`trial_hours` integer,
	`trial_fee` integer,
	`proposal_id` text,
	`questions` text,
	`deposit_name` text NOT NULL,
	`ship_enc` text NOT NULL,
	`refund_enc` text,
	`ship_carrier` text,
	`ship_tracking` text,
	`return_reason` text,
	`return_note` text,
	`return_carrier` text,
	`return_tracking` text,
	`return_handover_at` text,
	`inspection` text,
	`refund_kind` text,
	`refund_amount` integer,
	`fee_pct` real,
	`fee_amount` integer,
	`virtual_fee` integer,
	`cancel_reason` text,
	`ops_flag` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`paid_at` text,
	`shipped_at` text,
	`received_at` text,
	`trial_end_at` text,
	`needs_check_at` text,
	`decided_at` text,
	`return_requested_at` text,
	`return_shipped_at` text,
	`inspected_at` text,
	`refund_sent_at` text,
	`completed_at` text,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orders_buyer` ON `orders` (`buyer_id`);--> statement-breakpoint
CREATE INDEX `orders_seller` ON `orders` (`seller_id`);--> statement-breakpoint
CREATE INDEX `orders_listing` ON `orders` (`listing_id`);--> statement-breakpoint
CREATE INDEX `orders_status` ON `orders` (`status`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`writer_id` text NOT NULL,
	`target_id` text NOT NULL,
	`direction` text NOT NULL,
	`stars` integer NOT NULL,
	`chips` text NOT NULL,
	`sample` text,
	`body` text,
	`desc_match` integer,
	`comp_match` integer,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`writer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_order_writer` ON `reviews` (`order_id`,`writer_id`);--> statement-breakpoint
CREATE INDEX `reviews_target` ON `reviews` (`target_id`);--> statement-breakpoint
CREATE TABLE `seller_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`bank` text NOT NULL,
	`account_enc` text NOT NULL,
	`holder` text NOT NULL,
	`default_shipping` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trial_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`writer_id` text NOT NULL,
	`model_id` text NOT NULL,
	`outcome` text NOT NULL,
	`hours` integer NOT NULL,
	`answers` text,
	`reason` text,
	`learned` text,
	`fit_for` text,
	`condition_grade` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`writer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`model_id`) REFERENCES `product_models`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trial_reviews_order` ON `trial_reviews` (`order_id`);--> statement-breakpoint
CREATE INDEX `trial_reviews_model` ON `trial_reviews` (`model_id`);--> statement-breakpoint
CREATE TABLE `xp_awards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`order_id` text NOT NULL,
	`role` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `xp_awards_once` ON `xp_awards` (`order_id`,`user_id`,`kind`);--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `kind` text DEFAULT 'USER' NOT NULL;--> statement-breakpoint
INSERT OR IGNORE INTO `users` (`id`, `role`, `nickname`, `status`) VALUES ('sys_sseoboni', 'ADMIN', '써보니', 'SYSTEM');
