DROP TABLE `subscriber`;--> statement-breakpoint
CREATE TABLE `subscriber` (
	`endpoint` text PRIMARY KEY,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL
);
