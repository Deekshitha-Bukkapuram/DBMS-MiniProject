const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
require("dotenv").config();

const db = require("./db");
const medicalRoutes = require("./medical-routes");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const frontendPath = path.join(__dirname, "..", "frontend");

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing from backend/.env");
}

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  createDatabaseTable: true,
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 8 * 60 * 60 * 1000
});

app.use(
  session({
    name: "college_medical_sid",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000
    }
  })
);

app.use("/api", medicalRoutes);

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      message: "Please log in to continue."
    });
  }

  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
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

function asyncRoute(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

const publicHtmlPages = new Set([
  "/",
  "/index.html",
  "/login.html",
  "/student-login.html",
  "/staff-login.html"
]);

const studentHtmlPages = new Set([
  "/student-dashboard.html"
]);

const staffHtmlPages = new Set([
  "/dashboard.html",
  "/students.html",
  "/staff.html",
  "/appointments.html",
  "/consultations.html",
  "/prescriptions.html",
  "/medicines.html",
  "/reports.html",
  "/staff-dashboard.html"
]);

app.use((req, res, next) => {
  if (
    req.method !== "GET" ||
    !req.path.toLowerCase().endsWith(".html")
  ) {
    return next();
  }

  const page = req.path.toLowerCase();

  if (publicHtmlPages.has(page)) {
    return next();
  }

  if (studentHtmlPages.has(page)) {
    if (!req.session.user) {
      return res.redirect("/student-login.html");
    }

    if (req.session.user.role !== "student") {
      return res.redirect("/login.html");
    }

    return next();
  }

  if (staffHtmlPages.has(page)) {
    if (!req.session.user) {
      return res.redirect("/staff-login.html");
    }

    if (!["doctor", "nurse"].includes(req.session.user.role)) {
      return res.redirect("/login.html");
    }

    return next();
  }

  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  next();
});

function redirectToUserHome(req, res) {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  if (req.session.user.role === "student") {
    return res.redirect("/student-dashboard.html");
  }

  if (["doctor", "nurse"].includes(req.session.user.role)) {
    return res.redirect("/staff-dashboard.html");
  }

  return res.redirect("/login.html");
}

app.get("/", redirectToUserHome);
app.get("/index.html", redirectToUserHome);

app.use(express.static(frontendPath, {
  index: false
}));

app.post(
  "/api/auth/student-login",
  asyncRoute(async (req, res) => {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const password = String(req.body.password || "");

    if (!/^[0-9]+@iiitt\.ac\.in$/.test(email) || !password) {
      return res.status(400).json({
        success: false,
        message: "Enter your official college email and password."
      });
    }

    const [users] = await db.execute(
      `SELECT user_id, email, password_hash, role, student_id, is_active
       FROM user_accounts
       WHERE LOWER(email) = ?
         AND role = 'student'
       LIMIT 1`,
      [email]
    );

    if (users.length !== 1 || !users[0].is_active) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const account = users[0];

    if (
      typeof account.password_hash !== "string" ||
      !(await bcrypt.compare(password, account.password_hash))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    if (!account.student_id) {
      return res.status(403).json({
        success: false,
        message: "Your account is not linked to a student record."
      });
    }

    const [students] = await db.execute(
      "SELECT student_id, email FROM students WHERE student_id = ?",
      [account.student_id]
    );

    if (
      students.length !== 1 ||
      String(students[0].email || "").trim().toLowerCase() !== email
    ) {
      return res.status(403).json({
        success: false,
        message: "Your account does not match an authorized student record."
      });
    }

    req.session.regenerate(error => {
      if (error) {
        console.error("Student session error:", error.message);

        return res.status(500).json({
          success: false,
          message: "Unable to start your session."
        });
      }

      req.session.user = {
        userId: account.user_id,
        email: account.email,
        role: "student",
        studentId: account.student_id
      };

      req.session.save(saveError => {
        if (saveError) {
          console.error("Student session save error:", saveError.message);

          return res.status(500).json({
            success: false,
            message: "Unable to save your session."
          });
        }

        return res.json({
          success: true,
          role: "student",
          redirect: "/student-dashboard.html"
        });
      });
    });
  })
);

app.post(
  "/api/auth/staff-login",
  asyncRoute(async (req, res) => {
    const username = String(
      req.body.username ||
      req.body.login ||
      req.body.identifier ||
      ""
    ).trim();

    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const identifier = username || email;
    const password = String(req.body.password || "");

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Enter your assigned staff username/email and password."
      });
    }

    const [users] = await db.execute(
      `SELECT user_id, email, username, password_hash,
              role, staff_id, is_active
       FROM user_accounts
       WHERE (
         LOWER(username) = LOWER(?)
         OR LOWER(email) = LOWER(?)
       )
       AND role IN ('doctor', 'nurse')
       LIMIT 2`,
      [identifier, identifier]
    );

    if (users.length !== 1) {
      return res.status(401).json({
        success: false,
        message: "Invalid username/email or password."
      });
    }

    const account = users[0];

    if (!account.is_active) {
      return res.status(403).json({
        success: false,
        message: "This staff account is disabled."
      });
    }

    if (
      typeof account.password_hash !== "string" ||
      !account.password_hash
    ) {
      console.error(
        "Missing password hash for staff user:",
        account.user_id
      );

      return res.status(500).json({
        success: false,
        message: "The account password data is invalid."
      });
    }

    let passwordMatches;

    try {
      passwordMatches = await bcrypt.compare(
        password,
        account.password_hash
      );
    } catch (error) {
      console.error("Password verification error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to verify the password."
      });
    }

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid username/email or password."
      });
    }

    if (!account.staff_id) {
      return res.status(403).json({
        success: false,
        message: "Your account is not linked to a medical staff record."
      });
    }

    const [staff] = await db.execute(
      "SELECT staff_id FROM medical_staff WHERE staff_id = ?",
      [account.staff_id]
    );

    if (staff.length !== 1) {
      return res.status(403).json({
        success: false,
        message: "The linked medical staff record does not exist."
      });
    }

    req.session.regenerate(error => {
      if (error) {
        console.error("Staff session error:", error.message);

        return res.status(500).json({
          success: false,
          message: "Unable to start your session."
        });
      }

      req.session.user = {
        userId: account.user_id,
        email: account.email,
        username: account.username,
        role: account.role,
        staffId: account.staff_id
      };

      req.session.save(saveError => {
        if (saveError) {
          console.error("Staff session save error:", saveError.message);

          return res.status(500).json({
            success: false,
            message: "Unable to save your session."
          });
        }

        return res.json({
          success: true,
          role: account.role,
          redirect: "/staff-dashboard.html"
        });
      });
    });
  })
);

