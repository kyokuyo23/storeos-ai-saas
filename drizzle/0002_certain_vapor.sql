CREATE TABLE `stockMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ingredientId` int NOT NULL,
	`type` enum('purchase','adjustment','waste','opname') NOT NULL,
	`quantityDelta` decimal(14,3) NOT NULL,
	`balanceAfter` decimal(14,3) NOT NULL,
	`note` text,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stockMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ingredients` ADD `currentStock` decimal(14,3) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stockMovements` ADD CONSTRAINT `stockMovements_ingredientId_ingredients_id_fk` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `stock_movements_ingredient_occurred_idx` ON `stockMovements` (`ingredientId`,`occurredAt`);