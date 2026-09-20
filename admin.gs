/**
 * ================================================================
 * SRCCFPC MASTER GOOGLE APPS SCRIPT BACKEND
 * ================================================================
 * IMPORTANT:
 * 1. This is the ONLY .gs file in this package that contains
 *    executable backend functions.
 * 2. All other page-specific .gs files are documentation/module
 *    markers only. This prevents duplicate doPost()/helper conflicts
 *    when the files are pasted into one Apps Script project.
 *
 * BEFORE DEPLOYMENT:
 * - CONFIG.SPREADSHEET_ID: paste your Google Spreadsheet ID.
 * - CONFIG.ADMIN_EMAIL: paste the admin notification email address.
 * - CONFIG.WEB_APP_URL: paste the deployed Apps Script Web App URL.
 * - CONFIG.SERVER_PEPPER: replace with your own long random secret.
 * - CONFIG.DRIVE_FOLDER_ID: optional Drive folder for <=10 MB uploads.
 *
 * SECURITY:
 * - Passwords are stored as SHA-256 + server pepper hashes.
 * - Sessions are opaque server-side cache tokens.
 * - Admin actions require an active admin session.
 * - Record updates/deletes use table primary keys, not client row
 *   numbers, so row movement does not silently target another record.
 * - Roll Number is the relational member key.
 */

/* ----------------------------- Configuration ----------------------------- */

const CONFIG = {
  SPREADSHEET_ID: "1vwFWisEsvtiTJ_VjrCLmIgkrMNxG125qRkdI8BE-xGI",

  // TODO: Replace with the real admin email that should receive alerts.
  ADMIN_EMAIL: "fahim.creator.16@gmail.com",
  // Server-side bootstrap administrator. These values are never sent to the browser.
  BOOTSTRAP_ADMIN_USERNAME: "fahim_admin_16",
  BOOTSTRAP_ADMIN_PASSWORD: "apon0016@",


  // TODO: Replace with the deployed Apps Script Web App /exec URL.
  WEB_APP_URL: "paste",

  // TODO: Replace this sample with a long random server-only secret.
  SERVER_PEPPER: "agVTbVYtlvR8qA-SS8tcKN8q_Dqk175kOtg4RI97UwQjlS8wljGgSYx2Uuvapgjg",
  // Temporary migration support for records created by the previous package.
  LEGACY_SERVER_PEPPER: "CHANGE_THIS_TO_A_LONG_RANDOM_SERVER_SECRET",

  // Optional. Leave empty to store file metadata without Drive upload.
  DRIVE_FOLDER_ID: "",

  TIME_ZONE: "Asia/Dhaka",
  SESSION_TTL_SECONDS: 21600,
  ADMIN_ROLE: "admin",
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,

  // Public PDF source used as the approval reference/digitalization source.
  APPROVAL_PDF_SOURCE_URL: "https://files.catbox.moe/spjdg1.pdf",
  // Optional Drive folder for archiving the approval PDF source. Leave empty to skip archiving.
  PDF_ARCHIVE_FOLDER_ID: ""
};

const TABLES = {
  JOINING: "Joining Process Table",
  AUTH: "Login Details Table",
  PROFILE: "Personal Details Table",
  ADMIN: "Admin Details Table",
  INTEREST: "Interested Panel Details Table",
  REPORT: "Report Table",
  TASK: "Task Receive Table",
  EVENT: "Event Join Details Table",
  RESPONSE: "Response Table",
  DEVICE: "Device Details Table",
  LOG: "Log Sheet Details Table",
  REJOIN: "Rejoin Table"
};

const SCHEMAS = {
  [TABLES.JOINING]: [
    "id", "timestamp", "roll_number", "username", "password_hash",
    "full_name", "email", "phone_number", "department_stream",
    "section", "collegeId", "bloodGroup", "gender", "dob", "address",
    "facebook", "whyJoin", "payment_trx_id", "payment_method",
    "sender_number", "verification_status"
  ],

  [TABLES.AUTH]: [
    "id", "roll_number", "username", "password_hash", "status", "role"
  ],

  [TABLES.PROFILE]: [
    "profile_id", "roll_number", "full_name", "email", "phone_number",
    "department_stream", "section", "collegeId", "bloodGroup", "gender",
    "dob", "address", "facebook", "whyJoin", "payment_trx_id",
    "payment_method", "sender_number", "verification_status", "joined_at"
  ],

  [TABLES.ADMIN]: [
    "admin_id", "username", "password_hash", "created_at", "status"
  ],

  [TABLES.INTEREST]: [
    "id", "timestamp", "roll_number", "full_name", "mobile_number",
    "panel", "skill_level", "reason", "status"
  ],

  [TABLES.REPORT]: [
    "id", "timestamp", "roll_number", "full_name", "category", "details",
    "status"
  ],

  [TABLES.TASK]: [
    "id", "timestamp", "roll_number", "full_name", "task_file_name",
    "task_file_url", "task_drive_link", "notes", "status"
  ],

  [TABLES.EVENT]: [
    "id", "timestamp", "roll_number", "full_name", "event_name",
    "segment", "experience", "status"
  ],

  [TABLES.RESPONSE]: [
    "id", "timestamp", "roll_number", "full_name", "topic", "outcome",
    "presentation_file_name", "presentation_file_url",
    "presentation_drive_link", "status"
  ],

  [TABLES.DEVICE]: [
    "id", "timestamp", "roll_number", "full_name", "phone",
    "operating_system", "phone_company", "phone_model", "status"
  ],

  [TABLES.LOG]: [
    "id", "timestamp", "roll_number", "item", "location", "custodian",
    "action", "notes", "status"
  ],

  [TABLES.REJOIN]: [
    "id", "timestamp", "roll_number", "full_name", "reason", "status"
  ]
};

const PRIMARY_KEYS = {
  [TABLES.JOINING]: "id",
  [TABLES.AUTH]: "id",
  [TABLES.PROFILE]: "profile_id",
  [TABLES.ADMIN]: "admin_id",
  [TABLES.INTEREST]: "id",
  [TABLES.REPORT]: "id",
  [TABLES.TASK]: "id",
  [TABLES.EVENT]: "id",
  [TABLES.RESPONSE]: "id",
  [TABLES.DEVICE]: "id",
  [TABLES.LOG]: "id",
  [TABLES.REJOIN]: "id"
};

/* ----------------------------- Core Helpers ----------------------------- */

/**
 * Opens the configured spreadsheet.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} Spreadsheet instance.
 */
function getSpreadsheet_() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID.indexOf("PASTE_") === 0) {
    throw new Error("CONFIG.SPREADSHEET_ID is not configured.");
  }
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Returns a sheet by its exact relational table name.
 * @param {string} sheetName Sheet name.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} Sheet instance.
 */
