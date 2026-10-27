const express = require("express");
const db = require("./db");

const router = express.Router();

function asyncRoute(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        message: "Please log in to continue."
      });
    }

    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to access this resource."
      });
    }

    next();
  };
}

function isValidExpiryDate(value) {
  if (typeof value !== "string") return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

router.get(
  "/medicines",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const [rows] = await db.query(`
      SELECT medicine_id, medicine_name, category,
             stock_quantity, price, expiry_date
      FROM medicines
      ORDER BY medicine_name
    `);

    res.json(rows);
  })
);

router.post(
  "/medicines",
  requireRole("doctor"),
  asyncRoute(async (req, res) => {
    const medicineName = String(req.body.medicine_name || "").trim();
    const category = String(req.body.category || "").trim();
    const stockQuantity = req.body.stock_quantity;
    const price = req.body.price;
    const expiryDate = req.body.expiry_date;

    if (!medicineName || !category) {
      return res.status(400).json({
        message: "Medicine name and category are required."
      });
    }

    if (
      stockQuantity === undefined ||
      stockQuantity === "" ||
      !Number.isInteger(Number(stockQuantity)) ||
      Number(stockQuantity) < 0
    ) {
      return res.status(400).json({
        message: "Enter a valid non-negative stock quantity."
      });
    }

    if (
      price === undefined ||
      price === "" ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0
    ) {
      return res.status(400).json({
        message: "Enter a valid non-negative price."
      });
    }

    if (!isValidExpiryDate(expiryDate)) {
      return res.status(400).json({
        message: "Enter a valid expiry date in YYYY-MM-DD format."
      });
    }

    const [result] = await db.query(
      `INSERT INTO medicines
       (medicine_name, category, stock_quantity, price, expiry_date)
       VALUES (?, ?, ?, ?, ?)`,
      [
        medicineName,
        category,
        Number(stockQuantity),
        Number(price),
        expiryDate
      ]
    );

    res.status(201).json({
      message: "Medicine added successfully.",
      medicine_id: result.insertId
    });
  })
);

router.put(
  "/medicines/:id",
  requireRole("doctor"),
  asyncRoute(async (req, res) => {
    const medicineId = Number(req.params.id);
    const medicineName = String(req.body.medicine_name || "").trim();
    const category = String(req.body.category || "").trim();
    const stockQuantity = req.body.stock_quantity;
    const price = req.body.price;
    const expiryDate = req.body.expiry_date;

    if (!Number.isInteger(medicineId) || medicineId <= 0) {
      return res.status(400).json({
        message: "Invalid medicine ID."
      });
    }

    if (!medicineName || !category) {
      return res.status(400).json({
        message: "Medicine name and category are required."
      });
    }

    if (
      stockQuantity === undefined ||
      stockQuantity === "" ||
      !Number.isInteger(Number(stockQuantity)) ||
      Number(stockQuantity) < 0
    ) {
      return res.status(400).json({
        message: "Enter a valid non-negative stock quantity."
      });
    }

    if (
      price === undefined ||
      price === "" ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0
    ) {
      return res.status(400).json({
        message: "Enter a valid non-negative price."
      });
    }

    if (!isValidExpiryDate(expiryDate)) {
      return res.status(400).json({
        message: "Enter a valid expiry date in YYYY-MM-DD format."
      });
    }

    const [result] = await db.query(
      `UPDATE medicines
       SET medicine_name = ?,
           category = ?,
           stock_quantity = ?,
           price = ?,
           expiry_date = ?
       WHERE medicine_id = ?`,
      [
        medicineName,
        category,
        Number(stockQuantity),
        Number(price),
        expiryDate,
        medicineId
      ]
    );

    if (result.affectedRows === 0) {
      const [existing] = await db.query(
        "SELECT medicine_id FROM medicines WHERE medicine_id = ?",
        [medicineId]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          message: "Medicine not found."
        });
      }
    }

    res.json({
      message: "Medicine updated successfully."
    });
  })
);

router.delete(
  "/medicines/:id",
  requireRole("doctor"),
  asyncRoute(async (req, res) => {
    const medicineId = Number(req.params.id);

    if (!Number.isInteger(medicineId) || medicineId <= 0) {
      return res.status(400).json({
        message: "Invalid medicine ID."
      });
    }

    const [medicines] = await db.query(
      "SELECT medicine_id FROM medicines WHERE medicine_id = ?",
      [medicineId]
    );

    if (medicines.length === 0) {
      return res.status(404).json({
        message: "Medicine not found."
      });
    }

    const [prescriptions] = await db.query(
      `SELECT prescription_item_id
       FROM prescription_items
       WHERE medicine_id = ?
       LIMIT 1`,
      [medicineId]
    );

    if (prescriptions.length > 0) {
      return res.status(409).json({
        message:
          "This medicine is linked to a prescription and cannot be deleted. Update its stock instead."
      });
    }

    await db.query(
      "DELETE FROM medicines WHERE medicine_id = ?",
      [medicineId]
    );

    res.json({
      message: "Medicine deleted successfully."
    });
  })
);

