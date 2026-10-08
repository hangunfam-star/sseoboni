CREATE TABLE `listing_trial_terms` (
	`listing_id` text PRIMARY KEY NOT NULL,
	`hours` text NOT NULL,
	`daily_fee` integer NOT NULL,
	`purchase_credit_pct` integer DEFAULT 0 NOT NULL,
	`shipping_one_way` integer,
	`condition_note` text,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
