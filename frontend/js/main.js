
const API_BASE = "/api";

const byId = (id) => document.getElementById(id);

// API request helper
async function apiRequest(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || "Request failed");
  }

  return data;
}

// Display notification messages
function showNotice(message, type = "success") {
  const box = byId("notice");

  if (!box) {
    alert(message);
    return;
  }

  box.textContent = message;
  box.className = `notice ${type}`;

  window.scrollTo({ top: 0, behavior: "smooth" });

  window.clearTimeout(showNotice.timer);

  showNotice.timer = window.setTimeout(() => {
    box.classList.add("hidden");
  }, 4500);
}

// Escape HTML to prevent unsafe HTML injection
function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );
}

// Read form values
function readForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

// Reset and hide a form
function clearAndHideForm(form) {
  form.reset();

  const idInput = form.querySelector('input[type="hidden"]');

  if (idInput) {
    idInput.value = "";
  }

  form.classList.add("hidden");
}

// Toggle form visibility
function toggleForm(form) {
  form.classList.toggle("hidden");

  if (!form.classList.contains("hidden")) {
    form.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
}

// Generate Edit and Delete buttons
function makeActions(id, entity) {
  return `<div class="actions">
    <button
      type="button"
      class="action-btn"
      data-edit="${entity}"
      data-id="${id}"
    >Edit</button>

    <button
      type="button"
      class="action-btn delete"
      data-delete="${entity}"
      data-id="${id}"
    >Delete</button>
  </div>`;
}

// Empty table message
function emptyTable(columns, message = "No records found.") {
  return `<tr>
    <td class="empty-cell" colspan="${columns}">
      ${escapeHTML(message)}
    </td>
  </tr>`;
}

// Dashboard statistics
// Other pages do not need this request.
async function loadDashboardStats() {
  try {
    const stats = await apiRequest("/dashboard");

    if (byId("totalStudents")) {
      byId("totalStudents").textContent = stats.students;
    }

    if (byId("totalStaff")) {
      byId("totalStaff").textContent = stats.staff;
    }

    if (byId("totalAppointments")) {
      byId("totalAppointments").textContent = stats.appointments;
    }

    if (byId("totalMedicines")) {
      byId("totalMedicines").textContent = stats.medicines;
    }

    if (byId("lowStock")) {
      byId("lowStock").textContent = `Low stock: ${stats.lowStock}`;
    }
  } catch (error) {
    showNotice(
      `${error.message}. Check that the backend and MySQL are running.`,
      "error",
    );
  }
}

// Staff logout functionality
async function logoutStaff() {
  const confirmed = window.confirm(
    "Are you sure you want to log out?",
  );

  if (!confirmed) {
    return;
  }

  const logoutBtn = byId("logoutBtn");

  if (logoutBtn) {
    logoutBtn.disabled = true;
    logoutBtn.textContent = "Logging out...";
  }

  try {
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || "Logout failed");
    }

    // Redirect after the server confirms logout.
    window.location.replace("/login.html");
  } catch (error) {
    console.error("Staff logout error:", error);

    if (logoutBtn) {
      logoutBtn.disabled = false;
      logoutBtn.textContent = "Logout";
    }

    showNotice(
      `${error.message}. Please try again.`,
      "error",
    );
  }
}

// Initialize page functionality
document.addEventListener("DOMContentLoaded", () => {
  // Load dashboard statistics only on the dashboard.
  if (byId("totalStudents")) {
    loadDashboardStats();
  }

  // Attach the logout handler if this page has a Logout button.
  const logoutBtn = byId("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutStaff);
  }
});
