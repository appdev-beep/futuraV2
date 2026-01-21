-- Add am_id column to cl_headers table for AM assignment tracking
ALTER TABLE cl_headers 
ADD COLUMN am_id INT DEFAULT NULL AFTER manager_id;

-- Add foreign key constraint
ALTER TABLE cl_headers 
ADD CONSTRAINT fk_cl_headers_am 
FOREIGN KEY (am_id) REFERENCES users(id) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for performance
ALTER TABLE cl_headers 
ADD INDEX idx_cl_headers_am (am_id);