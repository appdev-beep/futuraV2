-- Add missing datetime column to idp_areas_of_exposure
ALTER TABLE idp_areas_of_exposure
ADD COLUMN datetime DATETIME DEFAULT NULL AFTER status;
