CREATE TABLE `conversation_tasks` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`conversationId` bigint unsigned NOT NULL,
	`title` varchar(255) NOT NULL,
	`status` enum('todo','in_progress','done') NOT NULL DEFAULT 'todo',
	`position` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hidden_messages` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`messageId` bigint unsigned NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `hidden_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `conversation_participants` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `conversation_participants` ADD `isPinned` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `conversation_participants` ADD `sortOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `isGroup` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `pinnedFiles` json;--> statement-breakpoint
ALTER TABLE `listings` ADD `batchData` json;--> statement-breakpoint
CREATE INDEX `ctask_conv_idx` ON `conversation_tasks` (`conversationId`);--> statement-breakpoint
CREATE INDEX `hm_user_msg_idx` ON `hidden_messages` (`userId`,`messageId`);