app.get("/api/auth/me", requireLogin, (req, res) => {
  res.json({ user: req.session.user });
});

app.post("/api/auth/logout", requireLogin, (req, res) => {
  req.session.destroy(error => {
    if (error) {
      console.error("Logout error:", error.message);

      return res.status(500).json({
        message: "Unable to log out."
      });
    }

    res.clearCookie("college_medical_sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    res.json({
      success: true,
      message: "Logged out successfully."
    });
  });
});

app.get(
  "/api/student/profile",
  requireRole("student"),
  asyncRoute(async (req, res) => {
    const [rows] = await db.execute(
      `SELECT student_id, roll_no, student_name, department,
              year_of_study, phone, email
       FROM students
       WHERE student_id = ?`,
      [req.session.user.studentId]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Student record not found."
      });
    }

    res.json(rows[0]);
  })
);

app.get(
  "/api/student/medical-staff",
  requireRole("student"),
  asyncRoute(async (req, res) => {
    const [rows] = await db.execute(
      `SELECT staff_id, staff_name, designation, specialization
       FROM medical_staff
       WHERE LOWER(designation) IN ('doctor', 'nurse')
       ORDER BY designation, staff_name`
    );

    res.json(rows);
  })
);

app.post(
  "/api/student/appointments",
  requireRole("student"),
  asyncRoute(async (req, res) => {
    const staffId = String(req.body.staff_id || "").trim();
    const appointmentDate = String(
      req.body.appointment_date || ""
    ).trim();
    const appointmentTime = String(
      req.body.appointment_time || ""
    ).trim();
    const reason = String(req.body.reason || "").trim();

    if (!staffId || !appointmentDate || !appointmentTime || !reason) {
      return res.status(400).json({
        message: "Please complete all appointment fields."
      });
    }

    if (staffId.length > 10) {
      return res.status(400).json({
        message: "Invalid medical staff ID."
      });
    }

    if (reason.length > 255) {
      return res.status(400).json({
        message: "The reason must be 255 characters or fewer."
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      return res.status(400).json({
        message: "Please select a valid appointment date."
      });
    }

    const parsedDate = new Date(`${appointmentDate}T00:00:00Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== appointmentDate
    ) {
      return res.status(400).json({
        message: "The appointment date is invalid."
      });
    }

    const now = new Date();
    const today =
      `${now.getFullYear()}-` +
      `${String(now.getMonth() + 1).padStart(2, "0")}-` +
      `${String(now.getDate()).padStart(2, "0")}`;

    if (appointmentDate < today) {
      return res.status(400).json({
        message: "You cannot book an appointment in the past."
      });
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime)) {
      return res.status(400).json({
        message: "Please select a valid appointment time."
      });
    }

    const [staffRows] = await db.execute(
      `SELECT staff_id, staff_name, designation
       FROM medical_staff
       WHERE staff_id = ?
         AND LOWER(designation) IN ('doctor', 'nurse')
       LIMIT 1`,
      [staffId]
    );

    if (staffRows.length === 0) {
      return res.status(400).json({
        message: "The selected doctor or nurse was not found."
      });
    }

    const timeForDatabase = `${appointmentTime}:00`;

    const [existing] = await db.execute(
      `SELECT appointment_id
       FROM appointments
       WHERE staff_id = ?
         AND appointment_date = ?
         AND appointment_time = ?
         AND status = 'Scheduled'
       LIMIT 1`,
      [staffId, appointmentDate, timeForDatabase]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message:
          "That time slot is already booked. Please choose another time."
      });
    }

    const studentId = req.session.user.studentId;

    if (!studentId) {
      return res.status(403).json({
        message: "Your account is not linked to a student record."
      });
    }

    const [result] = await db.execute(
      `INSERT INTO appointments
       (
         student_id,
         staff_id,
         appointment_date,
         appointment_time,
         reason,
         status
       )
       VALUES (?, ?, ?, ?, ?, 'Scheduled')`,
      [
        studentId,
        staffId,
        appointmentDate,
        timeForDatabase,
        reason
      ]
    );

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully.",
      appointment_id: result.insertId
    });
  })
);

app.get(
  "/api/student/appointments",
  requireRole("student"),
  asyncRoute(async (req, res) => {
    const [rows] = await db.execute(
      `SELECT a.*, m.staff_name
       FROM appointments a
       LEFT JOIN medical_staff m ON a.staff_id = m.staff_id
       WHERE a.student_id = ?
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [req.session.user.studentId]
    );

    res.json(rows);
  })
);

app.get(
  "/api/student/consultations",
  requireRole("student"),
  asyncRoute(async (req, res) => {
    const [rows] = await db.execute(
      `SELECT c.*, a.appointment_date, a.appointment_time,
              m.staff_name
       FROM consultations c
       JOIN appointments a ON c.appointment_id = a.appointment_id
       LEFT JOIN medical_staff m ON a.staff_id = m.staff_id
       WHERE a.student_id = ?
       ORDER BY c.consultation_date DESC`,
      [req.session.user.studentId]
    );

    res.json(rows);
  })
);

app.get(
  "/api/dashboard",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const [students] = await db.query(
      "SELECT COUNT(*) AS total FROM students"
    );

    const [staff] = await db.query(
      "SELECT COUNT(*) AS total FROM medical_staff"
    );

    const [appointments] = await db.query(
      "SELECT COUNT(*) AS total FROM appointments"
    );

    const [medicines] = await db.query(
      "SELECT COUNT(*) AS total FROM medicines"
    );

    res.json({
      students: students[0].total,
      staff: staff[0].total,
      appointments: appointments[0].total,
      medicines: medicines[0].total
    });
  })
);

