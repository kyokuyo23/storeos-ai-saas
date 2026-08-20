CREATE TABLE `stockOpnameFollowUps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditReference` varchar(80) NOT NULL,
	`status` enum('needs_follow_up','in_progress','resolved') NOT NULL DEFAULT 'needs_follow_up',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stockOpnameFollowUps_id` PRIMARY KEY(`id`),
	CONSTRAINT `stockOpnameFollowUps_auditReference_unique` UNIQUE(`auditReference`)
);
