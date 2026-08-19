CREATE TABLE `exchangeItemIngredients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`exchangeItemId` int NOT NULL,
	`ingredientId` int NOT NULL,
	`unitQuantity` decimal(14,3) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchangeItemIngredients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exchangeItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`exchangeId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` decimal(14,2) NOT NULL,
	`lineTotal` decimal(14,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchangeItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exchanges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`saleItemId` int NOT NULL,
	`returnedQuantity` int NOT NULL,
	`replacementTotal` decimal(14,2) NOT NULL,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchanges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `stockMovements` MODIFY COLUMN `type` enum('purchase','adjustment','waste','opname','sale','void','refund','partial_refund','exchange_return','exchange_sale') NOT NULL;--> statement-breakpoint
ALTER TABLE `stockMovements` ADD `exchangeId` int;--> statement-breakpoint
ALTER TABLE `exchangeItemIngredients` ADD CONSTRAINT `exchangeItemIngredients_exchangeItemId_exchangeItems_id_fk` FOREIGN KEY (`exchangeItemId`) REFERENCES `exchangeItems`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exchangeItemIngredients` ADD CONSTRAINT `exchangeItemIngredients_ingredientId_ingredients_id_fk` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exchangeItems` ADD CONSTRAINT `exchangeItems_exchangeId_exchanges_id_fk` FOREIGN KEY (`exchangeId`) REFERENCES `exchanges`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exchangeItems` ADD CONSTRAINT `exchangeItems_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exchanges` ADD CONSTRAINT `exchanges_saleId_sales_id_fk` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exchanges` ADD CONSTRAINT `exchanges_saleItemId_saleItems_id_fk` FOREIGN KEY (`saleItemId`) REFERENCES `saleItems`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `exchange_item_ingredients_item_idx` ON `exchangeItemIngredients` (`exchangeItemId`);--> statement-breakpoint
CREATE INDEX `exchange_item_ingredients_ingredient_idx` ON `exchangeItemIngredients` (`ingredientId`);--> statement-breakpoint
CREATE INDEX `exchange_items_exchange_idx` ON `exchangeItems` (`exchangeId`);--> statement-breakpoint
CREATE INDEX `exchange_items_product_idx` ON `exchangeItems` (`productId`);--> statement-breakpoint
CREATE INDEX `exchanges_sale_idx` ON `exchanges` (`saleId`);--> statement-breakpoint
CREATE INDEX `exchanges_sale_item_idx` ON `exchanges` (`saleItemId`);--> statement-breakpoint
ALTER TABLE `stockMovements` ADD CONSTRAINT `stockMovements_exchangeId_exchanges_id_fk` FOREIGN KEY (`exchangeId`) REFERENCES `exchanges`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `stock_movements_exchange_idx` ON `stockMovements` (`exchangeId`);