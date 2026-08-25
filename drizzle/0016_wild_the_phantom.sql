ALTER TABLE `monthlyReportArtifacts` DROP INDEX `monthly_report_artifacts_period_unique`;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifacts` ADD `ownerOpenId` varchar(64) DEFAULT 'legacy-single-store' NOT NULL;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifacts` ADD `retiredAt` timestamp;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifacts` ADD CONSTRAINT `monthly_report_artifacts_period_owner_unique` UNIQUE(`ownerOpenId`,`year`,`month`);--> statement-breakpoint
CREATE INDEX `monthly_report_artifacts_owner_retired_idx` ON `monthlyReportArtifacts` (`ownerOpenId`,`retiredAt`);