-- Direct table updates for existing database
-- Run these commands in your MySQL database

-- Add columns to idp_headers
ALTER TABLE idp_headers ADD COLUMN manager_id INT DEFAULT NULL;
ALTER TABLE idp_headers ADD COLUMN am_id INT DEFAULT NULL;
ALTER TABLE idp_headers ADD COLUMN am_remarks TEXT NULL AFTER manager_remarks;

-- Add columns to idp_extra_tables
ALTER TABLE idp_extra_tables ADD COLUMN expected_results TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER score;
ALTER TABLE idp_extra_tables ADD COLUMN sharing_method VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER expected_results;
ALTER TABLE idp_extra_tables ADD COLUMN application_method VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER sharing_method;

-- Add datetime column to idp_areas_of_exposure
ALTER TABLE idp_areas_of_exposure ADD COLUMN datetime DATETIME DEFAULT NULL AFTER status;

-- Add manager assignment columns to users
ALTER TABLE users ADD COLUMN manager_id INT DEFAULT NULL COMMENT 'Assigned manager for this employee';
ALTER TABLE users ADD COLUMN am_id INT DEFAULT NULL COMMENT 'Assigned assistant manager for this employee';

-- Add foreign key constraints for users
ALTER TABLE users ADD CONSTRAINT fk_users_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE users ADD CONSTRAINT fk_users_am FOREIGN KEY (am_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for performance
ALTER TABLE users ADD INDEX idx_users_manager (manager_id);
ALTER TABLE users ADD INDEX idx_users_am (am_id);

-- Update notification modules
UPDATE notifications SET module = 'CL' WHERE module = 'Competency Leveling' OR module IS NULL;