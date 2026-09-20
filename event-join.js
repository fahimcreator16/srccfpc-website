/**
 * Shared protected-form runtime.
 * Replace SRCCFPC_API_URL with the deployed Apps Script /exec URL.
 */

const SRCCFPC_API_URL = "https://script.google.com/macros/s/AKfycbyRrT4TS8ZrvNqw_WzO8T1ll96YMr9aUTY2KfA7h7Jija3uaGx1ZTptSXDWp8fRAfcPjg/exec";

/**
 * Returns the current protected token.
 * @returns {string} Session token.
 */
function getSessionToken() {
  return localStorage.getItem("srccfpc_token") ||
    localStorage.getItem("srccfpc_admin_token") || "";
}

/**
 * Shows a toast.
 * @param {string} message Message.
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
 * Converts a small browser File to base64.
 * @param {File} file Selected file.
 * @returns {Promise<string>} Base64 payload.
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Unable to read selected file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Sends a backend request.
 * @param {string} action API action.
 * @param {Object} data Payload.
 * @returns {Promise<Object>} Parsed response.
 */
async function apiRequest(action, data) {
  const response = await fetch(SRCCFPC_API_URL, {
    method: "POST",
    headers: {"Content-Type": "text/plain;charset=utf-8"},
    body: JSON.stringify({
      action,
      data,
      token: getSessionToken()
    })
  });

  const result = await response.json();
  if (!result.ok) throw new Error(result.message || "Request failed.");
  return result;
}

/**
 * Collects form controls, checkboxes, and optional file data.
 * @param {HTMLFormElement} form Form.
 * @returns {Promise<Object>} JSON-ready payload.
 */
async function collectFormData(form) {
  const payload = {};
  const formData = new FormData(form);

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      if (!value.name) continue;

      if (value.size > 10 * 1024 * 1024) {
        const driveField = form.querySelector('input[name$="_drive_link"]');
        if (!driveField || !driveField.value.trim()) {
          throw new Error("This file is over 10 MB. Provide a Google Drive link instead.");
        }
        continue;
      }

      payload.file_name = value.name;
      payload.file_type = value.type || "application/octet-stream";
      payload.file_data = await fileToBase64(value);
      continue;
    }

    if (payload[key] === undefined) payload[key] = value;
    else if (Array.isArray(payload[key])) payload[key].push(value);
    else payload[key] = [payload[key], value];
  }

  return payload;
}

/**
 * Initializes the protected form.
 * @returns {void}
 */
function initializeProtectedForm() {

  if (!getSessionToken()) {
    window.location.href = `login.html?next=${encodeURIComponent(location.pathname.split("/").pop())}`;
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
    location.href = "login.html";
  });

  const form = document.querySelector("form[data-api]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');

    try {
      button?.classList.add("is-loading");
      const result = await apiRequest(form.dataset.api, await collectFormData(form));
      showToast(result.message || "Submission successful.");
      form.reset();
    } catch (error) {
      showToast(error.message);
    } finally {
      button?.classList.remove("is-loading");
    }
  });
}

document.addEventListener("DOMContentLoaded", initializeProtectedForm);
