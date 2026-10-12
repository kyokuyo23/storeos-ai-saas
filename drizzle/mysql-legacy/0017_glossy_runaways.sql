CREATE TABLE `monthlyReportArtifactLifecycleEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artifactId` int NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`lifecycleStatus` enum('generated','verified','retained','eligible_for_archive','archived') NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`reason` varchar(160),
	CONSTRAINT `monthlyReportArtifactLifecycleEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `monthlyReportArtifacts` ADD `lifecycleStatus` enum('generated','verified','retained','eligible_for_archive','archived') DEFAULT 'retained' NOT NULL;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifacts` ADD `verifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifacts` ADD `retainedAt` timestamp;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifacts` ADD `archiveEligibleAt` timestamp;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifacts` ADD `archivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifacts` ADD `archiveReason` varchar(160);--> statement-breakpoint
ALTER TABLE `monthlyReportArtifactLifecycleEvents` ADD CONSTRAINT `monthly_report_lifecycle_artifact_fk` FOREIGN KEY (`artifactId`) REFERENCES `monthlyReportArtifacts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `monthly_report_artifact_lifecycle_artifact_idx` ON `monthlyReportArtifactLifecycleEvents` (`artifactId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `monthly_report_artifact_lifecycle_owner_idx` ON `monthlyReportArtifactLifecycleEvents` (`ownerOpenId`,`lifecycleStatus`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `monthly_report_artifacts_owner_lifecycle_idx` ON `monthlyReportArtifacts` (`ownerOpenId`,`lifecycleStatus`,`retiredAt`);--> statement-breakpoint
CREATE INDEX `monthly_report_artifacts_owner_archive_due_idx` ON `monthlyReportArtifacts` (`ownerOpenId`,`archiveEligibleAt`);
