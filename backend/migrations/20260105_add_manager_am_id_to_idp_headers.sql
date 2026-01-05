-- Add manager_id and am_id columns to idp_headers for approval routing
ALTER TABLE idp_headers
ADD COLUMN manager_id INT DEFAULT NULL,
ADD COLUMN am_id INT DEFAULT NULL;

-- (Optional) Add foreign key constraints if users table exists
-- ALTER TABLE idp_headers ADD CONSTRAINT fk_manager_id FOREIGN KEY (manager_id) REFERENCES users(id);
-- ALTER TABLE idp_headers ADD CONSTRAINT fk_am_id FOREIGN KEY (am_id) REFERENCES users(id);
