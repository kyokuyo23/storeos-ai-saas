ALTER TABLE `monthlyReportArtifacts` ADD `pdfKey` varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifacts` ADD `pdfUrl` varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifacts` ADD `pdfSha256` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `monthlyReportArtifacts` ADD `pdfBytes` int NOT NULL;