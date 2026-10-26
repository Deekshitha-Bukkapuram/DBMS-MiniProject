
// CampusCare - Medicine Inventory Management

const medicineForm = byId("medicineForm");
let medicineRecords = [];

const LOW_STOCK_LIMIT = 10;

// Safely format database dates for HTML date inputs and tables.
function formatMedicineDate(value) {
  if (!value) return "—";

  const dateString = String(value).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return "—";
  }

  return dateString;
}

// Display medicine stock status.
function getMedicineStatus(medicine) {
  const quantity = Number(medicine.stock_quantity);

  if (quantity <= 0) {
    return { text: "Out of stock", className: "stock-low" };
  }

  if (quantity <= LOW_STOCK_LIMIT) {
    return { text: "Low stock", className: "stock-low" };
  }

  return { text: "Available", className: "stock-good" };
}

// Update the inventory summary cards.
function updateInventorySummary(records) {
  const totalElement = byId("inventoryTotal");
  const lowStockElement = byId("inventoryLowStock");
  const outOfStockElement = byId("inventoryOutOfStock");

  if (totalElement) {
    totalElement.textContent = records.length;
  }

  if (lowStockElement) {
    lowStockElement.textContent = records.filter(
      (medicine) =>
        Number(medicine.stock_quantity) > 0 &&
        Number(medicine.stock_quantity) <= LOW_STOCK_LIMIT,
    ).length;
  }

  if (outOfStockElement) {
    outOfStockElement.textContent = records.filter(
      (medicine) => Number(medicine.stock_quantity) <= 0,
    ).length;
  }
}

// Render the medicine inventory table.
function renderMedicines(records) {
  const table = byId("medicinesTable");

  if (!table) return;

  if (!records.length) {
    table.innerHTML = emptyTable(7, "No medicines found.");
    return;
  }

  table.innerHTML = records
    .map((medicine) => {
      const status = getMedicineStatus(medicine);
      const price = Number(medicine.price);

      return `
        <tr>
          <td>${escapeHTML(medicine.medicine_name)}</td>

          <td>${escapeHTML(medicine.category || "—")}</td>

          <td>${escapeHTML(medicine.stock_quantity)}</td>

          <td>₹${Number.isFinite(price) ? price.toFixed(2) : "0.00"}</td>

          <td>${escapeHTML(formatMedicineDate(medicine.expiry_date))}</td>

          <td class="${status.className}">
            ${status.text}
          </td>

          <td>
            ${makeActions(medicine.medicine_id, "medicine")}
          </td>
        </tr>
      `;
    })
    .join("");
}

// Load medicine records from the backend.
async function loadMedicines() {
  const table = byId("medicinesTable");

  if (!table) return;

  table.innerHTML = emptyTable(7, "Loading medicines...");

  try {
    // The existing backend returns all medicines.
    const response = await apiRequest("/medicines");

    if (!Array.isArray(response)) {
      throw new Error("Unexpected medicine inventory response.");
    }

    medicineRecords = response;

    // Summary cards show the complete inventory, not just search results.
    updateInventorySummary(medicineRecords);

    // Apply search locally so it works even if the API does not support ?q=.
    applyMedicineSearch();
  } catch (error) {
    table.innerHTML = emptyTable(
      7,
      "Unable to load medicines. Please check your login and backend.",
    );

    showNotice(error.message, "error");
  }
}

// Search by medicine name or category.
function applyMedicineSearch() {
  const searchInput = byId("medicineSearch");
  const query = searchInput
    ? searchInput.value.trim().toLowerCase()
    : "";

  const filteredRecords = medicineRecords.filter((medicine) => {
    const name = String(medicine.medicine_name || "").toLowerCase();
    const category = String(medicine.category || "").toLowerCase();

    return name.includes(query) || category.includes(query);
  });

  renderMedicines(filteredRecords);
}

// Reset the form for a new medicine.
function prepareNewMedicineForm() {
  medicineForm.reset();

  medicineForm.elements.medicine_id.value = "";

  const quantityInput = medicineForm.elements.stock_quantity;

  if (quantityInput) {
    quantityInput.value = "0";
  }

  const saveButton = byId("saveMedicineBtn");

  if (saveButton) {
    saveButton.textContent = "Save medicine";
  }

  medicineForm.classList.remove("hidden");

  medicineForm.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });

  const nameInput = medicineForm.elements.medicine_name;

  if (nameInput) {
    nameInput.focus();
  }
}

