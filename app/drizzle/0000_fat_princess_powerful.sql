CREATE TABLE `buyer_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`trial_count` integer DEFAULT 0 NOT NULL,
	`purchase_count` integer DEFAULT 0 NOT NULL,
	`normal_return_count` integer DEFAULT 0 NOT NULL,
	`on_time_return_rate` real,
	`damage_incident_count` integer DEFAULT 0 NOT NULL,
	`chargeback_incident_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`trial_enabled` integer DEFAULT false NOT NULL,
	`trial_policy_id` text
);
--> statement-breakpoint
CREATE TABLE `demand_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`model_id` text NOT NULL,
	`intent_type` text NOT NULL,
	`desired_price_min` integer,
	`desired_price_max` integer,
	`desired_trial_hours` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`model_id`) REFERENCES `product_models`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `listing_components` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`name` text NOT NULL,
	`required_on_return` integer DEFAULT false NOT NULL,
	`replacement_value` integer,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_id` text NOT NULL,
	`model_id` text NOT NULL,
	`title` text NOT NULL,
	`price` integer NOT NULL,
	`condition_grade` text NOT NULL,
	`description` text NOT NULL,
	`direct_sale_enabled` integer DEFAULT true NOT NULL,
	`trial_enabled` integer DEFAULT false NOT NULL,
	`trial_policy_id` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`model_id`) REFERENCES `product_models`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `market_validation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`listing_id` text,
	`model_id` text,
	`user_id` text,
	`metadata` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_models` (
	`id` text PRIMARY KEY NOT NULL,
	`brand` text NOT NULL,
	`model_name` text NOT NULL,
	`category_id` text NOT NULL,
	`canonical_spec` text,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `seller_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`seller_type` text DEFAULT 'INDIVIDUAL' NOT NULL,
	`business_verified` integer DEFAULT false NOT NULL,
	`avg_ship_time` integer,
	`description_match_score` real,
	`dispute_rate` real DEFAULT 0 NOT NULL,
	`trial_count` integer DEFAULT 0 NOT NULL,
	`sale_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`identity_verified` integer DEFAULT false NOT NULL,
	`phone_verified` integer DEFAULT false NOT NULL,
	`buyer_trust_level` integer DEFAULT 0 NOT NULL,
	`seller_trust_level` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wishlists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wishlists_user_listing_idx` ON `wishlists` (`user_id`,`listing_id`);