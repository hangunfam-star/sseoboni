CREATE TABLE `carry_nonces` (
	`nonce_hash` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` text DEFAULT (current_timestamp) NOT NULL
);