function getSheet_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Missing sheet: " + sheetName + ". Run setupDatabase() first.");
  }
  return sheet;
}

/**
 * Reads a sheet's first row as normalized header strings.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Target sheet.
 * @returns {string[]} Header names.
 */
function getHeaders_(sheet) {
  if (sheet.getLastColumn() < 1) {
    return [];
  }
  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function(header) {
      return String(header).trim();
    });
}

/**
 * Ensures all required schema columns exist without destroying data.
 * @returns {void}
 */
function setupDatabase() {
  const spreadsheet = getSpreadsheet_();

  Object.keys(SCHEMAS).forEach(function(sheetName) {
    let sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }

    let headers = getHeaders_(sheet);

    if (headers.length === 0) {
      sheet.getRange(1, 1, 1, SCHEMAS[sheetName].length)
        .setValues([SCHEMAS[sheetName]]);
      headers = SCHEMAS[sheetName].slice();
    }

    SCHEMAS[sheetName].forEach(function(requiredHeader) {
      if (headers.indexOf(requiredHeader) === -1) {
        const nextColumn = sheet.getLastColumn() + 1;
        sheet.getRange(1, nextColumn).setValue(requiredHeader);
        headers.push(requiredHeader);
      }
    });

    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .setFontWeight("bold")
      .setBackground("#08111f")
      .setFontColor("#56dcff");
  });

  createDefaultAdminIfMissing_();

  SpreadsheetApp.getUi().alert(
    "SRCCFPC database setup complete. All required tables and columns are ready."
  );
}

/**
 * Creates the first admin only when no active admin exists.
 * @returns {void}
 */
function createDefaultAdminIfMissing_() {
  const username = CONFIG.BOOTSTRAP_ADMIN_USERNAME;
  const passwordHash = hashPassword_(CONFIG.BOOTSTRAP_ADMIN_PASSWORD);
  const sheet = getSheet_(TABLES.ADMIN);
  const rows = getAllRows_(TABLES.ADMIN);

  const existing = rows.find(function(row) {
    return String(row.username || "").trim().toLowerCase() ===
      String(username).trim().toLowerCase();
  });

  if (existing) {
    // Keep the bootstrap administrator active and synchronize its hash.
    // This repairs old/incompatible admin rows without touching other admins.
    const headers = getHeaders_(sheet);
    const passwordColumn = headers.indexOf("password_hash") + 1;
    const statusColumn = headers.indexOf("status") + 1;

    if (passwordColumn > 0) {
      sheet.getRange(existing._rowNumber, passwordColumn).setValue(passwordHash);
    }
    if (statusColumn > 0) {
      sheet.getRange(existing._rowNumber, statusColumn).setValue("active");
    }
    return;
  }

  appendRecord_(TABLES.ADMIN, {
    admin_id: uuid_(),
    username: username,
    password_hash: passwordHash,
    created_at: timestamp_(),
    status: "active"
  });
}

/**
 * Returns every data row with its current spreadsheet row number.
 * @param {string} sheetName Table name.
 * @returns {Object[]} Row objects.
 */
function getAllRows_(sheetName) {
  const sheet = getSheet_(sheetName);
  const headers = getHeaders_(sheet);

  if (sheet.getLastRow() < 2) {
    return [];
  }

  const values = sheet.getRange(
    2,
    1,
    sheet.getLastRow() - 1,
    sheet.getLastColumn()
  ).getValues();

  return values.map(function(row, index) {
    const record = {
      _rowNumber: index + 2
    };

    headers.forEach(function(header, columnIndex) {
      record[header] = row[columnIndex];
    });

    return record;
  });
}

/**
 * Appends a record according to the target table's header order.
 * @param {string} sheetName Table name.
 * @param {Object} record Record data.
 * @returns {number} New row number.
 */
function appendRecord_(sheetName, record) {
  const sheet = getSheet_(sheetName);
  const headers = getHeaders_(sheet);

  const row = headers.map(function(header) {
    return record[header] === undefined ? "" : record[header];
  });

  sheet.appendRow(row);
  return sheet.getLastRow();
}

/**
 * Updates one or more cells on a known spreadsheet row.
 * @param {string} sheetName Target table.
 * @param {number} rowNumber Current spreadsheet row.
 * @param {Object} updates Header/value pairs.
 * @returns {void}
 */
function updateRecordByRow_(sheetName, rowNumber, updates) {
  const sheet = getSheet_(sheetName);
  const headers = getHeaders_(sheet);

  Object.keys(updates || {}).forEach(function(header) {
    const column = headers.indexOf(header) + 1;
    if (column > 0) {
      sheet.getRange(rowNumber, column).setValue(updates[header]);
    }
  });
}

/**
 * Finds one record by a primary-key value.
 * @param {string} sheetName Table name.
 * @param {string} keyValue Primary key value.
 * @returns {Object|null} Matching row or null.
 */
function findByPrimaryKey_(sheetName, keyValue) {
  const primaryKey = PRIMARY_KEYS[sheetName];

  if (!primaryKey) {
    throw new Error("No primary key is configured for " + sheetName + ".");
  }

  return getAllRows_(sheetName).find(function(row) {
    return String(row[primaryKey]).trim() === String(keyValue).trim();
  }) || null;
}

/**
 * Creates a Dhaka-time timestamp.
 * @returns {string} Formatted timestamp.
 */
function timestamp_() {
  return Utilities.formatDate(
    new Date(),
    CONFIG.TIME_ZONE,
    "yyyy-MM-dd HH:mm:ss"
  );
}

/**
 * Creates a UUID.
 * @returns {string} UUID.
 */
function uuid_() {
  return Utilities.getUuid();
}

/**
 * Hashes a password with the server-only pepper.
 * @param {string} password Plain password received over HTTPS.
 * @returns {string} Base64 SHA-256 digest.
 */
function hashPassword_(password, pepperOverride) {
  const material = String(password) +
    (pepperOverride === undefined ? CONFIG.SERVER_PEPPER : pepperOverride);

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    material,
    Utilities.Charset.UTF_8
  );

  return Utilities.base64Encode(digest);
}

/**
 * Normalizes a Bangladeshi mobile number to +880XXXXXXXXXX.
 * @param {string} phone Raw phone input.
 * @returns {string} Normalized phone string.
 */
function normalizePhone_(phone) {
  let digits = String(phone || "").replace(/[^\d]/g, "");

  if (digits.indexOf("880") === 0) {
    digits = digits.substring(3);
  }

  if (digits.indexOf("0") === 0) {
    digits = digits.substring(1);
  }

  if (!digits) {
    return "";
  }

  return "+880" + digits;
}

