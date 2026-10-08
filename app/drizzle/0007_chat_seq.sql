ALTER TABLE `chat_messages` ADD `seq` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `chat_messages_thread_seq` ON `chat_messages` (`thread_id`,`seq`);--> statement-breakpoint
CREATE INDEX `chat_messages_sender_created` ON `chat_messages` (`sender_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `chat_threads` ADD `buyer_read_seq` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_threads` ADD `seller_read_seq` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `chat_threads_buyer` ON `chat_threads` (`buyer_id`);--> statement-breakpoint
CREATE INDEX `chat_threads_seller` ON `chat_threads` (`seller_id`);--> statement-breakpoint
UPDATE `chat_messages` SET `seq` = rowid;--> statement-breakpoint
UPDATE `chat_threads` SET `buyer_read_seq` = coalesce((SELECT max(m.seq) FROM `chat_messages` m WHERE m.thread_id = chat_threads.id AND (m.sender_id = chat_threads.buyer_id OR (chat_threads.buyer_read_at IS NOT NULL AND m.created_at <= chat_threads.buyer_read_at))), 0);--> statement-breakpoint
UPDATE `chat_threads` SET `seller_read_seq` = coalesce((SELECT max(m.seq) FROM `chat_messages` m WHERE m.thread_id = chat_threads.id AND (m.sender_id = chat_threads.seller_id OR (chat_threads.seller_read_at IS NOT NULL AND m.created_at <= chat_threads.seller_read_at))), 0);
