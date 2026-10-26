const form = document.getElementById("consultationForm");
const appointmentSelect = document.getElementById("consultationAppointment");
const tableBody = document.getElementById("consultationsTable");
const notice = document.getElementById("notice");
const refreshButton = document.getElementById("refreshConsultations");

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function showNotice(message, isError = false) {
  notice.textContent = message;
  notice.classList.remove("hidden");
  notice.classList.toggle("error", isError);
  notice.classList.toggle("success", !isError);
}

function formatDate(value) {
  if (!value) return "—";

  const date = String(value).slice(0, 10);
  const parts = date.split("-");

  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : date;
}

async function loadAppointments() {
  const [appointments, consultations] = await Promise.all([
    api("/api/appointments"),
    api("/api/consultations")
  ]);

  const existingIds = new Set(
    consultations.map(item => String(item.appointment_id))
  );

  const available = appointments.filter(appointment =>
    appointment.status !== "Cancelled" &&
    !existingIds.has(String(appointment.appointment_id))
  );

  appointmentSelect.innerHTML =
    '<option value="">Select appointment</option>' +
    available.map(appointment => `
      <option value="${escapeHtml(appointment.appointment_id)}">
        ${escapeHtml(appointment.student_name)}
        (${escapeHtml(appointment.roll_no)})
        — ${escapeHtml(formatDate(appointment.appointment_date))}
        — ${escapeHtml(appointment.status)}
      </option>
    `).join("");

  if (!available.length) {
    appointmentSelect.innerHTML =
      '<option value="">No eligible appointments available</option>';
  }
}

async function loadConsultations() {
  tableBody.innerHTML =
    '<tr><td colspan="5" class="empty-cell">Loading consultations…</td></tr>';

  try {
    const rows = await api("/api/consultations");

    if (!rows.length) {
      tableBody.innerHTML =
        '<tr><td colspan="5" class="empty-cell">No consultations recorded yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = rows.map(item => `
      <tr>
        <td>
          <strong>${escapeHtml(item.student_name)}</strong>
          <small>Consultation #${escapeHtml(item.consultation_id)}</small>
        </td>
        <td>${escapeHtml(item.staff_name || "Not assigned")}</td>
        <td>${escapeHtml(formatDate(item.consultation_date))}</td>
        <td>${escapeHtml(item.diagnosis)}</td>
        <td>${escapeHtml(item.treatment || "—")}</td>
      </tr>
    `).join("");
  } catch (error) {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="empty-cell">Unable to load consultations.</td></tr>';

    showNotice(error.message, true);
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const payload = {
    appointment_id: appointmentSelect.value,
    diagnosis: form.elements.diagnosis.value.trim(),
    treatment: form.elements.treatment.value.trim()
  };

  if (!payload.appointment_id || !payload.diagnosis || !payload.treatment) {
    showNotice("Complete all required fields.", true);
    return;
  }

  try {
    const result = await api("/api/consultations", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    form.reset();

    showNotice(
      `${result.message || "Consultation saved."} You can now create its prescription.`
    );

    await Promise.all([
      loadAppointments(),
      loadConsultations()
    ]);
  } catch (error) {
    showNotice(error.message, true);
  }
});

refreshButton.addEventListener("click", async () => {
  try {
    await Promise.all([
      loadAppointments(),
      loadConsultations()
    ]);
    showNotice("Consultation records refreshed.");
  } catch (error) {
    showNotice(error.message, true);
  }
});

async function initialize() {
  try {
    await Promise.all([
      loadAppointments(),
      loadConsultations()
    ]);
  } catch (error) {
    showNotice(error.message, true);
  }
}

initialize();