/**
 * Creates a JSON HTTP response.
 * @param {Object} payload Response object.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Creates an opaque server-side session.
 * @param {Object} user Sanitized user identity.
 * @returns {string} Session token.
 */
function createSession_(user) {
  const token = uuid_();

  CacheService.getScriptCache().put(
    "session_" + token,
    JSON.stringify(user),
    CONFIG.SESSION_TTL_SECONDS
  );

  return token;
}

/**
 * Validates a session token.
 * @param {string} token Session token.
 * @returns {Object} Authenticated user.
 */
function requireSession_(token) {
  if (!token) {
    throw new Error("Authentication required.");
  }

  const raw = CacheService
    .getScriptCache()
    .get("session_" + token);

  if (!raw) {
    throw new Error("Session expired. Please log in again.");
  }

  return JSON.parse(raw);
}

/**
 * Requires a current admin session and rechecks the Admin Details Table.
 * @param {string} token Session token.
 * @returns {Object} Authenticated admin.
 */
function requireAdmin_(token) {
  const user = requireSession_(token);

  if (user.role !== CONFIG.ADMIN_ROLE) {
    throw new Error("Administrator access required.");
  }

  const admin = getAllRows_(TABLES.ADMIN).find(function(row) {
    return String(row.admin_id).trim() === String(user.admin_id).trim()
      && String(row.status).toLowerCase() === "active";
  });

  if (!admin) {
    throw new Error("Admin account is no longer active.");
  }

  return user;
}

/* ----------------------------- Validation ----------------------------- */

/**
 * Requires non-empty fields.
 * @param {Object} data Input object.
 * @param {string[]} fields Required field names.
 * @returns {void}
 */
function requireFields_(data, fields) {
  fields.forEach(function(field) {
    if (data[field] === undefined || String(data[field]).trim() === "") {
      throw new Error("Required field missing: " + field);
    }
  });
}

/**
 * Validates a roll number.
 * @param {string} rollNumber Roll number.
 * @returns {string} Clean roll number.
 */
function validateRoll_(rollNumber) {
  const value = String(rollNumber || "").trim();

  if (!/^[A-Za-z0-9_-]{1,30}$/.test(value)) {
    throw new Error("Invalid roll number format.");
  }

  return value;
}

/**
 * Validates a file payload and optionally stores it in Drive.
 * @param {Object} data Request object.
 * @param {string} filePrefix File name prefix.
 * @returns {Object} Stored file metadata.
 */
function processOptionalFile_(data, filePrefix) {
  const fileData = String(data.file_data || "");

  if (!fileData) {
    return {
      file_name: "",
      file_url: ""
    };
  }

  const fileBytes = Utilities.base64Decode(fileData);
  if (fileBytes.length > CONFIG.MAX_UPLOAD_BYTES) {
    throw new Error(
      "File exceeds 10 MB. Please upload it to Google Drive and submit the Drive link instead."
    );
  }

  if (!CONFIG.DRIVE_FOLDER_ID) {
    return {
      file_name: String(data.file_name || filePrefix),
      file_url: ""
    };
  }

  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const safeName = String(data.file_name || filePrefix)
    .replace(/[^\w.\- ]/g, "_")
    .substring(0, 180);

  const blob = Utilities.newBlob(
    fileBytes,
    String(data.file_type || "application/octet-stream"),
    safeName
  );

  const file = folder.createFile(blob);

  return {
    file_name: file.getName(),
    file_url: file.getUrl()
  };
}

/* ----------------------------- Email Notifications ----------------------------- */

/**
 * Sends a formatted admin notification for every new submission.
 * @param {string} formName Human-readable form name.
 * @param {Object} details Submitted record details.
 * @returns {void}
 */
function notifyAdmin_(formName, details) {
  if (!CONFIG.ADMIN_EMAIL || CONFIG.ADMIN_EMAIL.indexOf("PASTE_") === 0) {
    console.warn("ADMIN_EMAIL is not configured; notification skipped.");
    return;
  }

  const lines = Object.keys(details).map(function(key) {
    return key + ": " + String(details[key] === undefined ? "" : details[key]);
  });

  const subject = "[SRCCFPC] New " + formName + " submission";
  const body = [
    "SRCC Film & Photography Club",
    "----------------------------------------",
    "New submission received: " + formName,
    "Timestamp: " + timestamp_(),
    "",
    lines.join("\n"),
    "",
    "Web App: " + CONFIG.WEB_APP_URL
  ].join("\n");

  try {
    MailApp.sendEmail({
      to: CONFIG.ADMIN_EMAIL,
      subject: subject,
      body: body
    });
  } catch (error) {
    console.error("Admin notification email failed:", error);
  }
}

/**
 * Sends a member account activation email.
 * @param {string} email Recipient email.
 * @param {string} fullName Member name.
 * @param {string} username Username.
 * @returns {void}
 */
function sendActivationEmail_(email, fullName, username) {
  if (!email) {
    throw new Error("Member email address is missing.");
  }

  const name = escapeHtml_(fullName || "Member");
  const safeUsername = escapeHtml_(username || "");
  const sourceUrl = escapeHtml_(CONFIG.APPROVAL_PDF_SOURCE_URL || "");

  const htmlBody =
    '<div style="margin:0;background:#03050a;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#f4f8ff;">' +
      '<div style="max-width:620px;margin:0 auto;background:#08111f;border:1px solid rgba(86,220,255,.35);border-radius:22px;padding:30px;">' +
        '<div style="text-align:center;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:22px;">' +
          '<img src="https://files.catbox.moe/vl3wpi.png" alt="SRCCFPC" style="width:76px;height:auto;">' +
          '<h1 style="margin:14px 0 5px;color:#56dcff;font-size:24px;">SRCC FILM &amp; PHOTOGRAPHY CLUB</h1>' +
          '<p style="margin:0;color:#5fffc1;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Membership Activated</p>' +
        '</div>' +
        '<div style="padding:26px 0;line-height:1.7;">' +
          '<h2 style="margin:0 0 12px;font-size:21px;color:#fff;">Welcome to the SRCCFPC Family, ' + name + '!</h2>' +
          '<p style="margin:0 0 18px;color:#c4d0df;font-size:14px;">Welcome to SRCCFPC family. Your account has been activated successfully. You can now log in and access all member features.</p>' +
          '<div style="background:rgba(86,220,255,.06);border:1px solid rgba(86,220,255,.22);border-radius:14px;padding:16px;">' +
            '<p style="margin:4px 0;font-size:13px;"><strong>Username:</strong> ' + safeUsername + '</p>' +
            '<p style="margin:4px 0;font-size:13px;"><strong>Status:</strong> <span style="color:#5fffc1;">ACTIVE</span></p>' +
          '</div>' +
          (sourceUrl ? '<p style="margin:20px 0 0;font-size:12px;color:#91a1b6;">Digital reference source: <a href="' + sourceUrl + '" style="color:#56dcff;">Approval PDF</a></p>' : '') +
        '</div>' +
        '<div style="border-top:1px solid rgba(255,255,255,.1);padding-top:18px;text-align:center;color:#718197;font-size:11px;">SRCC Film &amp; Photography Club</div>' +
      '</div>' +
    '</div>';

  MailApp.sendEmail({
    to: email,
    subject: "Welcome to the SRCCFPC Family!",
    body: "Welcome to SRCCFPC family. Your account has been activated successfully. You can now log in and access all member features.",
    htmlBody: htmlBody
  });
}

