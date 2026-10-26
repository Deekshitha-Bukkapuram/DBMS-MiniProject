
const form = document.getElementById("appointmentForm");
const tableBody = document.getElementById("appointmentsTable");
const searchInput = document.getElementById("appointmentSearch");
const notice = document.getElementById("notice");
const studentSelect = document.getElementById("studentSelect");
const staffSelect = document.getElementById("staffSelect");
const showFormButton = document.getElementById("showAppointmentForm");
const cancelFormButton = document.getElementById("cancelAppointmentForm");

let appointments = [];

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

function showNotice(message, isError = false) {
  notice.textContent = message;
  notice.classList.remove("hidden");
  notice.classList.toggle("error", isError);
  notice.classList.toggle("success", !isError);
}

function hideNotice() {
  notice.textContent = "";
  notice.classList.add("hidden");
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function normalizeStatus(status) {
  if (String(status).toLowerCase() === "booked") {
    return "Scheduled";
  }

  return status || "Scheduled";
}

function formatDate(dateValue) {
  if (!dateValue) return "—";

  const date = String(dateValue).slice(0, 10);
  const parts = date.split("-");

  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : date;
}

function formatTime(timeValue) {
  return String(timeValue || "").slice(0, 5);
}

async function loadStudents() {
  const rows = await api("/api/students");

  studentSelect.innerHTML =
    '<option value="">Select student</option>' +
    rows.map(student => `
      <option value="${safe(student.student_id)}">
        ${safe(student.student_name)} (${safe(student.roll_no)})
      </option>
    `).join("");
}

async function loadStaff() {
  const rows = await api("/api/staff");

  staffSelect.innerHTML =
    '<option value="">Select medical staff</option>' +
    rows.map(staff => `
      <option value="${safe(staff.staff_id)}">
        ${safe(staff.staff_name)} — ${safe(staff.designation)}
      </option>
    `).join("");
}

async function loadAppointments() {
  tableBody.innerHTML =
    '<tr><td colspan="6" class="empty-cell">Loading appointments…</td></tr>';

  try {
    appointments = await api("/api/appointments");
    renderAppointments();
  } catch (error) {
    tableBody.innerHTML =
      '<tr><td colspan="6" class="empty-cell">Unable to load appointments.</td></tr>';

    showNotice(error.message, true);
  }
}

function renderAppointments() {
  const term = searchInput.value.trim().toLowerCase();

  const filtered = appointments.filter(appointment => {
    const searchable = [
      appointment.student_name,
      appointment.roll_no,
      appointment.staff_name,
      appointment.reason,
      normalizeStatus(appointment.status),
      appointment.appointment_date,
      appointment.appointment_time
    ].join(" ").toLowerCase();

    return searchable.includes(term);
  });

  if (!filtered.length) {
    tableBody.innerHTML =
      '<tr><td colspan="6" class="empty-cell">No matching appointments found.</td></tr>';

    return;
  }

  tableBody.innerHTML = filtered.map(appointment => {
    const status = normalizeStatus(appointment.status);
    const isFinal = ["Completed", "Cancelled"].includes(status);

    return `
      <tr>
        <td>
          <strong>${safe(appointment.student_name)}</strong>
          <small>${safe(appointment.roll_no)}</small>
        </td>

        <td>${safe(appointment.staff_name || "Not assigned")}</td>

        <td>
          ${safe(formatDate(appointment.appointment_date))}
          <small>${safe(formatTime(appointment.appointment_time))}</small>
        </td>

        <td>${safe(appointment.reason)}</td>

        <td>
          <span class="status-badge">${safe(status)}</span>
        </td>

        <td>
          <div class="table-actions">
            <button
              type="button"
              class="button secondary edit-appointment"
              data-id="${safe(appointment.appointment_id)}">
              Edit
            </button>

            <button
              type="button"
              class="button secondary cancel-appointment"
              data-id="${safe(appointment.appointment_id)}"
              ${isFinal ? "disabled" : ""}>
              Cancel
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openForm(appointment = null) {
  hideNotice();
  form.reset();
  form.classList.remove("hidden");

  form.elements.appointment_id.value =
    appointment ? appointment.appointment_id : "";

  if (appointment) {
    form.elements.student_id.value =
      String(appointment.student_id ?? "");

    form.elements.staff_id.value =
      String(appointment.staff_id ?? "");

    form.elements.appointment_date.value =
      String(appointment.appointment_date || "").slice(0, 10);

    form.elements.appointment_time.value =
      formatTime(appointment.appointment_time);

    form.elements.reason.value =
      appointment.reason || "";

    form.elements.status.value =
      normalizeStatus(appointment.status);

    showFormButton.textContent = "Edit appointment";
  } else {
    form.elements.status.value = "Scheduled";
    showFormButton.textContent = "＋ Book appointment";
  }

  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeForm() {
  form.reset();
  form.classList.add("hidden");
  form.elements.appointment_id.value = "";
  showFormButton.textContent = "＋ Book appointment";
}

showFormButton.addEventListener("click", () => {
  if (form.classList.contains("hidden")) {
    openForm();
  } else {
    closeForm();
  }
});

cancelFormButton.addEventListener("click", closeForm);

form.addEventListener("submit", async event => {
  event.preventDefault();
  hideNotice();

  const id = form.elements.appointment_id.value;
  const status = normalizeStatus(form.elements.status.value);

  const payload = {
    student_id: form.elements.student_id.value,
    staff_id: form.elements.staff_id.value,
    appointment_date: form.elements.appointment_date.value,
    appointment_time: form.elements.appointment_time.value,
    reason: form.elements.reason.value.trim(),
    status
  };

  try {
    const result = await api(
      id
        ? `/api/appointments/${encodeURIComponent(id)}`
        : "/api/appointments",
      {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload)
      }
    );

    closeForm();

    showNotice(
      result.message ||
      (id
        ? "Appointment updated successfully."
        : "Appointment booked successfully.")
    );

    await loadAppointments();
  } catch (error) {
    showNotice(error.message, true);
  }
});

tableBody.addEventListener("click", async event => {
  const editButton = event.target.closest(".edit-appointment");
  const cancelButton = event.target.closest(".cancel-appointment");

  if (editButton) {
    const appointment = appointments.find(
      item =>
        String(item.appointment_id) === editButton.dataset.id
    );

    if (appointment) {
      openForm(appointment);
    } else {
      showNotice("Appointment record not found.", true);
    }

    return;
  }

  if (cancelButton) {
    if (cancelButton.disabled) return;

    const id = cancelButton.dataset.id;

    if (!confirm("Are you sure you want to cancel this appointment?")) {
      return;
    }

    hideNotice();

    try {
      const result = await api(
        `/api/appointments/${encodeURIComponent(id)}/cancel`,
        { method: "PATCH" }
      );

      showNotice(result.message || "Appointment cancelled.");

      await loadAppointments();
    } catch (error) {
      showNotice(error.message, true);
    }
  }
});

document
  .getElementById("searchAppointments")
  .addEventListener("click", renderAppointments);

searchInput.addEventListener("input", renderAppointments);

async function initializeAppointments() {
  try {
    await Promise.all([
      loadStudents(),
      loadStaff()
    ]);

    await loadAppointments();
  } catch (error) {
    showNotice(error.message, true);
  }
}

initializeAppointments();
