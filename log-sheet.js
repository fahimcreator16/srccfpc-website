/**
 * SRCCFPC Lock Sheet CRUD controller.
 * The backend remains authoritative for authorization and mutation.
 */

const SRCCFPC_API_URL = "https://script.google.com/macros/s/AKfycbyRrT4TS8ZrvNqw_WzO8T1ll96YMr9aUTY2KfA7h7Jija3uaGx1ZTptSXDWp8fRAfcPjg/exec";
let logRows = [];

/**
 * Gets the current protected session token.
 * @returns {string} Session token.
 */
function getSessionToken() {
  return localStorage.getItem("srccfpc_token") ||
    localStorage.getItem("srccfpc_admin_token") || "";
}

/**
 * Shows a temporary toast.
 * @param {string} message Message text.
 * @returns {void}
 */
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}

/**
 * Calls the Apps Script JSON API.
 * @param {string} action API action.
 * @param {Object} data Request data.
 * @returns {Promise<Object>} Parsed API response.
 */
async function apiRequest(action, data = {}) {
  const response = await fetch(SRCCFPC_API_URL, {
    method: "POST",
    headers: {"Content-Type": "text/plain;charset=utf-8"},
    body: JSON.stringify({action, data, token: getSessionToken()})
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.message || "Request failed.");
  return result;
}

/**
 * Escapes untrusted values before HTML rendering.
 * @param {*} value Value to escape.
 * @returns {string} Safe HTML.
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Loads current Lock Sheet records.
 * @returns {Promise<void>} Completion promise.
 */
async function loadLogSheet() {
  try {
    const result = await apiRequest("getTable", {
      tableName: "Log Sheet Details Table"
    });
    logRows = result.rows || [];
    renderLogRows();
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Renders table rows with Update and Remove controls.
 * @returns {void}
 */
function renderLogRows() {
  const body = document.getElementById("logTableBody");
  const search = document.getElementById("logSearch").value.trim().toLowerCase();

  const rows = logRows.filter((row) => {
    const haystack = [
      row.item, row.location, row.custodian,
      row.action, row.notes, row.status
    ].join(" ").toLowerCase();
    return !search || haystack.includes(search);
  });

  document.getElementById("logCount").textContent =
    `${rows.length} Record${rows.length === 1 ? "" : "s"}`;

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" class="loading-text">No matching records.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.timestamp)}</td>
      <td><strong>${escapeHtml(row.item)}</strong></td>
      <td>${escapeHtml(row.location)}</td>
      <td>${escapeHtml(row.custodian)}</td>
      <td>${escapeHtml(row.action)}</td>
      <td><span class="status-chip">${escapeHtml(row.status)}</span></td>
      <td>
        <div class="row-actions">
          <button class="row-action row-action--edit" type="button" data-edit-id="${escapeHtml(row.id)}">Update</button>
          <button class="row-action row-action--delete" type="button" data-delete-id="${escapeHtml(row.id)}">Remove</button>
        </div>
      </td>
    </tr>
  `).join("");
}

/**
 * Opens the row editor.
 * @param {string} id Record primary key.
 * @returns {void}
 */
function openEditModal(id) {
  const row = logRows.find((item) => String(item.id) === String(id));
  if (!row) return;

  document.getElementById("editLogId").value = row.id;
  document.getElementById("editLogItem").value = row.item || "";
  document.getElementById("editLogLocation").value = row.location || "";
  document.getElementById("editLogCustodian").value = row.custodian || "";
  document.getElementById("editLogAction").value = row.action || "Checked";
  document.getElementById("editLogStatus").value = row.status || "active";
  document.getElementById("editLogNotes").value = row.notes || "";

  const modal = document.getElementById("editLogModal");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

/**
 * Closes the row editor.
 * @returns {void}
 */
function closeEditModal() {
  const modal = document.getElementById("editLogModal");
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

/**
 * Adds a new Lock Sheet record.
 * @param {SubmitEvent} event Submit event.
 * @returns {Promise<void>} Completion promise.
 */
async function createLogRecord(event) {
  event.preventDefault();
  try {
    const result = await apiRequest(
      "submitLogSheet",
      Object.fromEntries(new FormData(event.currentTarget))
    );
    showToast(result.message);
    event.currentTarget.reset();
    await loadLogSheet();
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Updates a Lock Sheet record.
 * @param {SubmitEvent} event Submit event.
 * @returns {Promise<void>} Completion promise.
 */
async function updateLogRecord(event) {
  event.preventDefault();

  const id = document.getElementById("editLogId").value;
  const updates = {
    item: document.getElementById("editLogItem").value.trim(),
    location: document.getElementById("editLogLocation").value.trim(),
    custodian: document.getElementById("editLogCustodian").value.trim(),
    action: document.getElementById("editLogAction").value,
    status: document.getElementById("editLogStatus").value,
    notes: document.getElementById("editLogNotes").value.trim()
  };

  try {
    const result = await apiRequest("updateRecord", {
      tableName: "Log Sheet Details Table",
      primaryKeyValue: id,
      updates
    });
    showToast(result.message);
    closeEditModal();
    await loadLogSheet();
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Removes a Lock Sheet record after confirmation.
 * @param {string} id Record primary key.
 * @returns {Promise<void>} Completion promise.
 */
async function removeLogRecord(id) {
  const row = logRows.find((item) => String(item.id) === String(id));
  if (!row) return;

  if (!window.confirm(`Remove "${row.item}" from the Lock Sheet?`)) return;

  try {
    const result = await apiRequest("deleteRecord", {
      tableName: "Log Sheet Details Table",
      primaryKeyValue: id
    });
    showToast(result.message);
    await loadLogSheet();
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Initializes the Lock Sheet page.
 * @returns {void}
 */
function initializeLogSheetPage() {

  if (!getSessionToken()) {
    window.location.href = "login.html?next=log-sheet.html";
    return;
  }

  document.getElementById("navToggle")?.addEventListener("click", () => {
    const drawer = document.getElementById("navDrawer");
    const toggle = document.getElementById("navToggle");
    const active = drawer.classList.toggle("active");
    toggle.setAttribute("aria-expanded", String(active));
  });

  document.getElementById("logout")?.addEventListener("click", () => {
    localStorage.removeItem("srccfpc_token");
    localStorage.removeItem("srccfpc_admin_token");
    window.location.href = "login.html";
  });

  document.getElementById("logSheetForm")?.addEventListener("submit", createLogRecord);
  document.getElementById("editLogForm")?.addEventListener("submit", updateLogRecord);
  document.getElementById("refreshLogSheet")?.addEventListener("click", loadLogSheet);
  document.getElementById("logSearch")?.addEventListener("input", renderLogRows);

  document.querySelectorAll("[data-close-log-modal]").forEach((node) => {
    node.addEventListener("click", closeEditModal);
  });

  document.getElementById("logTableBody")?.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-id]");
    const remove = event.target.closest("[data-delete-id]");
    if (edit) openEditModal(edit.dataset.editId);
    if (remove) removeLogRecord(remove.dataset.deleteId);
  });

  loadLogSheet();
}

document.addEventListener("DOMContentLoaded", initializeLogSheetPage);
