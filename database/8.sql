USE college_medical_db;

ALTER TABLE prescription_items
  ADD COLUMN frequency VARCHAR(100) NULL,
  ADD COLUMN duration VARCHAR(100) NULL,
  ADD COLUMN instructions TEXT NULL;