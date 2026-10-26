
const form = document.getElementById("prescriptionForm");
const formPanel = document.getElementById("prescriptionFormPanel");
const consultationSelect = document.getElementById("consultationSelect");
const medicineSelect = document.getElementById("medicineSelect");
const tableBody = document.getElementById("prescriptionsTable");
const searchInput = document.getElementById("prescriptionSearch");
const notice = document.getElementById("notice");

let consultations = [];
let medicines = [];
let prescriptions = [];
let currentRole = "";

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

async function loadUser() {
  const result = await api("/api/auth/me");
  const user = result.user || {};

  currentRole = user.role || "";

  document.getElementById("staffName").textContent =
    user.username || user.email || "Medical Staff";

  document.getElementById("staffRole").textContent =
    currentRole === "doctor" ? "Doctor" : "Nurse";

  // Only doctors can create prescriptions.
  if (currentRole !== "doctor") {
    formPanel.classList.add("hidden");
  }
}

async function loadConsultations() {
  consultations = await api("/api/consultations");

  if (!consultations.length) {
    consultationSelect.innerHTML =
      '<option value="">No consultations available</option>';
    return;
  }

  consultationSelect.innerHTML =
    '<option value="">Select consultation</option>' +
    consultations.map(item => `
      <option value="${escapeHtml(item.consultation_id)}">
        #${escapeHtml(item.consultation_id)}
        — ${escapeHtml(item.student_name)}
        — ${escapeHtml(formatDate(item.consultation_date))}
        — ${escapeHtml(item.diagnosis)}
      </option>
    `).join("");
}

async function loadMedicines() {
  medicines = await api("/api/medicines");

  medicineSelect.innerHTML =
    '<option value="">Select medicine</option>' +
    medicines.map(item => `
      <option value="${escapeHtml(item.medicine_id)}"
              ${Number(item.stock_quantity) <= 0 ? "disabled" : ""}>
        ${escapeHtml(item.medicine_name)}
        — Stock: ${escapeHtml(item.stock_quantity)}
        ${Number(item.stock_quantity) <= 0 ? "(Out of stock)" : ""}
      </option>
    `).join("");
}

async function loadPrescriptions() {
  tableBody.innerHTML =
    '<tr><td colspan="7" class="empty-cell">Loading prescriptions…</td></tr>';

  const rows = await api("/api/prescriptions");

  prescriptions = rows.map(item => {
    const consultation = consultations.find(
      record =>
        Number(record.consultation_id) === Number(item.consultation_id)
    );

    return {
      ...item,
      student_name: consultation?.student_name || "Unknown student",
      consultation_date: consultation?.consultation_date || "",
      diagnosis: consultation?.diagnosis || ""
    };
  });

  renderPrescriptions();
}

function renderPrescriptions() {
  const term = searchInput.value.trim().toLowerCase();

  const filtered = prescriptions.filter(item => {
    const searchable = [
      item.student_name,
      item.consultation_id,
      item.medicine_name,
      item.dosage,
      item.frequency,
      item.duration,
      item.diagnosis
    ].join(" ").toLowerCase();

    return searchable.includes(term);
  });

  if (!filtered.length) {
    tableBody.innerHTML =
      '<tr><td colspan="7" class="empty-cell">No matching prescriptions found.</td></tr>';
    return;
  }

  tableBody.innerHTML = filtered.map(item => `
    <tr>
      <td>
        <strong>${escapeHtml(item.student_name)}</strong>
        <small>
          Consultation #${escapeHtml(item.consultation_id)}
          · ${escapeHtml(formatDate(item.consultation_date))}
        </small>
      </td>

      <td>
        <strong>${escapeHtml(item.medicine_name)}</strong>
        <small>${escapeHtml(item.diagnosis)}</small>
      </td>

      <td>
        ${escapeHtml(item.dosage || "—")}
        <small>
          ${escapeHtml(item.frequency || "—")}
          · ${escapeHtml(item.duration || "—")}
        </small>
        ${item.instructions
          ? `<small>${escapeHtml(item.instructions)}</small>`
          : ""}
      </td>

      <td>${escapeHtml(item.quantity)}</td>
      <td>${escapeHtml(item.quantity_dispensed)}</td>
      <td>${escapeHtml(item.quantity_remaining)}</td>

      <td>
        ${
          Number(item.quantity_remaining) > 0
            ? `
              <form class="dispense-form"
                    data-id="${escapeHtml(item.prescription_item_id)}">
                <input
                  type="number"
                  name="quantity_dispensed"
                  min="1"
                  max="${escapeHtml(item.quantity_remaining)}"
                  step="1"
                  required
                  aria-label="Quantity to dispense"
                  placeholder="Qty"
                  style="width: 88px; margin-bottom: 6px;"
                >
                <button class="button primary" type="submit">
                  Dispense
                </button>
              </form>
            `
            : '<span class="status-badge">Fully dispensed</span>'
        }
      </td>
    </tr>
  `).join("");
}

