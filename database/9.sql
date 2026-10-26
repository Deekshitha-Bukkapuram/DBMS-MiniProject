
USE college_medical_db;

INSERT INTO medicines
    (medicine_name, category, stock_quantity, price, expiry_date)
VALUES
    ('Paracetamol 500 mg', 'Analgesic / Antipyretic', 100, 2.00, '2027-12-31'),
    ('Cetirizine 10 mg', 'Antihistamine', 50, 3.00, '2027-10-31'),
    ('ORS Sachet', 'Oral Rehydration', 80, 20.00, '2027-08-31'),
    ('Antacid Tablets', 'Antacid', 60, 4.00, '2027-11-30'),
    ('Vitamin C Tablets', 'Vitamin Supplement', 75, 3.50, '2027-09-30'),
    ('Calcium Tablets', 'Mineral Supplement', 40, 5.00, '2027-12-31'),
    ('Cough Lozenges', 'Throat Relief', 45, 2.50, '2027-07-31'),
    ('Antiseptic Solution 100 ml', 'Antiseptic', 25, 45.00, '2027-10-31'),
    ('Zinc Tablets', 'Mineral Supplement', 50, 4.00, '2027-11-30'),
    ('Disposable Bandage', 'First Aid', 100, 5.00, '2028-12-31');

SELECT * FROM medicines;