router.get(
  "/consultations",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const [rows] = await db.query(`
      SELECT c.*, a.student_id, s.student_name,
             a.staff_id, ms.staff_name
      FROM consultations c
      JOIN appointments a ON a.appointment_id = c.appointment_id
      JOIN students s ON s.student_id = a.student_id
      LEFT JOIN medical_staff ms ON ms.staff_id = a.staff_id
      ORDER BY c.consultation_date DESC, c.consultation_id DESC
    `);

    res.json(rows);
  })
);

router.post(
  "/consultations",
  requireRole("doctor"),
  asyncRoute(async (req, res) => {
    const appointmentId = Number(req.body.appointment_id);
    const symptoms = String(req.body.symptoms || "").trim();
    const diagnosis = String(req.body.diagnosis || "").trim();
    const treatment = String(req.body.treatment || "").trim();
    const doctorNotes = String(req.body.doctor_notes || "").trim();

    if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
      return res.status(400).json({
        message: "Valid appointment_id is required."
      });
    }

    if (!diagnosis) {
      return res.status(400).json({
        message: "Diagnosis is required."
      });
    }

    const [appointments] = await db.query(
      "SELECT appointment_id FROM appointments WHERE appointment_id = ?",
      [appointmentId]
    );

    if (!appointments.length) {
      return res.status(404).json({
        message: "Appointment not found."
      });
    }

    const [existing] = await db.query(
      "SELECT consultation_id FROM consultations WHERE appointment_id = ?",
      [appointmentId]
    );

    if (existing.length) {
      return res.status(409).json({
        message: "A consultation already exists for this appointment."
      });
    }

    const [result] = await db.query(
      `INSERT INTO consultations
       (appointment_id, symptoms, diagnosis, treatment, doctor_notes)
       VALUES (?, ?, ?, ?, ?)`,
      [
        appointmentId,
        symptoms || null,
        diagnosis,
        treatment || null,
        doctorNotes || null
      ]
    );

    res.status(201).json({
      message: "Consultation saved successfully.",
      consultation_id: result.insertId
    });
  })
);

router.get(
  "/prescriptions",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const [rows] = await db.query(`
      SELECT pi.prescription_item_id, pi.consultation_id,
             pi.medicine_id, m.medicine_name,
             pi.quantity, pi.dosage, pi.frequency,
             pi.duration, pi.instructions,
             COALESCE(SUM(md.quantity_dispensed), 0) AS quantity_dispensed,
             pi.quantity -
               COALESCE(SUM(md.quantity_dispensed), 0) AS quantity_remaining
      FROM prescription_items pi
      JOIN medicines m ON m.medicine_id = pi.medicine_id
      LEFT JOIN medicine_dispensing md
        ON md.prescription_item_id = pi.prescription_item_id
      GROUP BY pi.prescription_item_id, pi.consultation_id,
               pi.medicine_id, m.medicine_name, pi.quantity,
               pi.dosage, pi.frequency, pi.duration, pi.instructions
      ORDER BY pi.prescription_item_id DESC
    `);

    res.json(rows);
  })
);

