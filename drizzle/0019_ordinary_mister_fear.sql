CREATE TABLE `governanceAuditQrExpiryPolicies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`validityMinutes` int NOT NULL DEFAULT 30,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `governanceAuditQrExpiryPolicies_id` PRIMARY KEY(`id`),
	CONSTRAINT `governance_audit_qr_expiry_owner_unique` UNIQUE(`ownerOpenId`)
);