/**
 * Validates and optionally archives the configured approval PDF source.
 * The source is not attached to the email because large PDF attachments can
 * exceed Gmail/MailApp message limits; the source URL is included in the email.
 * @returns {Object} PDF source metadata.
 */
function ingestApprovalPdfSource_() {
  const url = String(CONFIG.APPROVAL_PDF_SOURCE_URL || "").trim();
  if (!url) {
    return { configured: false, url: "", archived: false };
  }

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true,
      followRedirects: true
    });

    const status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      throw new Error("Approval PDF source returned HTTP " + status + ".");
    }

    const blob = response.getBlob();
    let archivedFileUrl = "";

    if (CONFIG.PDF_ARCHIVE_FOLDER_ID) {
      const folder = DriveApp.getFolderById(CONFIG.PDF_ARCHIVE_FOLDER_ID);
      const existing = folder.getFilesByName("SRCCFPC Approval Reference.pdf");
      if (existing.hasNext()) {
        archivedFileUrl = existing.next().getUrl();
      } else {
        blob.setName("SRCCFPC Approval Reference.pdf");
        archivedFileUrl = folder.createFile(blob).getUrl();
      }
    }

    return {
      configured: true,
      url: url,
      contentType: blob.getContentType(),
      sizeBytes: blob.getBytes().length,
      archived: Boolean(archivedFileUrl),
      archivedFileUrl: archivedFileUrl
    };
  } catch (error) {
    console.warn("Approval PDF ingestion failed: " + error.message);
    return {
      configured: true,
      url: url,
      archived: false,
      error: error.message
    };
  }
}

/**
 * Escapes HTML email content.
 * @param {string} value Raw value.
 * @returns {string} Escaped value.
 */
function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ----------------------------- HTTP Router ----------------------------- */

/**
 * Health-check endpoint.
 * @returns {GoogleAppsScript.Content.TextOutput} API status.
 */
function doGet() {
  return jsonResponse_({
    ok: true,
    service: "SRCCFPC Master API",
    status: "online",
    timestamp: timestamp_()
  });
}

/**
 * Main JSON API router.
 * @param {GoogleAppsScript.Events.DoPost} event Apps Script POST event.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doPost(event) {
  try {
    const request = JSON.parse(
      event && event.postData ? event.postData.contents || "{}" : "{}"
    );

    const action = String(request.action || "");
    const data = request.data || {};
    const token = request.token || "";

    let result;

    switch (action) {
      case "join":
        result = submitJoin_(data);
        break;

      case "login":
        result = authenticateUser_(data);
        break;

      case "session":
        result = getSessionIdentity_(token);
        break;

      case "adminLogin":
        result = adminLogin_(data);
        break;

      case "profile":
        result = getMemberProfile_(token);
        break;

      case "approveJoin":
        result = approveJoin_(data, token);
        break;

      case "rejectJoin":
        result = rejectJoin_(data, token);
        break;

      case "listPending":
        result = listPending_(token);
        break;

      case "listMembers":
        result = listMembers_(token);
        break;

      case "listAdmins":
        result = listAdmins_(token);
        break;

      case "createAdmin":
        result = createAdmin_(data, token);
        break;

      case "getTable":
        result = getAdminTable_(data, token);
        break;

      case "getAllTables":
        result = getAllTables_(token);
        break;

      case "updateRecord":
        result = updateAdminRecord_(data, token);
        break;

      case "deleteRecord":
        result = deleteAdminRecord_(data, token);
        break;

      case "submitLogSheet":
        result = submitLogSheet_(data, token);
        break;

      case "interestedPanel":
      case "interReport":
      case "task":
      case "eventJoin":
      case "responend":
      case "devicesForm":
      case "rejoin":
        result = handleProtectedForm_(action, data, token);
        break;

      default:
        throw new Error("Unknown API action: " + action);
    }

    return jsonResponse_({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      ok: false,
      message: error.message || "Backend request failed."
    });
  }
}


/**
 * Returns the authenticated identity after validating the server-side session.
 * @param {string} token Opaque session token.
 * @returns {Object} Sanitized identity.
 */
function getSessionIdentity_(token) {
  const user = requireSession_(token);

  if (user.role === CONFIG.ADMIN_ROLE) {
    requireAdmin_(token);
  }

  return { user: user };
}

/* ----------------------------- Authentication ----------------------------- */

/**
 * Authenticates a normal member and creates a server session.
 * @param {Object} data Login payload.
 * @returns {Object} Session and sanitized user.
 */
function authenticateUser_(data) {
  requireFields_(data, ["username", "password"]);

  const auth = getAllRows_(TABLES.AUTH).find(function(row) {
    return String(row.username).trim().toLowerCase() ===
      String(data.username).trim().toLowerCase();
  });

  if (!auth || String(auth.status).toLowerCase() !== "active") {
    throw new Error("Invalid username or inactive account.");
  }

  const currentHash = hashPassword_(data.password);
  const legacyHash = hashPassword_(data.password, CONFIG.LEGACY_SERVER_PEPPER);

  if (String(auth.password_hash) !== currentHash &&
      String(auth.password_hash) !== legacyHash) {
    throw new Error("Invalid username or password.");
  }

  // Migrate legacy hashes to the current server pepper after a successful login.
  if (String(auth.password_hash) === legacyHash) {
    updateRecordByRow_(TABLES.AUTH, auth._rowNumber, {
      password_hash: currentHash
    });
  }

  const profile = getAllRows_(TABLES.PROFILE).find(function(row) {
    return String(row.roll_number).trim() === String(auth.roll_number).trim();
  });

  const user = {
    roll_number: auth.roll_number,
    username: auth.username,
    role: String(auth.role || "member").toLowerCase() === CONFIG.ADMIN_ROLE ? "member" : (auth.role || "member"),
    full_name: profile ? profile.full_name : "",
    email: profile ? profile.email : ""
  };

  return {
    message: "Login successful.",
    token: createSession_(user),
    user: user
  };
}

