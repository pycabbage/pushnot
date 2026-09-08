ALTER TABLE `notification` ADD `endpoint` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_notification` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text NOT NULL,
	`body` text,
	`endpoint` text,
	`success` integer DEFAULT false NOT NULL,
	`failure_reason` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_notification`(`id`, `title`, `body`, `success`, `failure_reason`, `created_at`) SELECT `id`, `title`, `body`, `success`, `failure_reason`, `created_at` FROM `notification`;--> statement-breakpoint
DROP TABLE `notification`;--> statement-breakpoint
ALTER TABLE `__new_notification` RENAME TO `notification`;--> statement-breakpoint
PRAGMA foreign_keys=ON;