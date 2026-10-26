
CREATE DATABASE IF NOT EXISTS college_medical_db;
USE college_medical_db;

-- Drop tables in foreign-key dependency order.
DROP TABLE IF EXISTS prescription_items;
DROP TABLE IF EXISTS consultations;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS user_accounts;
DROP TABLE IF EXISTS medical_staff;
DROP TABLE IF EXISTS medicines;
DROP TABLE IF EXISTS students;

-- 1. Students
CREATE TABLE students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    roll_no VARCHAR(20) NOT NULL UNIQUE,
    student_name VARCHAR(100) NOT NULL,
    department VARCHAR(80) NOT NULL,
    year_of_study INT NOT NULL CHECK (year_of_study BETWEEN 1 AND 6),
    phone VARCHAR(15),
    email VARCHAR(100) UNIQUE
);

-- 2. Medical staff: manually assigned text IDs
CREATE TABLE medical_staff (
    staff_id VARCHAR(10) PRIMARY KEY,
    staff_name VARCHAR(100) NOT NULL,
    designation VARCHAR(60) NOT NULL,
    specialization VARCHAR(100),
    phone VARCHAR(15) UNIQUE
);

-- 3. Medicines
CREATE TABLE medicines (
    medicine_id INT AUTO_INCREMENT PRIMARY KEY,
    medicine_name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(60),
    stock_quantity INT NOT NULL DEFAULT 0
        CHECK (stock_quantity >= 0),
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00
        CHECK (price >= 0),
    expiry_date DATE
);

-- 4. Appointments
CREATE TABLE appointments (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    staff_id VARCHAR(10) NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    reason VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Scheduled'
        CHECK (status IN ('Scheduled', 'Completed', 'Cancelled')),
    FOREIGN KEY (student_id)
        REFERENCES students(student_id),
    FOREIGN KEY (staff_id)
        REFERENCES medical_staff(staff_id)
);

-- 5. Consultations
CREATE TABLE consultations (
    consultation_id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL UNIQUE,
    diagnosis TEXT NOT NULL,
    treatment TEXT,
    consultation_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    FOREIGN KEY (appointment_id)
        REFERENCES appointments(appointment_id)
);

-- 6. Prescription items
CREATE TABLE prescription_items (
    prescription_item_id INT AUTO_INCREMENT PRIMARY KEY,
    consultation_id INT NOT NULL,
    medicine_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    dosage VARCHAR(100),
    FOREIGN KEY (consultation_id)
        REFERENCES consultations(consultation_id),
    FOREIGN KEY (medicine_id)
        REFERENCES medicines(medicine_id)
);

-- 7. User accounts
CREATE TABLE user_accounts (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) UNIQUE,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'doctor', 'nurse') NOT NULL,
    student_id INT NULL,
    staff_id VARCHAR(10) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id)
        REFERENCES students(student_id) ON DELETE SET NULL,
    FOREIGN KEY (staff_id)
        REFERENCES medical_staff(staff_id) ON DELETE SET NULL
);

-- Insert 10 medical staff members
INSERT INTO medical_staff
    (staff_id, staff_name, designation, specialization, phone)
VALUES
    ('DOC001', 'Keerthana Reddy', 'Doctor', 'General Medicine', '9000010101'),
    ('DOC002', 'Ravi Kumar', 'Doctor', 'Cardiology', '9000010102'),
    ('NUR001', 'Priya Sharma', 'Nurse', 'General Nursing', '9000010103'),
    ('DOC003', 'Anil Varma', 'Doctor', 'Dermatology', '9000010104'),
    ('NUR002', 'Suma Devi', 'Nurse', 'Pediatrics', '9000010105'),
    ('DOC004', 'Venkatesh Rao', 'Doctor', 'Orthopedics', '9000010106'),
    ('NUR003', 'Lakshmi Nair', 'Nurse', 'Emergency Care', '9000010107'),
    ('DOC005', 'Mohammed Imran', 'Doctor', 'ENT', '9000010108'),
    ('NUR004', 'Divya Reddy', 'Nurse', 'General Nursing', '9000010109'),
    ('DOC006', 'Suresh Babu', 'Doctor', 'Ophthalmology', '9000010110');

-- Verify all tables
SHOW TABLES;

SELECT * FROM medical_staff;
