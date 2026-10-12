CREATE TABLE `governanceAuditQrExpiryPolicyHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`eventId` varchar(48) NOT NULL,
	`previousValidityMinutes` int NOT NULL,
	`newValidityMinutes` int NOT NULL,
	`resultingValidityMinutes` int NOT NULL,
	`changedAt` timestamp NOT NULL,
	`actorOpenId` varchar(64) NOT NULL,
	CONSTRAINT `governanceAuditQrExpiryPolicyHistory_id` PRIMARY KEY(`id`),
	CONSTRAINT `governance_audit_qr_expiry_history_event_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE INDEX `governance_audit_qr_expiry_history_owner_changed_idx` ON `governanceAuditQrExpiryPolicyHistory` (`ownerOpenId`,`changedAt`);