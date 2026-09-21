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
let pendingDeleteContext = null;
let pendingAdminOtpChallenge = "";

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
  status.textContent = "Verifying administrator credentials...";
  status.style.color = "var(--cyan)";
  const username = document.getElementById("adminUser").value.trim();
  const password = document.getElementById("adminPass").value;
  const res = await apiRequest("adminLogin", { username, password });
  if (res.ok && res.otpRequired) {
    pendingAdminOtpChallenge = res.challenge;
    document.getElementById("adminOtpModal").classList.add("show");
    document.body.classList.add("modal-open");
    status.textContent = "OTP sent to the registered admin email.";
    return;
  }
  status.textContent = res.message || "Invalid credentials.";
  status.style.color = "var(--danger)";
  showToast(res.message || "Authentication failed", "error");
}

async function verifyAdminOtp(event) {
  event.preventDefault();
  const otp = document.getElementById("adminOtpInput").value.trim();
  const res = await apiRequest("verifyOtp", { challenge: pendingAdminOtpChallenge, otp });
  if (res.ok && res.resetToken) {
    const newPassword = prompt("OTP verified. Enter your new admin password:");
    if (!newPassword) return;
    const resetRes = await apiRequest("resetPassword", { resetToken: res.resetToken, newPassword });
    showToast(resetRes.message || "Password reset completed.", resetRes.ok ? "success" : "error");
    document.getElementById("adminOtpModal").classList.remove("show");
    document.body.classList.remove("modal-open");
    return;
  }
  if (res.ok && res.token) {
    localStorage.setItem("srccfpc_admin_token", res.token);
    document.getElementById("adminOtpModal").classList.remove("show");
    document.body.classList.remove("modal-open");
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("adminDashboard").style.display = "block";
    showToast("OTP verified. Welcome to the command center.", "success");
    loadAllData();
  } else {
    showToast(res.message || "OTP verification failed.", "error");
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
    loadRemovedMembers();
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
  pendingDeleteContext = { tableName: activeTableName, identifier };
  document.getElementById("removeScopeModal")?.classList.add("show");
  document.body.classList.add("modal-open");
}

function closeRemoveScopeModal() {
  document.getElementById("removeScopeModal")?.classList.remove("show");
  document.body.classList.remove("modal-open");
  pendingDeleteContext = null;
}

async function confirmTableOnlyDelete() {
  if (!pendingDeleteContext) return;
  const context = pendingDeleteContext;
  closeRemoveScopeModal();
  if (!confirm(`Remove record ${context.identifier} from ${context.tableName} only?`)) return;
  showToast("Removing this table record...", "info");
  const res = await apiRequest("deleteRecord", { tableName: context.tableName, primaryKeyValue: context.identifier });
  if (res.ok) {
    showToast("Record removed from this table only.", "success");
    await loadAllData();
  } else {
    showToast(res.message || "Deletion failed.", "error");
  }
}

async function confirmMemberWideRemove() {
  if (!pendingDeleteContext) return;
  const context = pendingDeleteContext;
  closeRemoveScopeModal();
  const rows = dbTables[context.tableName] || [];
  const target = rows.find((row) => String(row[dbTableMeta[context.tableName]?.primaryKey || "_rowNumber"] ?? row._rowNumber) === String(context.identifier));
  const roll = target?.roll_number || "";
  if (!roll) {
    showToast("This record does not contain a roll number, so a complete member removal cannot be safely inferred.", "error");
    return;
  }
  if (!confirm(`Remove ALL related data for member roll ${roll}? A complete archive will be created first.`)) return;
  showToast("Creating complete member archive...", "info");
  const res = await apiRequest("removeMember", { roll_number: roll });
  if (res.ok) {
    showToast("Complete member archive created and member removed.", "success");
    await loadAllData();
    await loadRemovedMembers();
  } else {
    showToast(res.message || "Member removal failed.", "error");
  }
}

async function loadRemovedMembers() {
  const workspace = document.getElementById("removedWorkspace");
  const container = document.getElementById("removedMembersContainer");
  if (!workspace || !container) return;
  workspace.hidden = false;
  const res = await apiRequest("listRemovedMembers");
  if (!res.ok) { container.innerHTML = `<div class="loading-text">${escapeHtml(res.message || "Unable to load archives.")}</div>`; return; }
  const rows = res.removed || [];
  if (!rows.length) { container.innerHTML = '<div class="loading-text">No removed members found.</div>'; return; }
  container.innerHTML = `<table class="data-table"><thead><tr><th>Roll</th><th>Name</th><th>Removed At</th><th>Removed By</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.roll_number)}</td><td>${escapeHtml(row.member_name)}</td><td>${escapeHtml(row.removed_at)}</td><td>${escapeHtml(row.removed_by)}</td><td>${escapeHtml(row.status)}</td><td><button class="row-action row-action--view" onclick="viewRemovedDetails('${escapeHtml(row.archive_id)}')">View All Details</button> <button class="row-action row-action--edit" onclick="restoreRemovedMember('${escapeHtml(row.archive_id)}')">Restore</button></td></tr>`).join("")}</tbody></table>`;
}

async function viewRemovedDetails(archiveId) {
  const res = await apiRequest("getRemovedDetails", { archive_id: archiveId });
  if (!res.ok) return showToast(res.message || "Unable to load archive.", "error");
  const archive = res.archive;
  const parsed = JSON.parse(archive.archive_json || "{}");
  const container = document.getElementById("viewDetailsContainer");
  container.innerHTML = `<div class="view-item full"><small>Archive</small><strong>${escapeHtml(archive.archive_id)}</strong></div><div class="view-item full"><small>Removed Member</small><strong>${escapeHtml(archive.member_name)} — ${escapeHtml(archive.roll_number)}</strong></div>` + Object.entries(parsed).map(([table, records]) => `<div class="view-item full"><small>${escapeHtml(table)}</small><strong>${escapeHtml(JSON.stringify(records, null, 2))}</strong></div>`).join("");
  document.getElementById("viewModal").classList.add("show");
  document.body.classList.add("modal-open");
}

async function restoreRemovedMember(archiveId) {
  if (!confirm("Restore every archived record for this member?")) return;
  const res = await apiRequest("restoreMember", { archive_id: archiveId });
  if (res.ok) { showToast("Complete member data restored.", "success"); await loadAllData(); await loadRemovedMembers(); }
  else showToast(res.message || "Restore failed.", "error");
}


/**
 * Add New Admin Account
 */
async function saveNewAdmin(e) {
  e.preventDefault();
  const user = document.getElementById("newAdminUser").value.trim();
  const pass = document.getElementById("newAdminPass").value;
  const email = document.getElementById("newAdminEmail").value.trim();
  const saveBtn = document.getElementById("saveAdminBtn");

  saveBtn.disabled = true;
  showToast("Creating administrator credentials...", "info");

  const res = await apiRequest("createAdmin", { username: user, password: pass, email });

  saveBtn.disabled = false;
  if (res.ok) {
    showToast("Admin account created!", "success");
    closeAddAdminModal();
    document.getElementById("newAdminUser").value = "";
    document.getElementById("newAdminPass").value = "";
    document.getElementById("newAdminEmail").value = "";
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


document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("adminOtpForm")?.addEventListener("submit", verifyAdminOtp);
  document.getElementById("adminForgotPasswordButton")?.addEventListener("click", async () => {
    const username = document.getElementById("adminUser")?.value.trim();
    if (!username) return showToast("Enter your admin username first.", "error");
    const res = await apiRequest("forgotPassword", { username });
    if (res.ok && res.challenge) {
      pendingAdminOtpChallenge = res.challenge;
      document.getElementById("adminOtpModal").classList.add("show");
      document.body.classList.add("modal-open");
      document.getElementById("adminOtpForm").dataset.resetMode = "true";
      showToast("Password reset OTP sent.", "info");
    } else {
      showToast(res.message || "Unable to start password recovery.", "error");
    }
  });
});


document.addEventListener("DOMContentLoaded", () => { const year = document.getElementById("footerYear"); if (year) year.textContent = new Date().getFullYear(); });
