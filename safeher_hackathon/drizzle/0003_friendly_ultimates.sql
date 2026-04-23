CREATE TABLE `alertSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`latitude` decimal(10,8) NOT NULL,
	`longitude` decimal(10,8) NOT NULL,
	`radiusKm` decimal(5,2) NOT NULL DEFAULT '5.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alertSubscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `incidents` ADD `trackingPin` varchar(10);