app.get(
  "/api/students",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const search = `%${req.query.q || ""}%`;

    const [rows] = await db.execute(
      `SELECT student_id, roll_no, student_name, department,
              year_of_study, phone, email
       FROM students
       WHERE roll_no LIKE ?
          OR student_name LIKE ?
          OR department LIKE ?
          OR email LIKE ?
       ORDER BY student_id DESC`,
      [search, search, search, search]
    );

    res.json(rows);
  })
);

app.post(
  "/api/students",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const {
      roll_no,
      student_name,
      department,
      year_of_study,
      phone,
      email
    } = req.body;

    if (
      !roll_no ||
      !student_name ||
      !department ||
      year_of_study === undefined ||
      year_of_study === ""
    ) {
      return res.status(400).json({
        message: "Roll number, name, department and year are required."
      });
    }

    const year = Number(year_of_study);

    if (!Number.isInteger(year) || year < 1 || year > 6) {
      return res.status(400).json({
        message: "Year of study must be between 1 and 6."
      });
    }

    const [result] = await db.execute(
      `INSERT INTO students
       (roll_no, student_name, department, year_of_study, phone, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        roll_no.trim(),
        student_name.trim(),
        department.trim(),
        year,
        phone || null,
        email || null
      ]
    );

    res.status(201).json({
      success: true,
      student_id: result.insertId,
      message: "Student added successfully."
    });
  })
);

app.get(
  "/api/staff",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const search = `%${req.query.q || ""}%`;

    const [rows] = await db.execute(
      `SELECT staff_id, staff_name, designation, specialization, phone
       FROM medical_staff
       WHERE staff_name LIKE ?
          OR designation LIKE ?
          OR specialization LIKE ?
          OR phone LIKE ?
       ORDER BY staff_id DESC`,
      [search, search, search, search]
    );

    res.json(rows);
  })
);

app.post(
  "/api/staff",
  requireRole("doctor"),
  asyncRoute(async (req, res) => {
    const {
      staff_name,
      role,
      designation,
      specialization,
      phone
    } = req.body;

    const staffDesignation = designation || role;

    if (!staff_name || !staffDesignation) {
      return res.status(400).json({
        message: "Staff name and designation are required."
      });
    }

    const [result] = await db.execute(
      `INSERT INTO medical_staff
       (staff_name, designation, specialization, phone)
       VALUES (?, ?, ?, ?)`,
      [
        staff_name.trim(),
        staffDesignation.trim(),
        specialization || null,
        phone || null
      ]
    );

    res.status(201).json({
      success: true,
      staff_id: result.insertId,
      message: "Staff member added successfully."
    });
  })
);

app.put(
  "/api/staff/:id",
  requireRole("doctor"),
  asyncRoute(async (req, res) => {
    const {
      staff_name,
      role,
      designation,
      specialization,
      phone
    } = req.body;

    const staffDesignation = designation || role;

    if (!staff_name || !staffDesignation) {
      return res.status(400).json({
        message: "Staff name and designation are required."
      });
    }

    const [result] = await db.execute(
      `UPDATE medical_staff
       SET staff_name = ?, designation = ?, specialization = ?, phone = ?
       WHERE staff_id = ?`,
      [
        staff_name.trim(),
        staffDesignation.trim(),
        specialization || null,
        phone || null,
        req.params.id
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Staff member not found."
      });
    }

    res.json({
      success: true,
      message: "Staff member updated successfully."
    });
  })
);

app.delete(
  "/api/staff/:id",
  requireRole("doctor"),
  asyncRoute(async (req, res) => {
    const [result] = await db.execute(
      "DELETE FROM medical_staff WHERE staff_id = ?",
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Staff member not found."
      });
    }

    res.json({
      success: true,
      message: "Staff member deleted successfully."
    });
  })
);

app.get(
  "/api/appointments",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const [rows] = await db.query(`
      SELECT a.*, s.student_name, s.roll_no, m.staff_name
      FROM appointments a
      JOIN students s ON a.student_id = s.student_id
      LEFT JOIN medical_staff m ON a.staff_id = m.staff_id
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `);

    res.json(rows);
  })
);

function validateAppointmentInput(body) {
  const studentId = String(body.student_id || "").trim();
  const staffId = String(body.staff_id || "").trim();
  const appointmentDate = String(body.appointment_date || "").trim();
  const appointmentTime = String(body.appointment_time || "").trim();
  const reason = String(body.reason || "").trim();

  let status = String(body.status || "Scheduled").trim();

  if (status.toLowerCase() === "booked") {
    status = "Scheduled";
  }

  if (
    !studentId ||
    !staffId ||
    !appointmentDate ||
    !appointmentTime ||
    !reason
  ) {
    return {
      error: "Please complete all required appointment fields."
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
    return {
      error: "Enter a valid appointment date."
    };
  }

  const parsedDate = new Date(`${appointmentDate}T00:00:00Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== appointmentDate
  ) {
    return {
      error: "The appointment date is invalid."
    };
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime)) {
    return {
      error: "Enter a valid appointment time."
    };
  }

  if (staffId.length > 10 || reason.length > 255) {
    return {
      error: "Staff ID or reason exceeds the allowed length."
    };
  }

  if (!["Scheduled", "Completed", "Cancelled"].includes(status)) {
    return {
      error: "Invalid appointment status."
    };
  }

  return {
    data: {
      studentId,
      staffId,
      appointmentDate,
      appointmentTime,
      reason,
      status
    }
  };
}

