
USE college_medical_db;

CREATE TABLE IF NOT EXISTS medicine_dispensing (
    dispensing_id INT AUTO_INCREMENT PRIMARY KEY,
    prescription_item_id INT NOT NULL,
    quantity_dispensed INT NOT NULL,
    dispensed_by VARCHAR(10) NOT NULL,
    dispensed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_dispensed_quantity
        CHECK (quantity_dispensed > 0),

    CONSTRAINT fk_dispensing_prescription
        FOREIGN KEY (prescription_item_id)
        REFERENCES prescription_items(prescription_item_id),

    CONSTRAINT fk_dispensing_staff
        FOREIGN KEY (dispensed_by)
        REFERENCES medical_staff(staff_id)
);
