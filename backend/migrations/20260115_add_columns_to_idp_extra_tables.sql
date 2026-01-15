-- Add missing columns to idp_extra_tables
ALTER TABLE idp_extra_tables
ADD COLUMN expected_results TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER score,
ADD COLUMN sharing_method VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER expected_results,
ADD COLUMN application_method VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER sharing_method;
