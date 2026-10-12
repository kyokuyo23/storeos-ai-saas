CREATE TABLE `partialRefunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`saleItemId` int NOT NULL,
	`quantity` int NOT NULL,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partialRefunds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saleItemIngredients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleItemId` int NOT NULL,
	`ingredientId` int NOT NULL,
	`unitQuantity` decimal(14,3) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saleItemIngredients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sales` MODIFY COLUMN `status` enum('completed','partially_refunded','voided','refunded') NOT NULL DEFAULT 'completed';--> statement-breakpoint
ALTER TABLE `stockMovements` MODIFY COLUMN `type` enum('purchase','adjustment','waste','opname','sale','void','refund','partial_refund') NOT NULL;--> statement-breakpoint
ALTER TABLE `stockMovements` ADD `saleItemId` int;--> statement-breakpoint
ALTER TABLE `stockMovements` ADD `partialRefundId` int;--> statement-breakpoint
ALTER TABLE `partialRefunds` ADD CONSTRAINT `partialRefunds_saleId_sales_id_fk` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partialRefunds` ADD CONSTRAINT `partialRefunds_saleItemId_saleItems_id_fk` FOREIGN KEY (`saleItemId`) REFERENCES `saleItems`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleItemIngredients` ADD CONSTRAINT `saleItemIngredients_saleItemId_saleItems_id_fk` FOREIGN KEY (`saleItemId`) REFERENCES `saleItems`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleItemIngredients` ADD CONSTRAINT `saleItemIngredients_ingredientId_ingredients_id_fk` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `partial_refunds_sale_idx` ON `partialRefunds` (`saleId`);--> statement-breakpoint
CREATE INDEX `partial_refunds_item_idx` ON `partialRefunds` (`saleItemId`);--> statement-breakpoint
CREATE INDEX `sale_item_ingredients_item_idx` ON `saleItemIngredients` (`saleItemId`);--> statement-breakpoint
CREATE INDEX `sale_item_ingredients_ingredient_idx` ON `saleItemIngredients` (`ingredientId`);--> statement-breakpoint
ALTER TABLE `stockMovements` ADD CONSTRAINT `stockMovements_saleItemId_saleItems_id_fk` FOREIGN KEY (`saleItemId`) REFERENCES `saleItems`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stockMovements` ADD CONSTRAINT `stockMovements_partialRefundId_partialRefunds_id_fk` FOREIGN KEY (`partialRefundId`) REFERENCES `partialRefunds`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `stock_movements_sale_item_idx` ON `stockMovements` (`saleItemId`);