const studentForm = byId("studentForm");
let studentRecords = [];

async function loadStudents() {
  try {
    const search = encodeURIComponent(byId("studentSearch").value.trim());
    studentRecords = await apiRequest(`/students?q=${search}`);
    byId("studentsTable").innerHTML =
      studentRecords
        .map(
          (s) => `
      <tr><td>${escapeHTML(s.roll_no)}</td><td>${escapeHTML(s.student_name)}</td>
      <td>${escapeHTML(s.department)}</td><td>${escapeHTML(s.year_of_study)}</td>
      <td>${escapeHTML(s.phone || "—")}</td><td>${makeActions(s.student_id, "student")}</td></tr>
    `,
        )
        .join("") || emptyTable(6);
  } catch (error) {
    showNotice(error.message, "error");
  }
}

byId("showStudentForm").addEventListener("click", () => {
  studentForm.reset();
  studentForm.elements.student_id.value = "";
  toggleForm(studentForm);
});
byId("cancelStudentForm").addEventListener("click", () =>
  clearAndHideForm(studentForm),
);
byId("searchStudents").addEventListener("click", loadStudents);
byId("studentSearch").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    loadStudents();
  }
});

studentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = readForm(studentForm);
  const id = data.student_id;
  delete data.student_id;
  data.year_of_study = Number(data.year_of_study);
  try {
    await apiRequest(id ? `/students/${id}` : "/students", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(data),
    });
    clearAndHideForm(studentForm);
    showNotice(
      id ? "Student updated successfully." : "Student added successfully.",
    );
    await loadStudents();
  } catch (error) {
    showNotice(error.message, "error");
  }
});

document.addEventListener("click", async (e) => {
  const edit = e.target.closest('[data-edit="student"]');
  const del = e.target.closest('[data-delete="student"]');
  if (edit) {
    const row = studentRecords.find(
      (s) => String(s.student_id) === edit.dataset.id,
    );
    if (!row) return;
    Object.keys(row).forEach((key) => {
      if (studentForm.elements[key])
        studentForm.elements[key].value = row[key] ?? "";
    });
    studentForm.classList.remove("hidden");
    studentForm.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (
    del &&
    confirm(
      "Delete this student record? Related appointments may prevent deletion.",
    )
  ) {
    try {
      await apiRequest(`/students/${del.dataset.id}`, { method: "DELETE" });
      showNotice("Student deleted.");
      await loadStudents();
    } catch (error) {
      showNotice(error.message, "error");
    }
  }
});

loadStudents();
