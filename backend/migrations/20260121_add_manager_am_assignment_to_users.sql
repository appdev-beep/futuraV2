-- Migration: Add manager_id and am_id to users table for individual assignment
-- Created: 2026-01-21
-- Purpose: Enable specific manager and assistant manager assignment to employees

ALTER TABLE `users` 
ADD COLUMN `manager_id` int DEFAULT NULL COMMENT 'Assigned manager for this employee',
ADD COLUMN `am_id` int DEFAULT NULL COMMENT 'Assigned assistant manager for this employee';

-- Add foreign key constraints
ALTER TABLE `users` 
ADD CONSTRAINT `fk_users_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT `fk_users_am` FOREIGN KEY (`am_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for better performance
ALTER TABLE `users` 
ADD INDEX `idx_users_manager` (`manager_id`),
ADD INDEX `idx_users_am` (`am_id`);