ALTER TABLE `sales` MODIFY COLUMN `status` enum('completed','voided','refunded') NOT NULL DEFAULT 'completed';--> statement-breakpoint
ALTER TABLE `stockMovements` MODIFY COLUMN `type` enum('purchase','adjustment','waste','opname','sale','void','refund') NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `reversedAt` timestamp;--> statement-breakpoint
ALTER TABLE `sales` ADD `reversalReason` text;