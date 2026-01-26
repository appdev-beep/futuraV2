-- Migration: add review_period_id to users
ALTER TABLE `users`
  ADD COLUMN `review_period_id` INT NULL AFTER `am_id`;

-- Add index and foreign key if review_periods table exists
ALTER TABLE `users`
  ADD INDEX `idx_users_review_period` (`review_period_id`);

-- Try to add FK (will only work if review_periods table already exists)
SET @fk_sql = CONCAT('ALTER TABLE `users` ADD CONSTRAINT `fk_users_review_period` FOREIGN KEY (`review_period_id`) REFERENCES `review_periods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE');
PREPARE stmt FROM @fk_sql;
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;
  EXECUTE stmt;
END;
DEALLOCATE PREPARE stmt;
