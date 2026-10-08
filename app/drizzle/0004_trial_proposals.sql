CREATE TABLE `trial_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`hours` integer NOT NULL,
	`offer_fee` integer NOT NULL,
	`message` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`seller_reply` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
