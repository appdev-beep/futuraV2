-- Migration: add review_period and next_review_date to idp_headers
ALTER TABLE idp_headers
  ADD COLUMN review_period VARCHAR(255) NULL,
  ADD COLUMN next_review_date DATE NULL;
