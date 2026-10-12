CREATE TABLE `storedObjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`contentType` varchar(128) NOT NULL,
	`byteSize` int NOT NULL,
	`data` longblob NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `storedObjects_id` PRIMARY KEY(`id`),
	CONSTRAINT `stored_objects_key_unique` UNIQUE(`storageKey`)
);
