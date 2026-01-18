-- Add am_remarks column to idp_headers table for AM return/approve remarks
ALTER TABLE idp_headers ADD COLUMN am_remarks TEXT NULL AFTER manager_remarks;