router.post(
  "/prescriptions",
  requireRole("doctor"),
  asyncRoute(async (req, res) => {
    const consultationId = Number(req.body.consultation_id);
    const medicineId = Number(req.body.medicine_id);
    const quantity = Number(req.body.quantity);
    const dosage = String(req.body.dosage || "").trim();
    const frequency = String(req.body.frequency || "").trim();
    const duration = String(req.body.duration || "").trim();
    const instructions = String(req.body.instructions || "").trim();

    if (
      !Number.isInteger(consultationId) ||
      consultationId <= 0 ||
      !Number.isInteger(medicineId) ||
      medicineId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return res.status(400).json({
        message:
          "Valid consultation, medicine, and positive quantity are required."
      });
    }

    const [consultations] = await db.query(
      "SELECT consultation_id FROM consultations WHERE consultation_id = ?",
      [consultationId]
    );

    if (!consultations.length) {
      return res.status(404).json({
        message: "Consultation not found."
      });
    }

    const [medicines] = await db.query(
      "SELECT medicine_id FROM medicines WHERE medicine_id = ?",
      [medicineId]
    );

    if (!medicines.length) {
      return res.status(404).json({
        message: "Medicine not found."
      });
    }

    const [result] = await db.query(
      `INSERT INTO prescription_items
       (consultation_id, medicine_id, quantity, dosage,
        frequency, duration, instructions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        consultationId,
        medicineId,
        quantity,
        dosage || null,
        frequency || null,
        duration || null,
        instructions || null
      ]
    );

    res.status(201).json({
      message: "Prescription created successfully.",
      prescription_item_id: result.insertId
    });
  })
);

router.post(
  "/dispensing",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const prescriptionItemId = Number(req.body.prescription_item_id);
    const quantityDispensed = Number(req.body.quantity_dispensed);
    const staffId = req.session.user.staffId;

    if (
      !Number.isInteger(prescriptionItemId) ||
      prescriptionItemId <= 0 ||
      !Number.isInteger(quantityDispensed) ||
      quantityDispensed <= 0
    ) {
      return res.status(400).json({
        message:
          "Enter a valid prescription item and positive dispensing quantity."
      });
    }

    if (!staffId) {
      return res.status(400).json({
        message: "Your staff account does not contain a staff ID."
      });
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [items] = await connection.query(
        `SELECT pi.prescription_item_id, pi.quantity, pi.medicine_id,
                m.stock_quantity
         FROM prescription_items pi
         JOIN medicines m ON m.medicine_id = pi.medicine_id
         WHERE pi.prescription_item_id = ?
         FOR UPDATE`,
        [prescriptionItemId]
      );

      if (!items.length) {
        await connection.rollback();
        return res.status(404).json({
          message: "Prescription item not found."
        });
      }

      const item = items[0];

      const [dispensedRows] = await connection.query(
        `SELECT COALESCE(SUM(quantity_dispensed), 0) AS total_dispensed
         FROM medicine_dispensing
         WHERE prescription_item_id = ?`,
        [prescriptionItemId]
      );

      const alreadyDispensed = Number(dispensedRows[0].total_dispensed);
      const remaining = Number(item.quantity) - alreadyDispensed;

      if (quantityDispensed > remaining) {
        await connection.rollback();
        return res.status(400).json({
          message: `Only ${Math.max(remaining, 0)} unit(s) remain on this prescription.`
        });
      }

      if (quantityDispensed > Number(item.stock_quantity)) {
        await connection.rollback();
        return res.status(400).json({
          message: "Insufficient medicine stock."
        });
      }

      const [staffRows] = await connection.query(
        "SELECT staff_id FROM medical_staff WHERE staff_id = ?",
        [staffId]
      );

      if (!staffRows.length) {
        await connection.rollback();
        return res.status(400).json({
          message: "The logged-in staff ID was not found in medical_staff."
        });
      }

      await connection.query(
        `UPDATE medicines
         SET stock_quantity = stock_quantity - ?
         WHERE medicine_id = ?`,
        [quantityDispensed, item.medicine_id]
      );

      const [result] = await connection.query(
        `INSERT INTO medicine_dispensing
         (prescription_item_id, quantity_dispensed, dispensed_by)
         VALUES (?, ?, ?)`,
        [prescriptionItemId, quantityDispensed, staffId]
      );

      await connection.commit();

      res.status(201).json({
        message: "Medicine dispensing recorded and stock updated.",
        dispensing_id: result.insertId,
        quantity_dispensed: quantityDispensed,
        quantity_remaining: remaining - quantityDispensed
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

router.get(
  "/student/medical-history",
  requireRole("student"),
  asyncRoute(async (req, res) => {
    const studentId = req.session.user.studentId;

    if (!studentId) {
      return res.status(400).json({
        message: "Student ID is missing from your login session."
      });
    }

    const [rows] = await db.query(
      `SELECT c.consultation_id, c.consultation_date,
              c.symptoms, c.diagnosis, c.treatment, c.doctor_notes,
              ms.staff_name AS doctor_name,
              pi.prescription_item_id, pi.quantity,
              pi.dosage, pi.frequency, pi.duration, pi.instructions,
              m.medicine_name,
              COALESCE(disp.total_dispensed, 0) AS quantity_dispensed
       FROM appointments a
       JOIN consultations c ON c.appointment_id = a.appointment_id
       LEFT JOIN medical_staff ms ON ms.staff_id = a.staff_id
       LEFT JOIN prescription_items pi
         ON pi.consultation_id = c.consultation_id
       LEFT JOIN medicines m ON m.medicine_id = pi.medicine_id
       LEFT JOIN (
         SELECT prescription_item_id,
                SUM(quantity_dispensed) AS total_dispensed
         FROM medicine_dispensing
         GROUP BY prescription_item_id
       ) disp ON disp.prescription_item_id = pi.prescription_item_id
       WHERE a.student_id = ?
       ORDER BY c.consultation_date DESC, c.consultation_id DESC`,
      [studentId]
    );

    res.json(rows);
  })
);

router.get(
  "/reports/appointments-by-staff",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const [rows] = await db.query(`
      SELECT ms.staff_id, ms.staff_name,
             COUNT(a.appointment_id) AS total_appointments
      FROM medical_staff ms
      LEFT JOIN appointments a ON a.staff_id = ms.staff_id
      GROUP BY ms.staff_id, ms.staff_name
      ORDER BY total_appointments DESC, ms.staff_name
    `);

    res.json(rows);
  })
);

router.get(
  "/reports/medicine-stock",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const [rows] = await db.query(`
      SELECT medicine_id, medicine_name, category,
             stock_quantity, price, expiry_date
      FROM medicines
      ORDER BY stock_quantity ASC, medicine_name ASC
    `);

    res.json(rows);
  })
);

module.exports = router;
