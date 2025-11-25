CREATE TABLE `sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`last_success_at` integer,
	`last_error_at` integer,
	`error_message` text
);
