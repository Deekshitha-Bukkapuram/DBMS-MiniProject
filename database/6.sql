
USE college_medical_db;

-- Add symptoms and doctor's notes to consultations
ALTER TABLE consultations
ADD COLUMN symptoms TEXT NULL,
ADD COLUMN doctor_notes TEXT NULL;

-- Add frequency, duration, and instructions to prescriptions
ALTER TABLE prescription_items
ADD COLUMN frequency VARCHAR(100) NULL,
ADD COLUMN duration VARCHAR(100) NULL,
ADD COLUMN instructions TEXT NULL;
