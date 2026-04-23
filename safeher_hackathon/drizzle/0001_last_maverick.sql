CREATE TABLE `incidents` (
`id` int AUTO_INCREMENT NOT NULL,
`latitude` decimal(10,8) NOT NULL,
`longitude` decimal(11,8) NOT NULL,
`incidentType` enum('harassment','assault','stalking','theft','unsafe_area','other') NOT NULL,
`severity` enum('low','medium','high','critical') NOT NULL,
`description` text NOT NULL,
`mediaUrls` json,
`reportedAt` timestamp NOT NULL,
`submittedAt` timestamp NOT NULL DEFAULT (now()),
`ipHash` varchar(64) NOT NULL,
`status` enum('pending','verified','resolved','dismissed') NOT NULL DEFAULT 'pending',
`adminNotes` text,
`llmClassification` json,
CONSTRAINT `incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_attachments` (
`id` int AUTO_INCREMENT NOT NULL,
`incidentId` int NOT NULL,
`s3Key` varchar(255) NOT NULL,
`s3Url` varchar(512) NOT NULL,
`mimeType` varchar(50) NOT NULL,
`fileSize` int NOT NULL,
`uploadedAt` timestamp NOT NULL DEFAULT (now()),
CONSTRAINT `media_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rate_limit_log` (
`id` int AUTO_INCREMENT NOT NULL,
`ipHash` varchar(64) NOT NULL,
`attemptedAt` timestamp NOT NULL DEFAULT (now()),
`endpoint` varchar(100) NOT NULL,
CONSTRAINT `rate_limit_log_id` PRIMARY KEY(`id`)
);
