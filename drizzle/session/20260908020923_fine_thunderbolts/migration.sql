ALTER TABLE `notification` ADD `title` text NOT NULL;--> statement-breakpoint
ALTER TABLE `notification` ADD `body` text;--> statement-breakpoint
ALTER TABLE `notification` ADD `created_at` integer NOT NULL;