/**
 * Authenticates an administrator against the Admin Details Table.
 * @param {Object} data Login payload.
 * @returns {Object} Admin session.
 */
function adminLogin_(data) {
  requireFields_(data, ["username", "password"]);

  const username = String(data.username || "").trim();
  const password = String(data.password || "");
  const passwordHash = hashPassword_(password);

  let admin = getAllRows_(TABLES.ADMIN).find(function(row) {
    return String(row.username || "").trim().toLowerCase() ===
      username.toLowerCase()
      && String(row.password_hash || "") === passwordHash
      && String(row.status || "").toLowerCase() === "active";
  });

  // Server-only bootstrap recovery. The credential is never exposed to frontend code.
  if (!admin &&
      username.toLowerCase() === CONFIG.BOOTSTRAP_ADMIN_USERNAME.toLowerCase() &&
      password === CONFIG.BOOTSTRAP_ADMIN_PASSWORD) {
    createDefaultAdminIfMissing_();
    admin = getAllRows_(TABLES.ADMIN).find(function(row) {
      return String(row.username || "").trim().toLowerCase() === username.toLowerCase()
        && String(row.status || "").toLowerCase() === "active";
    });
  }

  if (!admin) {
    throw new Error("Invalid admin credentials.");
  }

  const user = {
    admin_id: admin.admin_id,
    username: admin.username,
    role: CONFIG.ADMIN_ROLE
  };

  return {
    message: "Admin authentication successful.",
    token: createSession_(user),
    user: user
  };
}

/* ----------------------------- Join Workflow ----------------------------- */

/**
 * Creates a pending membership application.
 * @param {Object} data Application payload.
 * @returns {Object} Application result.
 */
function submitJoin_(data) {
  requireFields_(data, [
    "username",
    "roll_number",
    "password",
    "full_name",
    "email",
    "phone_number",
    "department_stream",
    "payment_trx_id",
    "payment_method",
    "sender_number"
  ]);

  const roll = validateRoll_(data.roll_number);

  if (getAllRows_(TABLES.AUTH).some(function(row) {
    return String(row.roll_number).trim() === roll;
  })) {
    throw new Error("This roll number already has an account.");
  }

  if (getAllRows_(TABLES.JOINING).some(function(row) {
    return String(row.roll_number).trim() === roll
      && String(row.verification_status).toLowerCase() === "pending";
  })) {
    throw new Error("A pending application already exists.");
  }

  if (getAllRows_(TABLES.AUTH).some(function(row) {
    return String(row.username).trim().toLowerCase() ===
      String(data.username).trim().toLowerCase();
  })) {
    throw new Error("This username is already in use.");
  }

  const record = {
    id: uuid_(),
    timestamp: timestamp_(),
    roll_number: "'" + roll,
    username: String(data.username).trim(),
    password_hash: hashPassword_(data.password),
    full_name: String(data.full_name).trim(),
    email: String(data.email).trim(),
    phone_number: normalizePhone_(data.phone_number),
    department_stream: String(data.department_stream).trim(),
    section: data.section || "",
    collegeId: data.collegeId || "",
    bloodGroup: data.bloodGroup || "",
    gender: data.gender || "",
    dob: data.dob || "",
    address: data.address || "",
    facebook: data.facebook || "",
    whyJoin: data.whyJoin || "",
    payment_trx_id: String(data.payment_trx_id).trim(),
    payment_method: String(data.payment_method).trim(),
    sender_number: normalizePhone_(data.sender_number),
    verification_status: "pending"
  };

  appendRecord_(TABLES.JOINING, record);

  notifyAdmin_("Membership / Join Form", record);

  return {
    message: "Application submitted successfully.",
    application_id: record.id,
    status: "pending"
  };
}

/**
 * Lists pending membership applications for an admin.
 * @param {string} token Admin session token.
 * @returns {Object} Pending records.
 */
function listPending_(token) {
  requireAdmin_(token);

  return {
    pending: getAllRows_(TABLES.JOINING).filter(function(row) {
      return String(row.verification_status).toLowerCase() === "pending";
    })
  };
}

/**
 * Approves one application and provisions Auth + Profile rows.
 * @param {Object} data Approval payload.
 * @param {string} token Admin session token.
 * @returns {Object} Result.
 */
function approveJoin_(data, token) {
  requireAdmin_(token);
  requireFields_(data, ["application_id"]);

  const pending = findByPrimaryKey_(TABLES.JOINING, data.application_id);
  if (!pending) {
    throw new Error("Application not found.");
  }

  return approveJoinCore_(pending);
}

/**
 * Shared membership approval implementation for the admin panel and Sheet trigger.
 * @param {Object} pending Pending joining record.
 * @returns {Object} Approval result.
 */
function approveJoinCore_(pending) {
  if (String(pending.verification_status).toLowerCase() === "approved") {
    return { message: "Application is already approved." };
  }

  const roll = String(pending.roll_number).trim();
  if (getAllRows_(TABLES.AUTH).some(function(row) {
    return String(row.roll_number).trim() === roll;
  })) {
    throw new Error("An Auth record already exists for this roll number.");
  }

  appendRecord_(TABLES.AUTH, {
    id: uuid_(),
    roll_number: "'" + roll,
    username: pending.username,
    password_hash: pending.password_hash,
    status: "active",
    role: "member"
  });

  appendRecord_(TABLES.PROFILE, {
    profile_id: uuid_(),
    roll_number: "'" + roll,
    full_name: pending.full_name,
    email: pending.email,
    phone_number: pending.phone_number,
    department_stream: pending.department_stream,
    section: pending.section,
    collegeId: pending.collegeId,
    bloodGroup: pending.bloodGroup,
    gender: pending.gender,
    dob: pending.dob,
    address: pending.address,
    facebook: pending.facebook,
    whyJoin: pending.whyJoin,
    payment_trx_id: pending.payment_trx_id,
    payment_method: pending.payment_method,
    sender_number: pending.sender_number,
    verification_status: "approved",
    joined_at: timestamp_()
  });

  updateCellByKey_(TABLES.JOINING, pending.id, "verification_status", "approved");

  const pdfSource = ingestApprovalPdfSource_();
  sendActivationEmail_(pending.email, pending.full_name, pending.username);

  notifyAdmin_("Membership Approval", {
    application_id: pending.id,
    roll_number: roll,
    username: pending.username,
    approved_by: "Admin panel / Google Sheet automation",
    pdf_source: pdfSource.url,
    pdf_ingested: pdfSource.configured && !pdfSource.error
  });

  return {
    message: "Application approved and account activated.",
    email_sent: true,
    pdf_source: pdfSource.url
  };
}

