CREATE TABLE `listing_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`file_name` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
