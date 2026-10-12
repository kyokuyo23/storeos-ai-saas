CREATE TABLE `governanceAuditQrRevocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`referenceId` varchar(40) NOT NULL,
	`exportId` varchar(128) NOT NULL,
	`receiptId` varchar(160) NOT NULL,
	`revokedAt` timestamp NOT NULL,
	`actorOpenId` varchar(64) NOT NULL,
	`reason` text,
	`previousStatus` varchar(24) NOT NULL,
	`resultingStatus` varchar(24) NOT NULL DEFAULT 'revoked',
	CONSTRAINT `governanceAuditQrRevocations_id` PRIMARY KEY(`id`),
	CONSTRAINT `governance_audit_qr_revocation_owner_reference_unique` UNIQUE(`ownerOpenId`,`referenceId`)
);
--> statement-breakpoint
CREATE INDEX `governance_audit_qr_revocation_owner_revoked_idx` ON `governanceAuditQrRevocations` (`ownerOpenId`,`revokedAt`);