/**
 * Rejects an application without creating Auth/Profile rows.
 * @param {Object} data Rejection payload.
 * @param {string} token Admin session token.
 * @returns {Object} Result.
 */
function rejectJoin_(data, token) {
  requireAdmin_(token);
  requireFields_(data, ["application_id"]);

  updateCellByKey_(
    TABLES.JOINING,
    data.application_id,
    "verification_status",
    "rejected"
  );

  const target = findByPrimaryKey_(TABLES.JOINING, data.application_id);
  notifyAdmin_("Membership Rejection", {
    application_id: data.application_id,
    roll_number: target ? target.roll_number : "",
    rejected_by: requireAdmin_(token).username
  });

  if (target && target.email) {
    MailApp.sendEmail({
      to: target.email,
      subject: "SRCCFPC Membership Application Update",
      body:
        "Your membership application could not be approved at this time.\n\n" +
        "Roll Number: " + target.roll_number + "\n\n" +
        "Please contact the club administration for clarification."
    });
  }

  return {
    message: "Application rejected."
  };
}

/* ----------------------------- Member Profile ----------------------------- */

/**
 * Returns the authenticated member profile.
 * @param {string} token Session token.
 * @returns {Object} Profile result.
 */
function getMemberProfile_(token) {
  const user = requireSession_(token);

  const profile = getAllRows_(TABLES.PROFILE).find(function(row) {
    return String(row.roll_number).trim() === String(user.roll_number).trim();
  });

  return {
    user: user,
    profile: profile || null
  };
}

/**
 * Lists active members for administrators.
 * @param {string} token Admin session token.
 * @returns {Object} Member records.
 */
function listMembers_(token) {
  requireAdmin_(token);

  return {
    members: getAllRows_(TABLES.PROFILE).filter(function(row) {
      return String(row.verification_status).toLowerCase() === "approved";
    })
  };
}

/**
 * Lists administrators without password hashes.
 * @param {string} token Admin session token.
 * @returns {Object} Admin list.
 */
function listAdmins_(token) {
  requireAdmin_(token);

  return {
    admins: getAllRows_(TABLES.ADMIN).map(function(row) {
      return {
        admin_id: row.admin_id,
        username: row.username,
        created_at: row.created_at,
        status: row.status
      };
    })
  };
}

/**
 * Creates an administrator account.
 * @param {Object} data Admin data.
 * @param {string} token Admin session token.
 * @returns {Object} Result.
 */
function createAdmin_(data, token) {
  requireAdmin_(token);
  requireFields_(data, ["username", "password"]);

  const username = String(data.username).trim();

  if (getAllRows_(TABLES.ADMIN).some(function(row) {
    return String(row.username).trim().toLowerCase() === username.toLowerCase();
  })) {
    throw new Error("An administrator with this username already exists.");
  }

  appendRecord_(TABLES.ADMIN, {
    admin_id: uuid_(),
    username: username,
    password_hash: hashPassword_(data.password),
    created_at: timestamp_(),
    status: "active"
  });

  notifyAdmin_("New Admin Account", {
    username: username,
    created_by: requireAdmin_(token).username
  });

  return {
    message: "Administrator created successfully."
  };
}

/* ----------------------------- Protected Forms ----------------------------- */

/**
 * Maps each protected action to its relational table.
 * @param {string} action API action.
 * @returns {string} Table name.
 */
function protectedTableForAction_(action) {
  const map = {
    interestedPanel: TABLES.INTEREST,
    interReport: TABLES.REPORT,
    task: TABLES.TASK,
    eventJoin: TABLES.EVENT,
    responend: TABLES.RESPONSE,
    devicesForm: TABLES.DEVICE,
    rejoin: TABLES.REJOIN
  };

  if (!map[action]) {
    throw new Error("Unknown protected form action: " + action);
  }

  return map[action];
}

/**
 * Handles all protected member forms with action-specific validation.
 * @param {string} action Form action.
 * @param {Object} data Form payload.
 * @param {string} token Member session token.
 * @returns {Object} Submission result.
 */
