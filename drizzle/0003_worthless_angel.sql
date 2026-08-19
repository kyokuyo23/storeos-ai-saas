CREATE TABLE `saleItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` decimal(14,2) NOT NULL,
	`lineTotal` decimal(14,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saleItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptNumber` varchar(64) NOT NULL,
	`status` enum('completed') NOT NULL DEFAULT 'completed',
	`total` decimal(14,2) NOT NULL,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_receiptNumber_unique` UNIQUE(`receiptNumber`)
);
--> statement-breakpoint
ALTER TABLE `stockMovements` MODIFY COLUMN `type` enum('purchase','adjustment','waste','opname','sale') NOT NULL;--> statement-breakpoint
ALTER TABLE `stockMovements` ADD `saleId` int;--> statement-breakpoint
ALTER TABLE `saleItems` ADD CONSTRAINT `saleItems_saleId_sales_id_fk` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleItems` ADD CONSTRAINT `saleItems_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `saleItems` (`saleId`);--> statement-breakpoint
CREATE INDEX `sale_items_product_idx` ON `saleItems` (`productId`);--> statement-breakpoint
ALTER TABLE `stockMovements` ADD CONSTRAINT `stockMovements_saleId_sales_id_fk` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `stock_movements_sale_idx` ON `stockMovements` (`saleId`);