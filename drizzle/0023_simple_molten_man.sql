CREATE TABLE `retentionSummaryExports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`exportId` varchar(128) NOT NULL,
	`format` varchar(8) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`byteSize` int NOT NULL,
	`evaluatedAt` timestamp NOT NULL,
	`scopeLabel` varchar(64) NOT NULL,
	`datePreset` varchar(32),
	`rangeStartDate` varchar(10) NOT NULL,
	`rangeEndDate` varchar(10) NOT NULL,
	`snapshotJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `retentionSummaryExports_id` PRIMARY KEY(`id`),
	CONSTRAINT `retention_summary_exports_owner_export_unique` UNIQUE(`ownerOpenId`,`exportId`)
);
--> statement-breakpoint
CREATE INDEX `retention_summary_exports_owner_evaluated_idx` ON `retentionSummaryExports` (`ownerOpenId`,`evaluatedAt`);