function handleProtectedForm_(action, data, token) {
  const user = requireSession_(token);
  const roll = String(user.roll_number).trim();
  const profile = getAllRows_(TABLES.PROFILE).find(function(row) {
    return String(row.roll_number).trim() === roll;
  });

  const name = data.full_name || (profile ? profile.full_name : "");

  if (action === "interestedPanel") {
    requireFields_(data, [
      "full_name",
      "roll_number",
      "mobile_number",
      "panel",
      "skill_level"
    ]);

    if (String(data.roll_number).trim() !== roll) {
      throw new Error("Roll number does not match the logged-in account.");
    }

    const record = {
      id: uuid_(),
      timestamp: timestamp_(),
      roll_number: "'" + roll,
      full_name: data.full_name,
      mobile_number: normalizePhone_(data.mobile_number),
      panel: data.panel,
      skill_level: data.skill_level,
      reason: data.reason || "",
      status: "submitted"
    };

    appendRecord_(TABLES.INTEREST, record);
    notifyAdmin_("Interested Panel Form", record);
    return { message: "Interested panel application submitted." };
  }

  if (action === "interReport") {
    requireFields_(data, ["full_name", "roll_number", "category", "details"]);

    const categories = Array.isArray(data.category)
      ? data.category.join(", ")
      : String(data.category);

    const record = {
      id: uuid_(),
      timestamp: timestamp_(),
      roll_number: "'" + roll,
      full_name: data.full_name,
      category: categories,
      details: data.details,
      status: "submitted"
    };

    appendRecord_(TABLES.REPORT, record);
    notifyAdmin_("Report Form", record);
    return { message: "Report submitted successfully." };
  }

  if (action === "task") {
    requireFields_(data, ["full_name", "roll_number"]);

    const file = processOptionalFile_(data, "task-file");
    const driveLink = String(data.task_drive_link || "").trim();

    if (!file.file_name && !driveLink && !String(data.notes || "").trim()) {
      throw new Error("Provide a task file, Drive link, or task notes.");
    }

    if (data.file_data && file.file_url === "" && CONFIG.DRIVE_FOLDER_ID === "") {
      throw new Error(
        "Drive upload is not configured. Add DRIVE_FOLDER_ID or provide a Google Drive link."
      );
    }

    const record = {
      id: uuid_(),
      timestamp: timestamp_(),
      roll_number: "'" + roll,
      full_name: data.full_name,
      task_file_name: file.file_name,
      task_file_url: file.file_url,
      task_drive_link: driveLink,
      notes: data.notes || "",
      status: "submitted"
    };

    appendRecord_(TABLES.TASK, record);
    notifyAdmin_("Task Receive Form", record);
    return { message: "Task received successfully." };
  }

  if (action === "eventJoin") {
    requireFields_(data, [
      "full_name",
      "roll_number",
      "event_name",
      "segment"
    ]);

    const record = {
      id: uuid_(),
      timestamp: timestamp_(),
      roll_number: "'" + roll,
      full_name: data.full_name,
      event_name: data.event_name,
      segment: data.segment,
      experience: data.experience || "",
      status: "submitted"
    };

    appendRecord_(TABLES.EVENT, record);
    notifyAdmin_("Event Join Form", record);
    return { message: "Event participation record submitted." };
  }

  if (action === "responend") {
    requireFields_(data, [
      "full_name",
      "roll_number",
      "topic",
      "outcome"
    ]);

    const file = processOptionalFile_(data, "presentation");
    const driveLink = String(data.presentation_drive_link || "").trim();

    const record = {
      id: uuid_(),
      timestamp: timestamp_(),
      roll_number: "'" + roll,
      full_name: data.full_name,
      topic: data.topic,
      outcome: data.outcome,
      presentation_file_name: file.file_name,
      presentation_file_url: file.file_url,
      presentation_drive_link: driveLink,
      status: "submitted"
    };

    appendRecord_(TABLES.RESPONSE, record);
    notifyAdmin_("Responded Form", record);
    return { message: "Response submitted successfully." };
  }

  if (action === "devicesForm") {
    requireFields_(data, [
      "full_name",
      "roll_number",
      "phone",
      "operating_system",
      "phone_company",
      "phone_model"
    ]);

    const operatingSystem = Array.isArray(data.operating_system)
      ? data.operating_system.join(", ")
      : String(data.operating_system);

    const record = {
      id: uuid_(),
      timestamp: timestamp_(),
      roll_number: "'" + roll,
      full_name: data.full_name,
      phone: normalizePhone_(data.phone),
      operating_system: operatingSystem,
      phone_company: data.phone_company,
      phone_model: data.phone_model,
      status: "submitted"
    };

    appendRecord_(TABLES.DEVICE, record);
    notifyAdmin_("Devices Form", record);
    return { message: "Device details saved successfully." };
  }

  if (action === "rejoin") {
    requireFields_(data, ["full_name", "roll_number", "reason"]);

    const record = {
      id: uuid_(),
      timestamp: timestamp_(),
      roll_number: "'" + roll,
      full_name: data.full_name,
      reason: data.reason,
      status: "submitted"
    };

    appendRecord_(TABLES.REJOIN, record);

    const auth = getAllRows_(TABLES.AUTH).find(function(row) {
      return String(row.roll_number).trim() === roll;
    });

    if (auth) {
      updateCellByKey_(TABLES.AUTH, auth.id, "status", "deactivated");
    }

    notifyAdmin_("Rejoin Form", record);
    return { message: "Rejoin request submitted." };
  }

  throw new Error("Unhandled protected form.");
}

/**
 * Stores a Log Sheet record.
 * @param {Object} data Log payload.
 * @param {string} token Member/admin session token.
 * @returns {Object} Submission result.
 */
function submitLogSheet_(data, token) {
  const user = requireSession_(token);

  requireFields_(data, [
    "item",
    "location",
    "custodian",
    "action"
  ]);

  const record = {
    id: uuid_(),
    timestamp: timestamp_(),
    roll_number: "'" + String(data.roll_number || user.roll_number).trim(),
    item: data.item,
    location: data.location,
    custodian: data.custodian,
    action: data.action,
    notes: data.notes || "",
    status: "active"
  };

  appendRecord_(TABLES.LOG, record);
  notifyAdmin_("Lock / Log Sheet", record);

  return {
    message: "Log Sheet record added successfully."
  };
}

/**
 * Finds a usable primary key for any spreadsheet table.
 * @param {string[]} headers Table headers.
 * @returns {string|null} Primary key header or null.
 */
function inferPrimaryKey_(headers) {
  const preferred = [
    "id", "profile_id", "admin_id", "application_id", "record_id",
    "roll_number", "username", "email"
  ];

  for (let i = 0; i < preferred.length; i += 1) {
    if (headers.indexOf(preferred[i]) !== -1) {
      return preferred[i];
    }
  }

  return headers.length ? headers[0] : null;
}

/**
 * Returns every non-empty spreadsheet as an admin workspace.
 * This is intentionally independent of SCHEMAS so newly created sheets
 * become visible without a code change.
 * @param {string} token Admin session token.
 * @returns {Object} Dynamic table map and metadata.
 */
function getAllTables_(token) {
  requireAdmin_(token);

  const spreadsheet = getSpreadsheet_();
  const tables = {};
  const metadata = {};

  spreadsheet.getSheets().forEach(function(sheet) {
    const name = sheet.getName();
    const headers = getHeaders_(sheet);
    if (!headers.length) {
      return;
    }

    const rows = getAllRows_(name);
    const primaryKey = PRIMARY_KEYS[name] || inferPrimaryKey_(headers);

    tables[name] = rows;
    metadata[name] = {
      headers: headers,
      primaryKey: primaryKey,
      rowCount: rows.length,
      protected: name === TABLES.ADMIN
    };
  });

  return {
    tables: tables,
    metadata: metadata
  };
}

/**
 * Finds a table row using either its configured key or spreadsheet row number.
 * @param {string} tableName Table name.
 * @param {*} keyValue Primary key value or row number.
 * @returns {Object|null} Matching row.
 */
function findDynamicRow_(tableName, keyValue) {
  const sheet = getSheet_(tableName);
  const headers = getHeaders_(sheet);
  const primaryKey = PRIMARY_KEYS[tableName] || inferPrimaryKey_(headers);

  if (String(primaryKey) === "_rowNumber") {
    const rowNumber = Number(keyValue);
    return Number.isInteger(rowNumber) && rowNumber >= 2
      ? getAllRows_(tableName).find(function(row) { return row._rowNumber === rowNumber; }) || null
      : null;
  }

  return getAllRows_(tableName).find(function(row) {
    return String(row[primaryKey] === undefined ? "" : row[primaryKey]).trim() ===
      String(keyValue).trim();
  }) || null;
}

/**
 * Handles approval when the Joining Process Table is edited directly in Sheets.
 * Requires an installable spreadsheet onEdit trigger created by setupTriggers().
 * @param {GoogleAppsScript.Events.SheetsOnEdit} event Edit event.
 * @returns {void}
 */
