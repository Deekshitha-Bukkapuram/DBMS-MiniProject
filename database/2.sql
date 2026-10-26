
USE college_medical_db;

CREATE TABLE IF NOT EXISTS user_accounts (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) UNIQUE,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'doctor', 'nurse') NOT NULL,
    student_id INT NULL,
    staff_id INT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_user_staff
        FOREIGN KEY (staff_id)
        REFERENCES medical_staff(staff_id)
        ON DELETE SET NULL
);
