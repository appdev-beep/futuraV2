-- Update existing notifications to use 'CL' instead of 'Competency Leveling'
UPDATE notifications SET module = 'CL' WHERE module = 'Competency Leveling' OR module IS NULL;

-- Verify the update
SELECT module, COUNT(*) as count FROM notifications GROUP BY module;
