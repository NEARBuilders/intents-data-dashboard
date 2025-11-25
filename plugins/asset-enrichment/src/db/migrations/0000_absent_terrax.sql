CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`blockchain` text NOT NULL,
	`namespace` text NOT NULL,
	`reference` text NOT NULL,
	`symbol` text NOT NULL,
	`name` text,
	`decimals` integer NOT NULL,
	`icon_url` text,
	`chain_id` integer,
	`source` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `blockchain_reference_idx` ON `assets` (`blockchain`,`reference`);--> statement-breakpoint
CREATE INDEX `symbol_idx` ON `assets` (`symbol`);--> statement-breakpoint
CREATE INDEX `blockchain_idx` ON `assets` (`blockchain`);--> statement-breakpoint
CREATE TABLE `coingecko_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `coingecko_symbol_idx` ON `coingecko_ids` (`symbol`);