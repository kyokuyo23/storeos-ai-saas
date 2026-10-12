CREATE TABLE `businessSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessName` varchar(160) NOT NULL,
	`storeLocation` varchar(200) NOT NULL,
	`currency` varchar(12) NOT NULL,
	`timezone` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businessSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`unit` varchar(40) NOT NULL,
	`costPerUnit` decimal(14,2) NOT NULL,
	`minimumStock` decimal(14,2) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ingredients_id` PRIMARY KEY(`id`),
	CONSTRAINT `ingredients_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`sku` varchar(80),
	`description` text,
	`sellingPrice` decimal(14,2) NOT NULL,
	`costPrice` decimal(14,2) NOT NULL,
	`unit` varchar(40) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `recipeItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipeId` int NOT NULL,
	`ingredientId` int NOT NULL,
	`quantity` decimal(14,3) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recipeItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recipes_id` PRIMARY KEY(`id`),
	CONSTRAINT `recipes_productId_unique` UNIQUE(`productId`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipeItems` ADD CONSTRAINT `recipeItems_recipeId_recipes_id_fk` FOREIGN KEY (`recipeId`) REFERENCES `recipes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipeItems` ADD CONSTRAINT `recipeItems_ingredientId_ingredients_id_fk` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipes` ADD CONSTRAINT `recipes_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`categoryId`);--> statement-breakpoint
CREATE INDEX `recipe_items_recipe_idx` ON `recipeItems` (`recipeId`);--> statement-breakpoint
CREATE INDEX `recipe_items_ingredient_idx` ON `recipeItems` (`ingredientId`);