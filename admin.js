/**
 * SRCCFPC Admin Command Center Engine
 * DYNAMIC ALL-TABLES SPREADSHEET ENGINE + APPROVAL WORKFLOW & WELCOME MAIL SENDER
 */

const CONFIG = {
  GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyRrT4TS8ZrvNqw_WzO8T1ll96YMr9aUTY2KfA7h7Jija3uaGx1ZTptSXDWp8fRAfcPjg/exec"
};

// Application State Holding All Database Tables Dynamically
let dbTables = {}; 
let activeTableName = "";
let rawAdminsList = [];
let dbTableMeta = {};

document.addEventListener("DOMContentLoaded", () => {
  const sessionToken = localStorage.getItem("srccfpc_admin_token");
  if (sessionToken) {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("adminDashboard").style.display = "block";
    loadAllData();
  }
});

/**
 * Universal Centralized API Communication Handler
 */
async function apiRequest(action, data = {}) {
  try {
    const token = localStorage.getItem("srccfpc_admin_token") || "";
    const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, data, token })
    });
    return await response.json();
  } catch (err) {
    console.error("API Fetch Error:", err);
    return { ok: false, message: "Server connection failed or invalid response." };
  }
}

/**
 * Visual Toast Feedback System
 */
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  const icon = toast.querySelector(".toast-icon");
  const text = toast.querySelector(".toast-message");

  toast.className = `toast toast--${type}`;
  icon.textContent = type === "success" ? "✓" : type === "error" ? "!" : "✦";
  text.textContent = message;
  toast.classList.add("show");

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3800);
}

/**
 * Handle Admin Authentication
 */
async function handleAdminLogin(e) {
  e.preventDefault();
  const status = document.getElementById("loginStatus");
  status.textContent = "Authenticating master session...";
  status.style.color = "var(--cyan)";

  const username = document.getElementById("adminUser").value.trim();
  const password = document.getElementById("adminPass").value;

  const res = await apiRequest("adminLogin", { username, password });

  if (res.ok && res.token) {
    localStorage.setItem("srccfpc_admin_token", res.token);
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("adminDashboard").style.display = "block";
    status.textContent = "";
    showToast("Authentication successful. Welcome!", "success");
    loadAllData();
  } else {
    status.textContent = res.message || "Invalid credentials.";
    status.style.color = "var(--danger)";
    showToast(res.message || "Authentication failed", "error");
  }
}

/**
 * Fetches ALL Google Sheet Tables Dynamically & Stats
 */
async function loadAllData() {
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) refreshBtn.classList.add("is-loading");

  try {
    const tablesRes = await apiRequest("getAllTables");
    if (!tablesRes.ok) {
      throw new Error(tablesRes.message || "Unable to load database tables.");
    }

    dbTables = tablesRes.tables || {};
    dbTableMeta = tablesRes.metadata || {};

    const adminsRes = await apiRequest("listAdmins");
    rawAdminsList = adminsRes.admins || [];

    const adminTableName = Object.keys(dbTables).find(name =>
      name.toLowerCase() === "admin details table"
    );
    if (adminTableName) {
      dbTables[adminTableName] = rawAdminsList;
    }

    const pendingRows = findTableData("joining process table").filter(row =>
      String(row.verification_status || "").toLowerCase() === "pending"
    );
    const activeRows = findTableData("personal details table").filter(row =>
      String(row.verification_status || "").toLowerCase() === "approved"
    );

    document.getElementById("pendingCount").textContent = pendingRows.length;
    document.getElementById("activeCount").textContent = activeRows.length;
    document.getElementById("tablesCount").textContent = Object.keys(dbTables).length;

    renderDynamicTabs();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Error synchronizing cloud database.", "error");
  } finally {
    if (refreshBtn) refreshBtn.classList.remove("is-loading");
  }
}

/**
 * Helper to locate table by partial name matching
 */
function findTableData(keyword) {
  const keys = Object.keys(dbTables);
  const matchedKey = keys.find(k => k.toLowerCase().includes(keyword.toLowerCase()));
  return matchedKey ? dbTables[matchedKey] : [];
}

/**
 * Renders Tab Buttons dynamically for ALL tables present in Google Sheets
 */
function renderDynamicTabs() {
  const nav = document.getElementById("dynamicTabsNav");
  const tableNames = Object.keys(dbTables);

  if (tableNames.length === 0) {
    nav.innerHTML = `<span class="loading-text">No database tables found.</span>`;
    return;
  }

  if (!activeTableName || !dbTables[activeTableName]) {
    activeTableName = tableNames[0]; // Default to first table
  }

  nav.innerHTML = tableNames.map(name => `
    <button class="tab-btn ${name === activeTableName ? 'active' : ''}" 
            onclick="switchDynamicTab('${escapeHtml(name)}')" type="button">
      ${escapeHtml(name)} (${dbTables[name].length})
    </button>
  `).join("");

  switchDynamicTab(activeTableName);
}

