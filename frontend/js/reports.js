
document.addEventListener("DOMContentLoaded", () => {
  loadReports();

  const refreshButton = document.getElementById("refreshReport");
  if (refreshButton) {
    refreshButton.addEventListener("click", loadReports);
  }
});

async function fetchReport(url) {
  const response = await fetch(url, {
    credentials: "same-origin"
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function loadReports() {
  await Promise.all([
    loadAppointmentsReport(),
    loadMedicineStockReport()
  ]);
}

async function loadAppointmentsReport() {
  const table = document.getElementById("reportTable");
  if (!table) {
    console.error("Cannot find reportTable in reports.html");
    return;
  }

  table.innerHTML =
    '<tr><td colspan="2">Loading report...</td></tr>';

  try {
    const data = await fetchReport(
      "/api/reports/appointments-by-staff"
    );

    table.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      table.innerHTML =
        '<tr><td colspan="2">No appointment data found.</td></tr>';
      return;
    }

    data.forEach((item) => {
      const row = document.createElement("tr");

      const staffCell = document.createElement("td");
      staffCell.textContent = item.staff_name ?? "Unknown";

      const countCell = document.createElement("td");
      countCell.textContent = item.total_appointments ?? 0;

      row.append(staffCell, countCell);
      table.appendChild(row);
    });
  } catch (error) {
    console.error("Appointments report error:", error);
    table.innerHTML =
      '<tr><td colspan="2">Failed to load appointments. Please refresh.</td></tr>';
  }
}

async function loadMedicineStockReport() {
  const table = document.getElementById("medicineStockTable");
  if (!table) {
    console.error("Cannot find medicineStockTable in reports.html");
    return;
  }

  table.innerHTML =
    '<tr><td colspan="5">Loading medicine inventory...</td></tr>';

  try {
    const data = await fetchReport("/api/reports/medicine-stock");

    table.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      table.innerHTML =
        '<tr><td colspan="5">No medicines found.</td></tr>';
      return;
    }

    data.forEach((item) => {
      const row = document.createElement("tr");

      const values = [
        item.medicine_name,
        item.category,
        item.stock_quantity,
        item.price,
        item.expiry_date
          ? String(item.expiry_date).slice(0, 10)
          : "—"
      ];

      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value ?? "—";
        row.appendChild(cell);
      });

      table.appendChild(row);
    });
  } catch (error) {
    console.error("Medicine inventory error:", error);
    table.innerHTML =
      '<tr><td colspan="5">Failed to load medicine inventory. Please refresh.</td></tr>';
  }
}
