CREATE TABLE `governanceAuditVerificationReceiptIndex` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`receiptId` varchar(160) NOT NULL,
	`receiptFormat` varchar(8) NOT NULL,
	`receiptSha256` varchar(64) NOT NULL,
	`receiptByteSize` int NOT NULL,
	`verificationStatus` varchar(24) NOT NULL,
	`verificationAt` timestamp NOT NULL,
	`issuedByOpenId` varchar(64) NOT NULL,
	`exportId` varchar(128) NOT NULL,
	`exportFormat` varchar(8) NOT NULL,
	`exportGeneratedAt` timestamp NOT NULL,
	`exportScope` varchar(512) NOT NULL,
	`exportByteSize` int NOT NULL,
	`exportSha256` varchar(64) NOT NULL,
	`exportRecordCount` int NOT NULL,
	`qrReferenceId` varchar(40) NOT NULL,
	`qrIssuedAt` timestamp NOT NULL,
	`qrExpiresAt` timestamp NOT NULL,
	`policyEventId` varchar(48),
	`policyPreviousValidityMinutes` int,
	`policyValidityMinutes` int NOT NULL,
	`policyDifferenceMinutes` int NOT NULL,
	`policyChange` varchar(16) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `governanceAuditVerificationReceiptIndex_id` PRIMARY KEY(`id`),
	CONSTRAINT `governance_audit_receipt_index_owner_sha_unique` UNIQUE(`ownerOpenId`,`receiptSha256`)
);
--> statement-breakpoint
CREATE INDEX `governance_audit_receipt_index_owner_verified_idx` ON `governanceAuditVerificationReceiptIndex` (`ownerOpenId`,`verificationAt`);--> statement-breakpoint
CREATE INDEX `governance_audit_receipt_index_owner_qr_idx` ON `governanceAuditVerificationReceiptIndex` (`ownerOpenId`,`qrReferenceId`);--> statement-breakpoint
CREATE INDEX `governance_audit_receipt_index_owner_policy_event_idx` ON `governanceAuditVerificationReceiptIndex` (`ownerOpenId`,`policyEventId`);