// Create a prescription.
form.addEventListener("submit", async event => {
  event.preventDefault();

  if (currentRole !== "doctor") {
    showNotice("Only doctors can create prescriptions.", true);
    return;
  }

  const payload = {
    consultation_id: form.elements.consultation_id.value,
    medicine_id: form.elements.medicine_id.value,
    quantity: form.elements.quantity.value,
    dosage: form.elements.dosage.value.trim(),
    frequency: form.elements.frequency.value.trim(),
    duration: form.elements.duration.value.trim(),
    instructions: form.elements.instructions.value.trim()
  };

  if (
    !payload.consultation_id ||
    !payload.medicine_id ||
    !payload.quantity ||
    !Number.isInteger(Number(payload.quantity)) ||
    Number(payload.quantity) <= 0
  ) {
    showNotice("Select a consultation, medicine and valid quantity.", true);
    return;
  }

  try {
    const result = await api("/api/prescriptions", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    form.reset();

    showNotice(
      result.message || "Prescription created successfully."
    );

    await Promise.all([
      loadMedicines(),
      loadPrescriptions()
    ]);
  } catch (error) {
    showNotice(error.message, true);
  }
});

// Dispense part or all of a prescription.
tableBody.addEventListener("submit", async event => {
  const dispenseForm = event.target.closest(".dispense-form");

  if (!dispenseForm) return;

  event.preventDefault();

  const prescriptionItemId = Number(dispenseForm.dataset.id);
  const quantityInput = dispenseForm.elements.quantity_dispensed;
  const quantityDispensed = Number(quantityInput.value);

  if (
    !Number.isInteger(prescriptionItemId) ||
    prescriptionItemId <= 0 ||
    !Number.isInteger(quantityDispensed) ||
    quantityDispensed <= 0
  ) {
    showNotice("Enter a valid positive dispensing quantity.", true);
    return;
  }

  const submitButton =
    dispenseForm.querySelector('button[type="submit"]');

  submitButton.disabled = true;

  try {
    const result = await api("/api/dispensing", {
      method: "POST",
      body: JSON.stringify({
        prescription_item_id: prescriptionItemId,
        quantity_dispensed: quantityDispensed
      })
    });

    showNotice(
      result.message || "Medicine dispensed successfully."
    );

    // Refresh the prescription balances and medicine stock.
    await Promise.all([
      loadPrescriptions(),
      loadMedicines()
    ]);
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

// Refresh button.
document.getElementById("refreshPrescriptions")
  .addEventListener("click", async () => {
    try {
      await Promise.all([
        loadConsultations(),
        loadMedicines()
      ]);

      await loadPrescriptions();
      showNotice("Prescription records refreshed.");
    } catch (error) {
      showNotice(error.message, true);
    }
  });

// Search prescriptions.
searchInput.addEventListener("input", renderPrescriptions);

// Initialize page.
async function initialize() {
  try {
    await loadUser();

    await Promise.all([
      loadConsultations(),
      loadMedicines()
    ]);

    await loadPrescriptions();
  } catch (error) {
    showNotice(error.message, true);
  }
}

initialize();
