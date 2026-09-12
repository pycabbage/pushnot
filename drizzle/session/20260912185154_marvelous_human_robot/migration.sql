CREATE TABLE `subscriber` (
	`endpoint` text PRIMARY KEY,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text NOT NULL,
	`body` text,
	`endpoint` text,
	`success` integer DEFAULT false NOT NULL,
	`failure_reason` text,
	`created_at` integer NOT NULL
);