function handleApprovalSheetEdit_(event) {
  if (!event || !event.range) {
    return;
  }

  const sheet = event.range.getSheet();
  if (sheet.getName() !== TABLES.JOINING || event.range.getRow() < 2) {
    return;
  }

  const headers = getHeaders_(sheet);
  const statusColumn = headers.indexOf("verification_status") + 1;
  if (statusColumn < 1 || event.range.getColumn() !== statusColumn) {
    return;
  }

  const newStatus = String(event.value || "").trim().toLowerCase();
  if (newStatus !== "approved") {
    return;
  }

  const row = getAllRows_(TABLES.JOINING).find(function(item) {
    return item._rowNumber === event.range.getRow();
  });

  if (!row || String(row.id || "").trim() === "") {
    return;
  }

  try {
    approveJoinCore_(row);
  } catch (error) {
    console.error("Sheet approval automation failed: " + error.message);
  }
}

/**
 * Handles spreadsheet row-insert changes that happen outside the web app.
 * Form submissions already notify the admin directly; this handler covers
 * manual row insertions made in the spreadsheet UI.
 * @param {GoogleAppsScript.Events.SheetsOnChange} event Change event.
 * @returns {void}
 */
function handleSpreadsheetChange_(event) {
  if (!event || event.changeType !== "INSERT_ROW") {
    return;
  }

  notifyAdmin_("Spreadsheet Row Insert", {
    change_type: event.changeType,
    timestamp: timestamp_(),
    note: "A new spreadsheet row was inserted outside the web app. Review the database workspaces."
  });
}

/**
 * Creates/recreates the installable spreadsheet edit trigger used for
 * direct approval changes in Google Sheets.
 * @returns {void}
 */
function setupTriggers() {
  const spreadsheet = getSpreadsheet_();
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "handleApprovalSheetEdit_") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "handleSpreadsheetChange_") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("handleApprovalSheetEdit_")
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  ScriptApp.newTrigger("handleSpreadsheetChange_")
    .forSpreadsheet(spreadsheet)
    .onChange()
    .create();

  SpreadsheetApp.getUi().alert(
    "SRCCFPC approval trigger installed successfully."
  );
}

/* ----------------------------- Generic Admin CRUD ----------------------------- */

/**
 * Returns an admin-readable table.
 * @param {Object} data {tableName:string}
 * @param {string} token Admin session token.
 * @returns {Object} Table records.
 */
function getAdminTable_(data, token) {
  requireAdmin_(token);

  if (!data.tableName) {
    throw new Error("Table name is required.");
  }

  const sheet = getSheet_(data.tableName);
  const headers = getHeaders_(sheet);
  const primaryKey = PRIMARY_KEYS[data.tableName] || inferPrimaryKey_(headers);

  return {
    tableName: data.tableName,
    primaryKey: primaryKey,
    headers: headers,
    rows: getAllRows_(data.tableName)
  };
}

/**
 * Updates a single dynamic table record.
 * @param {Object} data Table, primary key value and updates.
 * @param {string} token Admin session token.
 * @returns {Object} Update result.
 */
function updateAdminRecord_(data, token) {
  const admin = requireAdmin_(token);
  requireFields_(data, ["tableName", "primaryKeyValue"]);

  const tableName = String(data.tableName);
  if (tableName === TABLES.ADMIN) {
    throw new Error("Admin Details Table is protected.");
  }

  const sheet = getSheet_(tableName);
  const headers = getHeaders_(sheet);
  const primaryKey = PRIMARY_KEYS[tableName] || inferPrimaryKey_(headers);
  const target = findDynamicRow_(tableName, data.primaryKeyValue);

  if (!target) {
    throw new Error("Record not found.");
  }

  const approvalRequested = tableName === TABLES.JOINING
    && String((data.updates || {}).verification_status || "").trim().toLowerCase() === "approved"
    && String(target.verification_status || "").trim().toLowerCase() !== "approved";

  Object.keys(data.updates || {}).forEach(function(header) {
    if (headers.indexOf(header) === -1) {
      return;
    }

    if (
      header === primaryKey
      || header === "password_hash"
      || header === "timestamp"
      || header === "joined_at"
      || header === "created_at"
      || (approvalRequested && header === "verification_status")
    ) {
      return;
    }

    let value = data.updates[header];
    if (["phone_number", "sender_number", "mobile_number", "phone"].indexOf(header) !== -1) {
      value = normalizePhone_(value);
    }

    sheet.getRange(target._rowNumber, headers.indexOf(header) + 1).setValue(value);
  });

  if (approvalRequested) {
    const refreshed = findByPrimaryKey_(TABLES.JOINING, data.primaryKeyValue);
    if (!refreshed) {
      throw new Error("Application disappeared before approval could be completed.");
    }

    const approvalResult = approveJoinCore_(refreshed);
    return {
      message: approvalResult.message,
      approval: true,
      email_sent: approvalResult.email_sent === true
    };
  }

  notifyAdmin_("Admin Record Update", {
    table: tableName,
    primary_key: primaryKey,
    primary_key_value: data.primaryKeyValue,
    updated_by: admin.username,
    fields: Object.keys(data.updates || {}).join(", ")
  });

  return { message: "Record updated successfully." };
}

/**
 * Deletes a single dynamic table record.
 * @param {Object} data Table and primary key value.
 * @param {string} token Admin session token.
 * @returns {Object} Delete result.
 */
function deleteAdminRecord_(data, token) {
  const admin = requireAdmin_(token);
  requireFields_(data, ["tableName", "primaryKeyValue"]);

  const tableName = String(data.tableName);
  if (tableName === TABLES.ADMIN) {
    throw new Error("Admin Details Table is protected.");
  }

  const target = findDynamicRow_(tableName, data.primaryKeyValue);
  if (!target) {
    throw new Error("Record not found.");
  }

  getSheet_(tableName).deleteRow(target._rowNumber);

  notifyAdmin_("Admin Record Deletion", {
    table: tableName,
    primary_key_value: data.primaryKeyValue,
    deleted_by: admin.username
  });

  return { message: "Record deleted successfully." };
}

/**
 * Updates a single field by primary key.
 * @param {string} sheetName Table name.
 * @param {string} keyValue Primary key.
 * @param {string} columnName Column header.
 * @param {*} value New value.
 * @returns {void}
 */
function updateCellByKey_(sheetName, keyValue, columnName, value) {
  const target = findByPrimaryKey_(sheetName, keyValue);

  if (!target) {
    throw new Error("Record not found.");
  }

  const sheet = getSheet_(sheetName);
  const headers = getHeaders_(sheet);
  const columnIndex = headers.indexOf(columnName);

  if (columnIndex === -1) {
    throw new Error("Column not found: " + columnName);
  }

  sheet.getRange(target._rowNumber, columnIndex + 1).setValue(value);
}