/**
 * Switch Active Table Workspace View
 */
function switchDynamicTab(tableName) {
  activeTableName = tableName;
  
  // Update Tab Styling
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.textContent.startsWith(tableName));
  });

  document.getElementById("currentWorkspaceLabel").textContent = tableName.toUpperCase();
  document.getElementById("currentWorkspaceTitle").textContent = `${tableName} Records`;

  renderActiveTableData(dbTables[tableName] || []);
}

/**
 * Dynamically Renders Headers & Rows for ANY Google Sheet Table Structure
 */
function renderActiveTableData(rows) {
  const container = document.getElementById("dynamicTableContainer");

  if (!rows || rows.length === 0) {
    container.innerHTML = `<div class="loading-text">No records stored in "${escapeHtml(activeTableName)}".</div>`;
    return;
  }

  const meta = dbTableMeta[activeTableName] || {};
  const columns = (meta.headers || Object.keys(rows[0]))
    .filter(key => key !== "_rowNumber");
  const primaryKey = meta.primaryKey || "_rowNumber";
  const isAdminsTable = Boolean(meta.protected) || activeTableName.toLowerCase().includes("admin details table");
  const isJoiningTable = activeTableName.toLowerCase().includes("joining process table");

  let html = `
    <table>
      <thead>
        <tr>
          ${columns.map(col => `<th>${escapeHtml(col)}</th>`).join("")}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  html += rows.map(row => {
    const identifier = row[primaryKey] !== undefined ? row[primaryKey] : row._rowNumber;
    const pending = isJoiningTable && String(row.verification_status || "").toLowerCase() === "pending";
    const identifierJson = JSON.stringify(String(identifier));

    const cellsHtml = columns.map(col => `<td>${escapeHtml(row[col] ?? "")}</td>`).join("");
    let actionsHtml = `<div class="action-cell">`;

    if (pending) {
      actionsHtml += `<button class="btn-action btn-action--approve" onclick='approveMember(${identifierJson})'>✓ Approve</button>`;
    }

    if (!isAdminsTable) {
      actionsHtml += `<button class="btn-action btn-action--view" onclick='openViewModal(${identifierJson})'>👁 Details</button>`;
      actionsHtml += `<button class="btn-action btn-action--edit" onclick='openEditModal(${identifierJson})'>✎ Edit</button>`;
      actionsHtml += `<button class="btn-action btn-action--delete" onclick='deleteRecord(${identifierJson})'>× Remove</button>`;
    } else {
      actionsHtml += `<span class="live-indicator">PROTECTED</span>`;
    }

    actionsHtml += `</div>`;
    return `<tr>${cellsHtml}<td>${actionsHtml}</td></tr>`;
  }).join("");

  html += `</tbody></table>`;
  container.innerHTML = html;
}

/**
 * APPROVAL WORKFLOW & AUTOMATED WELCOME EMAIL
 */
async function approveMember(identifier) {
  const rows = dbTables[activeTableName] || [];
  const meta = dbTableMeta[activeTableName] || {};
  const primaryKey = meta.primaryKey || "_rowNumber";
  const target = rows.find(row => String(row[primaryKey] ?? row._rowNumber) === String(identifier));
  if (!target) return;

  const email = target.email || target.Email || target.EmailAddress || "";
  const name = target.full_name || target.name || target.Name || target.FullName || "Member";

  if (!email) {
    showToast("Approval cannot continue: registered email is missing.", "error");
    return;
  }

  if (!confirm(`Approve membership for ${name} (${identifier}) and send the Welcome email?`)) {
    return;
  }

  showToast(`Approving ${name}...`, "info");
  const res = await apiRequest("approveJoin", { application_id: identifier });

  if (res.ok) {
    showToast(`Approved! Welcome email sent to ${email}.`, "success");
    await loadAllData();
  } else {
    showToast(res.message || "Approval failed.", "error");
  }
}

/**
 * Dynamic View Modal (Dossier)
 */
function openViewModal(identifier) {
  const rows = dbTables[activeTableName] || [];
  const meta = dbTableMeta[activeTableName] || {};
  const key = meta.primaryKey || "_rowNumber";
  const target = rows.find(row => String(row[key] ?? row._rowNumber) === String(identifier));
  if (!target) return;

  const container = document.getElementById("viewDetailsContainer");
  container.innerHTML = Object.entries(target)
    .filter(([k]) => k !== "_rowNumber")
    .map(([key, val]) => `
      <div class="view-item ${String(val || '').length > 30 ? 'full' : ''}">
        <small>${escapeHtml(key)}</small>
        <strong>${escapeHtml(val || 'N/A')}</strong>
      </div>
    `).join("");

  document.getElementById("viewModal").classList.add("show");
  document.body.classList.add("modal-open");
}

function closeViewModal() {
  document.getElementById("viewModal").classList.remove("show");
  document.body.classList.remove("modal-open");
}

/**
 * Dynamic Edit Modal Generator
 */
function openEditModal(identifier) {
  const rows = dbTables[activeTableName] || [];
  const meta = dbTableMeta[activeTableName] || {};
  const key = meta.primaryKey || "_rowNumber";
  const target = rows.find(row => String(row[key] ?? row._rowNumber) === String(identifier));
  if (!target) return;

  document.getElementById("editIdentifier").value = identifier;
  document.getElementById("editTableName").value = activeTableName;

  const container = document.getElementById("editFieldsContainer");
  const keys = Object.keys(target).filter(k => k !== "_rowNumber");

  container.innerHTML = keys.map(key => `
    <label class="field field--modal" style="${key.length > 20 ? 'grid-column: 1 / -1;' : ''}">
      <span>${escapeHtml(key)}</span>
      <input type="text" data-key="${escapeHtml(key)}" value="${escapeHtml(target[key] || '')}">
    </label>
  `).join("");

  document.getElementById("editModal").classList.add("show");
  document.body.classList.add("modal-open");
}

function closeEditModal() {
  document.getElementById("editModal").classList.remove("show");
  document.body.classList.remove("modal-open");
}

/**
 * Save Record Mutation
 */
async function saveMemberUpdate(e) {
  e.preventDefault();
  const identifier = document.getElementById("editIdentifier").value;
  const tableName = document.getElementById("editTableName").value;
  const saveBtn = document.getElementById("saveEditBtn");

  const updates = {};
  document.querySelectorAll("#editFieldsContainer input").forEach(input => {
    const key = input.getAttribute("data-key");
    updates[key] = input.value;
  });

  saveBtn.disabled = true;
  showToast("Saving updates to Google Sheets...", "info");

  const res = await apiRequest("updateRecord", { tableName, primaryKeyValue: identifier, updates });

  saveBtn.disabled = false;
  if (res.ok) {
    showToast("Record updated successfully!", "success");
    closeEditModal();
    await loadAllData();
  } else {
    showToast(res.message || "Failed to update record.", "error");
  }
}

/**
 * Dynamic Delete Record Engine
 */
async function deleteRecord(identifier) {
  if (!confirm(`Permanently remove record ${identifier} from ${activeTableName}?`)) {
    return;
  }

  showToast(`Deleting entry ${identifier}...`, "info");
  const res = await apiRequest("deleteRecord", { tableName: activeTableName, primaryKeyValue: identifier });

  if (res.ok) {
    showToast("Entry removed successfully.", "success");
    await loadAllData();
  } else {
    showToast(res.message || "Deletion failed.", "error");
  }
}

/**
 * Add New Admin Account
 */
async function saveNewAdmin(e) {
  e.preventDefault();
  const user = document.getElementById("newAdminUser").value.trim();
  const pass = document.getElementById("newAdminPass").value;
  const saveBtn = document.getElementById("saveAdminBtn");

  saveBtn.disabled = true;
  showToast("Creating administrator credentials...", "info");

  const res = await apiRequest("createAdmin", { username: user, password: pass });

  saveBtn.disabled = false;
  if (res.ok) {
    showToast("Admin account created!", "success");
    closeAddAdminModal();
    document.getElementById("newAdminUser").value = "";
    document.getElementById("newAdminPass").value = "";
    await loadAllData();
  } else {
    showToast(res.message || "Failed to create admin.", "error");
  }
}

function openAddAdminModal() {
  document.getElementById("addAdminModal").classList.add("show");
  document.body.classList.add("modal-open");
}

function closeAddAdminModal() {
  document.getElementById("addAdminModal").classList.remove("show");
  document.body.classList.remove("modal-open");
}

/**
 * Search/Filter Engine
 */
function handleSearch() {
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  const rows = dbTables[activeTableName] || [];

  if (!query) {
    renderActiveTableData(rows);
    return;
  }

  const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(query));
  renderActiveTableData(filtered);
}

function togglePasswordVisibility() {
  const pass = document.getElementById("adminPass");
  const btn = document.getElementById("togglePassword");
  if (pass.type === "password") {
    pass.type = "text";
    btn.textContent = "Hide";
  } else {
    pass.type = "password";
    btn.textContent = "Show";
  }
}

function handleLogout() {
  localStorage.removeItem("srccfpc_admin_token");
  document.getElementById("adminDashboard").style.display = "none";
  document.getElementById("loginScreen").style.display = "grid";
  showToast("Logged out safely.", "info");
}

function escapeHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
