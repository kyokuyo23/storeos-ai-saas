CREATE TABLE `exchangeSettlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`exchangeId` int NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`paymentMethod` enum('cash','card') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchangeSettlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `exchangeSettlements_exchangeId_unique` UNIQUE(`exchangeId`)
);
--> statement-breakpoint
ALTER TABLE `exchangeSettlements` ADD CONSTRAINT `exchangeSettlements_exchangeId_exchanges_id_fk` FOREIGN KEY (`exchangeId`) REFERENCES `exchanges`(`id`) ON DELETE restrict ON UPDATE no action;