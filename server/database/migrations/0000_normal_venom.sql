CREATE TABLE `gists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`github_id` text NOT NULL,
	`html_url` text NOT NULL,
	`filename` text NOT NULL,
	`description` text DEFAULT '',
	`raw_url` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gists_github_id_unique` ON `gists` (`github_id`);--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gist_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`started_at` text,
	`finished_at` text,
	`error_log` text,
	`output_log` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`triggered_by` text NOT NULL,
	`png_files` text DEFAULT '[]',
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`gist_id`) REFERENCES `gists`(`id`) ON UPDATE no action ON DELETE no action
);
