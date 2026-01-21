-- Complete Database Update Script for FuturaV2
-- Run this script to apply all schema updates
-- Date: January 21, 2026

-- =================================================
-- 1. Add manager_id and am_id to idp_headers (Jan 5, 2026)
-- =================================================
ALTER TABLE idp_headers
ADD COLUMN IF NOT EXISTS manager_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS am_id INT DEFAULT NULL;

-- =================================================
-- 2. Add columns to idp_extra_tables (Jan 15, 2026)
-- =================================================
ALTER TABLE idp_extra_tables
ADD COLUMN IF NOT EXISTS expected_results TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER score,
ADD COLUMN IF NOT EXISTS sharing_method VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER expected_results,
ADD COLUMN IF NOT EXISTS application_method VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER sharing_method;

-- =================================================
-- 3. Add datetime to idp_areas_of_exposure (Jan 15, 2026)
-- =================================================
ALTER TABLE idp_areas_of_exposure
ADD COLUMN IF NOT EXISTS datetime DATETIME DEFAULT NULL AFTER status;

-- =================================================
-- 4. Add am_remarks to idp_headers (Jan 19, 2026)
-- =================================================
ALTER TABLE idp_headers 
ADD COLUMN IF NOT EXISTS am_remarks TEXT NULL AFTER manager_remarks;

-- =================================================
-- 5. Add manager/AM assignment to users (Jan 21, 2026)
-- =================================================
-- Add columns
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `manager_id` int DEFAULT NULL COMMENT 'Assigned manager for this employee',
ADD COLUMN IF NOT EXISTS `am_id` int DEFAULT NULL COMMENT 'Assigned assistant manager for this employee';

-- Add foreign key constraints (only if they don't exist)
SET @constraint_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_manager');

SET @sql = IF(@constraint_exists = 0, 
    'ALTER TABLE `users` ADD CONSTRAINT `fk_users_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE', 
    'SELECT "Constraint fk_users_manager already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_am');

SET @sql = IF(@constraint_exists = 0, 
    'ALTER TABLE `users` ADD CONSTRAINT `fk_users_am` FOREIGN KEY (`am_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE', 
    'SELECT "Constraint fk_users_am already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add indexes (only if they don't exist)
SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_manager');

SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE `users` ADD INDEX `idx_users_manager` (`manager_id`)', 
    'SELECT "Index idx_users_manager already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_am');

SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE `users` ADD INDEX `idx_users_am` (`am_id`)', 
    'SELECT "Index idx_users_am already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =================================================
-- 6. Update notification modules (Data update)
-- =================================================
UPDATE notifications SET module = 'CL' WHERE module = 'Competency Leveling' OR module IS NULL;

-- =================================================
-- Verification Queries
-- =================================================
SELECT 'Database update completed successfully!' as Status;

-- Show updated table structures
SELECT 'idp_headers columns:' as Info;
DESCRIBE idp_headers;

SELECT 'idp_extra_tables columns:' as Info;
DESCRIBE idp_extra_tables;

SELECT 'idp_areas_of_exposure columns:' as Info;
DESCRIBE idp_areas_of_exposure;

SELECT 'users columns:' as Info;
DESCRIBE users;

-- Show notification module counts
SELECT 'Notification modules:' as Info;
SELECT module, COUNT(*) as count FROM notifications GROUP BY module;