app.post(
  "/api/appointments",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const validated = validateAppointmentInput(req.body);

    if (validated.error) {
      return res.status(400).json({
        message: validated.error
      });
    }

    const a = validated.data;

    const [students] = await db.execute(
      "SELECT student_id FROM students WHERE student_id = ?",
      [a.studentId]
    );

    if (!students.length) {
      return res.status(400).json({
        message: "Student not found."
      });
    }

    const [staff] = await db.execute(
      "SELECT staff_id FROM medical_staff WHERE staff_id = ?",
      [a.staffId]
    );

    if (!staff.length) {
      return res.status(400).json({
        message: "Medical staff member not found."
      });
    }

    if (a.status === "Scheduled") {
      const [conflicts] = await db.execute(
        `SELECT appointment_id
         FROM appointments
         WHERE staff_id = ?
           AND appointment_date = ?
           AND appointment_time = ?
           AND status = 'Scheduled'`,
        [
          a.staffId,
          a.appointmentDate,
          `${a.appointmentTime}:00`
        ]
      );

      if (conflicts.length) {
        return res.status(409).json({
          message:
            "That staff member already has a scheduled appointment at this time."
        });
      }
    }

    const [result] = await db.execute(
      `INSERT INTO appointments
       (student_id, staff_id, appointment_date, appointment_time, reason, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        a.studentId,
        a.staffId,
        a.appointmentDate,
        `${a.appointmentTime}:00`,
        a.reason,
        a.status
      ]
    );

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully.",
      appointment_id: result.insertId
    });
  })
);

app.put(
  "/api/appointments/:id",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid appointment ID."
      });
    }

    const validated = validateAppointmentInput(req.body);

    if (validated.error) {
      return res.status(400).json({
        message: validated.error
      });
    }

    const a = validated.data;

    const [existingAppointment] = await db.execute(
      "SELECT appointment_id FROM appointments WHERE appointment_id = ?",
      [id]
    );

    if (!existingAppointment.length) {
      return res.status(404).json({
        message: "Appointment not found."
      });
    }

    const [students] = await db.execute(
      "SELECT student_id FROM students WHERE student_id = ?",
      [a.studentId]
    );

    if (!students.length) {
      return res.status(400).json({
        message: "Student not found."
      });
    }

    const [staff] = await db.execute(
      "SELECT staff_id FROM medical_staff WHERE staff_id = ?",
      [a.staffId]
    );

    if (!staff.length) {
      return res.status(400).json({
        message: "Medical staff member not found."
      });
    }

    if (a.status === "Scheduled") {
      const [conflicts] = await db.execute(
        `SELECT appointment_id
         FROM appointments
         WHERE staff_id = ?
           AND appointment_date = ?
           AND appointment_time = ?
           AND status = 'Scheduled'
           AND appointment_id <> ?`,
        [
          a.staffId,
          a.appointmentDate,
          `${a.appointmentTime}:00`,
          id
        ]
      );

      if (conflicts.length) {
        return res.status(409).json({
          message:
            "That staff member already has a scheduled appointment at this time."
        });
      }
    }

    await db.execute(
      `UPDATE appointments
       SET student_id = ?,
           staff_id = ?,
           appointment_date = ?,
           appointment_time = ?,
           reason = ?,
           status = ?
       WHERE appointment_id = ?`,
      [
        a.studentId,
        a.staffId,
        a.appointmentDate,
        `${a.appointmentTime}:00`,
        a.reason,
        a.status,
        id
      ]
    );

    res.json({
      success: true,
      message: "Appointment updated successfully."
    });
  })
);

app.patch(
  "/api/appointments/:id/cancel",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid appointment ID."
      });
    }

    const [rows] = await db.execute(
      "SELECT appointment_id, status FROM appointments WHERE appointment_id = ?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Appointment not found."
      });
    }

    if (rows[0].status === "Completed") {
      return res.status(400).json({
        message: "A completed appointment cannot be cancelled."
      });
    }

    if (rows[0].status === "Cancelled") {
      return res.json({
        success: true,
        message: "Appointment is already cancelled."
      });
    }

    await db.execute(
      "UPDATE appointments SET status = 'Cancelled' WHERE appointment_id = ?",
      [id]
    );

    res.json({
      success: true,
      message: "Appointment cancelled successfully."
    });
  })
);

app.get(
  "/api/medicines",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const [rows] = await db.query(
      "SELECT * FROM medicines ORDER BY medicine_name"
    );

    res.json(rows);
  })
);

app.get(
  "/api/consultations",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const [rows] = await db.query(`
      SELECT c.*, a.student_id, s.student_name,
             a.staff_id, m.staff_name
      FROM consultations c
      JOIN appointments a ON c.appointment_id = a.appointment_id
      JOIN students s ON a.student_id = s.student_id
      LEFT JOIN medical_staff m ON a.staff_id = m.staff_id
      ORDER BY c.consultation_date DESC
    `);

    res.json(rows);
  })
);

app.get(
  "/api/reports/appointments-by-staff",
  requireRole("doctor", "nurse"),
  asyncRoute(async (req, res) => {
    const [rows] = await db.query(`
      SELECT ms.staff_id, ms.staff_name,
             COUNT(a.appointment_id) AS total_appointments
      FROM medical_staff ms
      LEFT JOIN appointments a ON ms.staff_id = a.staff_id
      GROUP BY ms.staff_id, ms.staff_name
      ORDER BY total_appointments DESC, ms.staff_name ASC
    `);

    res.json(rows);
  })
);

app.use((error, req, res, next) => {
  console.error("Request error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    message: "An unexpected server error occurred."
  });
});

async function startServer() {
  try {
    await db.query("SELECT 1");
    await sessionStore.onReady();
    await db.query("SELECT user_id FROM user_accounts LIMIT 0");

    app.listen(PORT, () => {
      console.log("MySQL connection successful");
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`Frontend folder: ${frontendPath}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();