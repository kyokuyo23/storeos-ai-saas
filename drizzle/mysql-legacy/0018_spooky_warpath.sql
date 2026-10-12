ALTER TABLE `monthlyReportArtifactLifecycleEvents` ADD `actor` varchar(80) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifactLifecycleEvents` ADD `source` varchar(80) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifactLifecycleEvents` ADD `artifactFormat` varchar(24) DEFAULT 'bundle' NOT NULL;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifactLifecycleEvents` ADD `integritySnapshot` text;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifactLifecycleEvents` ADD `eventKey` varchar(191);--> statement-breakpoint
ALTER TABLE `monthlyReportArtifactLifecycleEvents` ADD CONSTRAINT `monthly_report_artifact_lifecycle_event_key_unique` UNIQUE(`artifactId`,`eventKey`);