CREATE TABLE `order_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`stage` text NOT NULL,
	`user_id` text NOT NULL,
	`file_name` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_photos_order` ON `order_photos` (`order_id`);--> statement-breakpoint
ALTER TABLE `listings` ADD `check_items` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `arrival_check` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `pack_check` text;