// Fill the form with an existing medicine for editing.
function prepareEditMedicineForm(medicine) {
  medicineForm.reset();

  medicineForm.elements.medicine_id.value = medicine.medicine_id;
  medicineForm.elements.medicine_name.value =
    medicine.medicine_name || "";
  medicineForm.elements.category.value = medicine.category || "";
  medicineForm.elements.stock_quantity.value =
    medicine.stock_quantity ?? 0;
  medicineForm.elements.price.value = medicine.price ?? 0;
  medicineForm.elements.expiry_date.value =
    formatMedicineDate(medicine.expiry_date) === "—"
      ? ""
      : formatMedicineDate(medicine.expiry_date);

  const saveButton = byId("saveMedicineBtn");

  if (saveButton) {
    saveButton.textContent = "Update medicine";
  }

  medicineForm.classList.remove("hidden");

  medicineForm.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

// Validate form values before sending them to the backend.
function validateMedicineForm(data) {
  if (!data.medicine_name || !data.medicine_name.trim()) {
    return "Medicine name is required.";
  }

  if (!data.category || !data.category.trim()) {
    return "Medicine category is required.";
  }

  if (
    data.stock_quantity === "" ||
    !Number.isInteger(Number(data.stock_quantity)) ||
    Number(data.stock_quantity) < 0
  ) {
    return "Stock quantity must be a non-negative whole number.";
  }

  if (
    data.price === "" ||
    !Number.isFinite(Number(data.price)) ||
    Number(data.price) < 0
  ) {
    return "Enter a valid non-negative medicine price.";
  }

  if (!data.expiry_date) {
    return "Expiry date is required.";
  }

  // Compare date strings in YYYY-MM-DD format.
  // Expired stock is allowed to be recorded, but it is not silently removed.
  return "";
}

// Save a new medicine or update an existing medicine.
async function saveMedicine(event) {
  event.preventDefault();

  const data = readForm(medicineForm);
  const medicineId = data.medicine_id;

  delete data.medicine_id;

  data.medicine_name = String(data.medicine_name || "").trim();
  data.category = String(data.category || "").trim();
  data.stock_quantity = Number(data.stock_quantity);
  data.price = Number(data.price);

  const validationError = validateMedicineForm(data);

  if (validationError) {
    showNotice(validationError, "error");
    return;
  }

  const saveButton = byId("saveMedicineBtn");

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = medicineId
      ? "Updating..."
      : "Saving...";
  }

  try {
    await apiRequest(
      medicineId
        ? `/medicines/${encodeURIComponent(medicineId)}`
        : "/medicines",
      {
        method: medicineId ? "PUT" : "POST",
        body: JSON.stringify(data),
      },
    );

    clearAndHideForm(medicineForm);

    if (saveButton) {
      saveButton.textContent = "Save medicine";
    }

    showNotice(
      medicineId
        ? "Medicine updated successfully."
        : "Medicine added successfully.",
    );

    // Reload from MySQL so the new medicine appears in the inventory.
    await loadMedicines();
  } catch (error) {
    showNotice(error.message, "error");
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "Save medicine";
    }
  }
}

// Delete a medicine.
async function deleteMedicine(medicineId) {
  const confirmed = window.confirm(
    "Delete this medicine? Medicines used in prescriptions cannot be deleted.",
  );

  if (!confirmed) return;

  try {
    await apiRequest(
      `/medicines/${encodeURIComponent(medicineId)}`,
      { method: "DELETE" },
    );

    showNotice("Medicine deleted successfully.");

    await loadMedicines();
  } catch (error) {
    showNotice(error.message, "error");
  }
}

// Set up medicine page event handlers.
if (medicineForm) {
  const showFormButton = byId("showMedicineForm");
  const cancelButton = byId("cancelMedicineForm");
  const searchButton = byId("searchMedicines");
  const searchInput = byId("medicineSearch");
  const refreshButton = byId("refreshMedicines");

  if (showFormButton) {
    showFormButton.addEventListener("click", prepareNewMedicineForm);
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      clearAndHideForm(medicineForm);

      const saveButton = byId("saveMedicineBtn");

      if (saveButton) {
        saveButton.textContent = "Save medicine";
        saveButton.disabled = false;
      }
    });
  }

  if (searchButton) {
    searchButton.addEventListener("click", applyMedicineSearch);
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyMedicineSearch);

    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyMedicineSearch();
      }
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", loadMedicines);
  }

  medicineForm.addEventListener("submit", saveMedicine);

  // Handle Edit and Delete buttons in the table.
  document.addEventListener("click", async (event) => {
    const editButton = event.target.closest('[data-edit="medicine"]');
    const deleteButton = event.target.closest('[data-delete="medicine"]');

    if (editButton) {
      const medicine = medicineRecords.find(
        (item) =>
          String(item.medicine_id) === editButton.dataset.id,
      );

      if (medicine) {
        prepareEditMedicineForm(medicine);
      }
    }

    if (deleteButton) {
      await deleteMedicine(deleteButton.dataset.id);
    }
  });

  loadMedicines();
}
