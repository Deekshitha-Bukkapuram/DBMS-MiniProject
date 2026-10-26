
const staffForm = byId("staffForm");
let staffRecords = [];

// Load and display medical staff records
async function loadStaff() {
  try {
    const searchInput = byId("staffSearch");
    const search = encodeURIComponent(
      searchInput ? searchInput.value.trim() : ""
    );

    staffRecords = await apiRequest(`/staff?q=${search}`);

    byId("staffTable").innerHTML =
      staffRecords
        .map(
          (staff) => `
            <tr>
              <td>${escapeHTML(staff.staff_name)}</td>
              <td>${escapeHTML(staff.designation || staff.role || "—")}</td>
              <td>${escapeHTML(staff.specialization || "—")}</td>
              <td>${escapeHTML(staff.phone || "—")}</td>
              <td>${makeActions(staff.staff_id, "staff")}</td>
            </tr>
          `
        )
        .join("") || emptyTable(5);
  } catch (error) {
    console.error("Loading medical staff failed:", error);
    showNotice(error.message || "Unable to load medical staff.", "error");
  }
}

// Show the form for adding a staff member
byId("showStaffForm").addEventListener("click", () => {
  staffForm.reset();
  staffForm.elements.staff_id.value = "";
  toggleForm(staffForm);
});

// Cancel the form
byId("cancelStaffForm").addEventListener("click", () => {
  clearAndHideForm(staffForm);
});

// Search button
byId("searchStaff").addEventListener("click", loadStaff);

// Search when Enter is pressed
byId("staffSearch").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    loadStaff();
  }
});

// Add or update a staff member
staffForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = readForm(staffForm);
  const id = data.staff_id;

  delete data.staff_id;

  // Match the database column name
  if (data.role && !data.designation) {
    data.designation = data.role;
  }

  delete data.role;

  try {
    await apiRequest(id ? `/staff/${id}` : "/staff", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(data)
    });

    clearAndHideForm(staffForm);

    showNotice(
      id ? "Staff member updated successfully." : "Staff member added successfully."
    );

    await loadStaff();
  } catch (error) {
    console.error("Saving medical staff failed:", error);
    showNotice(error.message || "Unable to save staff member.", "error");
  }
});

// Edit or delete staff records
document.addEventListener("click", async (event) => {
  const editButton = event.target.closest('[data-edit="staff"]');
  const deleteButton = event.target.closest('[data-delete="staff"]');

  // Edit a staff member
  if (editButton) {
    const staff = staffRecords.find(
      (record) => String(record.staff_id) === editButton.dataset.id
    );

    if (!staff) return;

    staffForm.reset();

    Object.keys(staff).forEach((key) => {
      if (staffForm.elements[key]) {
        staffForm.elements[key].value = staff[key] ?? "";
      }
    });

    // Support a form field named role
    if (
      staffForm.elements.role &&
      !staffForm.elements.designation
    ) {
      staffForm.elements.role.value = staff.designation || staff.role || "";
    }

    staffForm.classList.remove("hidden");
    staffForm.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    return;
  }

  // Delete a staff member
  if (
    deleteButton &&
    confirm(
      "Delete this staff record? Staff linked to appointments cannot be deleted."
    )
  ) {
    try {
      await apiRequest(`/staff/${deleteButton.dataset.id}`, {
        method: "DELETE"
      });

      showNotice("Staff member deleted successfully.");
      await loadStaff();
    } catch (error) {
      console.error("Deleting medical staff failed:", error);
      showNotice(
        error.message || "Unable to delete staff member.",
        "error"
      );
    }
  }
});

// Initial load
loadStaff();
