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

  // Admin notification recipients are read dynamically from Admin Details Table.
  ADMIN_EMAIL: "",
  // Existing administrator notification addresses. The migration matches an
  // existing admin username to the local-part when they are identical.
  KNOWN_ADMIN_EMAILS: {
    fahim_admin_16: "fahim.creator.16@gmail.com",
    mim759729m: "mim759729m@gmail.com",
    kashpiyakaisan: "kashpiyakaisan@gmail.com"
  },
  // Server-side bootstrap administrator. These values are never sent to the browser.
  BOOTSTRAP_ADMIN_USERNAME: "fahim_admin_16",
  BOOTSTRAP_ADMIN_PASSWORD: "apon0016@",


  // TODO: Replace with the deployed Apps Script Web App /exec URL.
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycbyRrT4TS8ZrvNqw_WzO8T1ll96YMr9aUTY2KfA7h7Jija3uaGx1ZTptSXDWp8fRAfcPjg/exec",

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
  REJOIN: "Rejoin Table",
  REMOVE: "Remove Details Table",
  ADMIN_LOG: "Admin Activity Log",
  NOTIFICATION_LOG: "Notification Log",
  BIRTHDAY_LOG: "Birthday Notification Log",
  CHAT: "Member Chat Messages"
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
    "id", "roll_number", "username", "password_hash", "status", "role", "username_changed_at"
  ],

  [TABLES.PROFILE]: [
    "profile_id", "roll_number", "full_name", "email", "phone_number",
    "department_stream", "section", "collegeId", "bloodGroup", "gender",
    "dob", "address", "facebook", "whyJoin", "payment_trx_id",
    "payment_method", "sender_number", "verification_status", "joined_at"
  ],

  [TABLES.ADMIN]: [
    "admin_id", "username", "password_hash", "email", "created_at", "status", "username_changed_at"
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
  ],
  [TABLES.REMOVE]: [
    "archive_id", "removed_at", "removed_by", "roll_number", "member_name",
    "removal_scope", "archive_json", "status"
  ],

  [TABLES.ADMIN_LOG]: [
    "id", "timestamp", "admin_username", "action", "table_name",
    "target_identifier", "roll_number", "status", "details"
  ],

  [TABLES.NOTIFICATION_LOG]: [
    "id", "timestamp", "event_type", "table_name", "action",
    "actor_type", "actor_identifier", "target_identifier", "recipients",
    "status", "error"
  ],

  [TABLES.BIRTHDAY_LOG]: [
    "id", "timestamp", "roll_number", "member_name", "email",
    "birthday_year", "status", "error"
  ],

  [TABLES.CHAT]: [
    "message_id", "timestamp", "sender_roll_number", "sender_username",
    "sender_name", "message", "status"
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
  [TABLES.REJOIN]: "id",
  [TABLES.REMOVE]: "archive_id",
  [TABLES.ADMIN_LOG]: "id",
  [TABLES.NOTIFICATION_LOG]: "id",
  [TABLES.BIRTHDAY_LOG]: "id",
  [TABLES.CHAT]: "message_id"
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
  migrateKnownAdminEmails_();

  SpreadsheetApp.getUi().alert(
    "SRCCFPC database setup complete. All required tables and columns are ready."
  );
}

/**
 * Migrates known notification emails into the Admin Details Table when an
 * existing admin username exactly matches the configured email local-part.
 * @returns {void}
 */
function migrateKnownAdminEmails_() {
  const sheet = getSheet_(TABLES.ADMIN);
  const headers = getHeaders_(sheet);
  const emailColumn = headers.indexOf("email") + 1;
  if (emailColumn < 1) return;
  const rows = getAllRows_(TABLES.ADMIN);
  Object.keys(CONFIG.KNOWN_ADMIN_EMAILS).forEach(function(username) {
    const row = rows.find(function(item) { return usernameKey_(item.username) === usernameKey_(username); });
    if (row && !String(row.email || "").trim()) {
      sheet.getRange(row._rowNumber, emailColumn).setValue(CONFIG.KNOWN_ADMIN_EMAILS[username]);
    }
  });
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
    const emailColumn = headers.indexOf("email") + 1;
    if (emailColumn > 0 && !String(existing.email || "").trim()) {
      sheet.getRange(existing._rowNumber, emailColumn).setValue("fahim.creator.16@gmail.com");
    }
    return;
  }

  appendRecord_(TABLES.ADMIN, {
    admin_id: uuid_(),
    username: username,
    password_hash: passwordHash,
    email: "fahim.creator.16@gmail.com",
    created_at: timestamp_(),
    status: "active",
    username_changed_at: ""
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
function notifyAdmin_(formName, details, actor) {
  const admins = getAllRows_(TABLES.ADMIN).filter(function(row) {
    return String(row.status || "").toLowerCase() === "active" && String(row.email || "").trim();
  });

  const recipients = [...new Set(admins.map(function(row) {
    return String(row.email).trim().toLowerCase();
  }))];

  const formTableMap = {
    "Membership / Join Form": TABLES.JOINING,
    "Interested Panel Form": TABLES.INTEREST,
    "Report Form": TABLES.REPORT,
    "Task Receive Form": TABLES.TASK,
    "Event Join Form": TABLES.EVENT,
    "Responded Form": TABLES.RESPONSE,
    "Devices Form": TABLES.DEVICE,
    "Rejoin Form": TABLES.REJOIN,
    "Lock / Log Sheet": TABLES.LOG,
    "Membership Approval": TABLES.JOINING,
    "Membership Rejection": TABLES.JOINING,
    "Spreadsheet Row Insert": "Spreadsheet",
    "Admin Record Update": details.table_name || details.table || "System",
    "Table Record Deleted": details.table_name || details.table || "System"
  };
  const tableName = String(details.table_name || details.table || formTableMap[formName] || "System");
  const action = String(details.action || formName || "Database Event");
  const actorType = actor && actor.type ? actor.type : (details.actor_type || (details.roll_number ? "Member" : "System"));
  const actorIdentifier = actor && actor.username ? actor.username : (details.actor_identifier || details.username || details.roll_number || "System");

  const lines = Object.keys(details).map(function(key) {
    return key + ": " + String(details[key] === undefined ? "" : details[key]);
  });

  const subject = "[SRCCFPC] " + action + " — " + tableName;
  const plainBody = [
    "SRCC Film & Photography Club",
    "----------------------------------------",
    "Database Event: " + action,
    "Table: " + tableName,
    "Actor Type: " + actorType,
    "Actor: " + actorIdentifier,
    "Timestamp: " + timestamp_(),
    "",
    lines.join("\n")
  ].join("\n");

  const htmlRows = Object.keys(details).map(function(key) {
    return '<tr><td style="padding:8px;border-bottom:1px solid #24344a;color:#8ea2b8;font-weight:700;">' + escapeHtml_(key) + '</td><td style="padding:8px;border-bottom:1px solid #24344a;color:#ffffff;">' + escapeHtml_(details[key]) + '</td></tr>';
  }).join("");

  const htmlBody = '<div style="margin:0;padding:28px;background:#03050a;font-family:Arial,Helvetica,sans-serif;color:#fff;line-height:1.6;">' +
    '<div style="max-width:700px;margin:auto;background:#08111f;border:1px solid rgba(86,220,255,.35);border-radius:22px;overflow:hidden;">' +
    '<div style="padding:26px;background:linear-gradient(135deg,#08111f,#17102a);text-align:center;">' +
    '<div style="font-size:11px;letter-spacing:3px;color:#5fffc1;font-weight:800;">SRCCFPC DATABASE ALERT</div>' +
    '<h1 style="margin:10px 0;color:#56dcff;font-size:24px;">' + escapeHtml_(action) + '</h1>' +
    '<div style="color:#b76cff;font-weight:700;">Table: ' + escapeHtml_(tableName) + '</div></div>' +
    '<div style="padding:24px;">' +
    '<p><strong>Actor Type:</strong> ' + escapeHtml_(actorType) + '</p>' +
    '<p><strong>Actor:</strong> ' + escapeHtml_(actorIdentifier) + '</p>' +
    '<p><strong>Time:</strong> ' + escapeHtml_(timestamp_()) + '</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-top:18px;">' + htmlRows + '</table>' +
    '</div></div></div>';

  let status = "no_recipients";
  let error = "";
  if (recipients.length) {
    try {
      MailApp.sendEmail({
        to: recipients.join(","),
        subject: subject,
        body: plainBody,
        htmlBody: htmlBody,
        name: "SRCC Film & Photography Club"
      });
      status = "sent";
    } catch (mailError) {
      status = "failed";
      error = mailError.message || String(mailError);
    }
  }

  appendRecord_(TABLES.NOTIFICATION_LOG, {
    id: uuid_(),
    timestamp: timestamp_(),
    event_type: formName,
    table_name: tableName,
    action: action,
    actor_type: actorType,
    actor_identifier: actorIdentifier,
    target_identifier: details.target_identifier || details.roll_number || "",
    recipients: recipients.join(","),
    status: status,
    error: error
  });

  if (actorType === "Admin") {
    appendRecord_(TABLES.ADMIN_LOG, {
      id: uuid_(),
      timestamp: timestamp_(),
      admin_username: actorIdentifier,
      action: action,
      table_name: tableName,
      target_identifier: details.target_identifier || "",
      roll_number: details.roll_number || "",
      status: status === "sent" || status === "no_recipients" ? "success" : "failed",
      details: JSON.stringify(details)
    });
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

  const name = escapeHtml_(fullName || "Creative Soul");
  const safeUsername = escapeHtml_(username || "");
  const loginUrl = "https://srccfpc.vercel.app/login.html";
  const welcomeCardUrl = "https://drive.google.com/file/d/1EbyX_udH_DJ4Xj7Drh9QuPFeclBRcUWx/view?usp=drivesdk";
  const termsUrl = "https://drive.google.com/file/d/1EFD0IRa3wtF0yfOihbG0Na3VUeB3y4u7/view?usp=drivesdk";

  const htmlBody =
    '<div style="margin:0;background:#03050a;padding:32px 14px;font-family:Arial,Helvetica,sans-serif;color:#f4f8ff;line-height:1.7;">' +
      '<div style="max-width:680px;margin:0 auto;background:#08111f;border:1px solid rgba(86,220,255,.35);border-radius:24px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.45);">' +
        '<div style="padding:34px 28px;text-align:center;background:linear-gradient(135deg,#08111f,#10102b);border-bottom:1px solid rgba(255,255,255,.1);">' +
          '<img src="https://files.catbox.moe/vl3wpi.png" alt="SRCCFPC" style="width:82px;height:auto;display:block;margin:0 auto 14px;">' +
          '<div style="font-size:11px;letter-spacing:3px;color:#5fffc1;font-weight:700;text-transform:uppercase;">SRCC FILM &amp; PHOTOGRAPHY CLUB</div>' +
          '<h1 style="margin:12px 0 4px;color:#56dcff;font-size:28px;line-height:1.25;">Welcome to the Canvas of Visual Stories</h1>' +
          '<div style="color:#b76cff;font-size:13px;font-weight:700;">Your Account is Now Active!</div>' +
        '</div>' +
        '<div style="padding:30px 28px;">' +
          '<p style="margin:0 0 16px;color:#fff;font-size:16px;">Dear ' + name + ',</p>' +
          '<p style="margin:0 0 16px;color:#c4d0df;font-size:14px;">Welcome to the family of SRCC Film &amp; Photography Club!</p>' +
          '<p style="margin:0 0 16px;color:#c4d0df;font-size:14px;">You have officially stepped into a universe where moments turn into timeless art, and ordinary perspectives transform into cinematic magic. The world of filmmaking and photography is not just a passion; it is an emotion, a medium to express what words fail to capture. Here, every lens tells a secret, and every frame paints a dream.</p>' +
          '<p style="margin:0 0 16px;color:#c4d0df;font-size:14px;">We are thrilled to inform you that your club account is now fully active.</p>' +
          '<div style="margin:24px 0;padding:18px;border:1px solid rgba(86,220,255,.25);border-radius:16px;background:rgba(86,220,255,.06);">' +
            '<div style="font-size:13px;color:#91a1b6;margin-bottom:6px;">MEMBER ACCOUNT</div>' +
            '<div style="font-size:15px;color:#fff;"><strong>Username:</strong> ' + safeUsername + '</div>' +
            '<div style="font-size:15px;color:#5fffc1;margin-top:5px;"><strong>Status:</strong> ACTIVE</div>' +
          '</div>' +
          '<p style="margin:0 0 14px;color:#c4d0df;font-size:14px;">To access your member dashboard, unlock your official member tools, and activate all Advanced Member Features, please log in to your account using the link below:</p>' +
          '<div style="text-align:center;margin:22px 0 28px;"><a href="' + loginUrl + '" style="display:inline-block;padding:13px 24px;border-radius:12px;background:#56dcff;color:#031018;text-decoration:none;font-weight:800;font-size:14px;">Open Member Login Portal</a></div>' +
          '<h2 style="margin:0 0 12px;color:#fff;font-size:18px;">Essential Resources for Your Journey</h2>' +
          '<p style="margin:0 0 12px;color:#c4d0df;font-size:14px;">Before we embark on this artistic voyage together, please review and save your official documents:</p>' +
          '<div style="margin:0 0 24px;padding:18px;border-radius:16px;background:rgba(183,108,255,.06);border:1px solid rgba(183,108,255,.2);">' +
            '<p style="margin:6px 0;font-size:14px;"><strong>1. Welcome Card:</strong> <a href="' + welcomeCardUrl + '" style="color:#56dcff;">View Welcome Card</a></p>' +
            '<p style="margin:6px 0;font-size:14px;"><strong>2. Terms &amp; Guidelines:</strong> <a href="' + termsUrl + '" style="color:#56dcff;">View Terms &amp; Guidelines</a></p>' +
          '</div>' +
          '<h2 style="margin:0 0 12px;color:#fff;font-size:18px;">Your Vision Matters</h2>' +
          '<p style="margin:0 0 16px;color:#c4d0df;font-size:14px;">Film and photography demand dedication, patience, and a relentless passion to create. As a member of our family, your unique thoughts and innovative concepts are what will shape our future projects. If you have a story to tell, a script to write, or a visual concept in mind—never hesitate to share your plans with the team.</p>' +
          '<p style="margin:0;color:#56dcff;font-size:15px;font-weight:700;text-align:center;">Let us capture the world together, one frame at a time. Once again, welcome home!</p>' +
        '</div>' +
        '<div style="padding:20px 28px;text-align:center;border-top:1px solid rgba(255,255,255,.1);color:#91a1b6;font-size:12px;">' +
          '<div style="color:#fff;font-weight:700;margin-bottom:5px;">Warm regards,</div>' +
          'SRCC Film &amp; Photography Club' +
        '</div>' +
      '</div>' +
    '</div>';

  const plainBody =
    "Dear " + (fullName || "Creative Soul") + ",\n\n" +
    "Welcome to the family of SRCC Film & Photography Club!\n\n" +
    "You have officially stepped into a universe where moments turn into timeless art, and ordinary perspectives transform into cinematic magic. The world of filmmaking and photography is not just a passion; it is an emotion, a medium to express what words fail to capture. Here, every lens tells a secret, and every frame paints a dream.\n\n" +
    "We are thrilled to inform you that your club account is now fully active.\n\n" +
    "Website Login Portal: " + loginUrl + "\n\n" +
    "Welcome Card: " + welcomeCardUrl + "\n" +
    "Terms & Guidelines: " + termsUrl + "\n\n" +
    "Let us capture the world together, one frame at a time. Once again, welcome home!\n\n" +
    "Warm regards,\nSRCC Film & Photography Club";

  MailApp.sendEmail({
    to: email,
    subject: "Welcome to the Canvas of Visual Stories — Your Account is Now Active!",
    body: plainBody,
    htmlBody: htmlBody,
    name: "SRCC Film & Photography Club"
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

      case "removeMember":
        result = removeMember_(data, token);
        break;

      case "listRemovedMembers":
        result = listRemovedMembers_(token);
        break;

      case "getRemovedDetails":
        result = getRemovedDetails_(data, token);
        break;

      case "restoreMember":
        result = restoreMember_(data, token);
        break;

      case "verifyOtp":
        result = verifyOtp_(data);
        break;

      case "forgotPassword":
        result = forgotPassword_(data);
        break;

      case "resetPassword":
        result = resetPassword_(data);
        break;

      case "changeUsername":
        result = changeUsername_(data, token);
        break;

      case "changePassword":
        result = changePassword_(data, token);
        break;

      case "sendChatMessage":
        result = sendChatMessage_(data, token);
        break;

      case "getChatMessages":
        result = getChatMessages_(data, token);
        break;

      case "runBirthdayCheck":
        result = runBirthdayCheck_(token);
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

/* Authentication functions are implemented in the security module below. */

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

  notifyAdmin_("Membership / Join Form", { ...record, table_name: TABLES.JOINING, action: "New Application" }, { type: "Member", username: record.username });

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

  // Both destination records are created before the pending application is removed.
  // If either append throws, the original Joining Process record remains intact.
  const joiningTarget = findByPrimaryKey_(TABLES.JOINING, pending.id);
  if (!joiningTarget) {
    throw new Error("Original application could not be verified before cleanup.");
  }
  getSheet_(TABLES.JOINING).deleteRow(joiningTarget._rowNumber);

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
        email: row.email || "",
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
  requireFields_(data, ["username", "password", "email"]);

  const username = String(data.username).trim();
  const email = String(data.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid admin Gmail address is required.");
  }

  if (getAllRows_(TABLES.ADMIN).some(function(row) {
    return String(row.username).trim().toLowerCase() === username.toLowerCase();
  })) {
    throw new Error("An administrator with this username already exists.");
  }

  appendRecord_(TABLES.ADMIN, {
    admin_id: uuid_(),
    username: username,
    password_hash: hashPassword_(data.password),
    email: email,
    created_at: timestamp_(),
    status: "active",
    username_changed_at: ""
  });

  const creator = requireAdmin_(token);
  notifyAdmin_("New Admin Account", {
    table_name: TABLES.ADMIN,
    action: "Admin Added",
    username: username,
    email: email,
    created_by: creator.username
  }, { type: "Admin", username: creator.username });

  return {
    message: "Administrator created successfully."
  };
}

/* ----------------------------- Security, Remove, Chat & Automation ----------------------------- */

/** Returns the script properties store used for temporary OTP/security state. */
function securityStore_() {
  return PropertiesService.getScriptProperties();
}

/** Returns a normalized username key. */
function usernameKey_(username) {
  return String(username || "").trim().toLowerCase();
}

/** Returns a temporary property key with a namespace. */
function securityKey_(prefix, value) {
  return "SRCCFPC_" + prefix + "_" + Utilities.base64EncodeWebSafe(String(value)).replace(/=+$/g, "");
}

/** Records a failed login and locks the account after seven consecutive failures. */
function recordFailedLogin_(identity) {
  const store = securityStore_();
  const key = securityKey_("FAIL", identity);
  const raw = store.getProperty(key);
  const state = raw ? JSON.parse(raw) : { count: 0, lockedUntil: 0 };
  state.count += 1;
  if (state.count >= 7) {
    state.lockedUntil = Date.now() + (3 * 60 * 60 * 1000);
    state.count = 0;
  }
  store.setProperty(key, JSON.stringify(state));
  return state;
}

/** Clears consecutive failed login state after successful credentials. */
function clearFailedLogin_(identity) {
  securityStore_().deleteProperty(securityKey_("FAIL", identity));
}

/** Throws when the account is inside the three-hour lockout window. */
function assertNotLocked_(identity) {
  const raw = securityStore_().getProperty(securityKey_("FAIL", identity));
  if (!raw) return;
  const state = JSON.parse(raw);
  if (Number(state.lockedUntil || 0) > Date.now()) {
    const remainingMinutes = Math.ceil((state.lockedUntil - Date.now()) / 60000);
    throw new Error("Login is temporarily locked after 7 failed attempts. Try again in " + remainingMinutes + " minute(s).");
  }
}

/** Sends a six-digit OTP challenge and stores only a hash server-side. */
function createOtpChallenge_(purpose, identity, email, payload) {
  if (!email) throw new Error("A registered email address is required for OTP verification.");
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const challenge = uuid_();
  const record = {
    purpose: purpose,
    identity: identity,
    email: email,
    hash: hashPassword_(otp),
    expiresAt: Date.now() + (10 * 60 * 1000),
    attempts: 0,
    payload: payload || {}
  };
  securityStore_().setProperty(securityKey_("OTP", challenge), JSON.stringify(record));
  MailApp.sendEmail({
    to: email,
    subject: "[SRCCFPC] Your verification code",
    body: "Your SRCCFPC verification code is " + otp + ". It expires in 10 minutes.",
    htmlBody: '<div style="padding:30px;background:#03050a;font-family:Arial;color:#fff;"><div style="max-width:560px;margin:auto;padding:28px;background:#08111f;border:1px solid #56dcff;border-radius:20px;text-align:center;"><div style="font-size:11px;letter-spacing:3px;color:#5fffc1;font-weight:800;">SRCCFPC SECURE VERIFICATION</div><h1 style="color:#56dcff;">Your OTP</h1><div style="font-size:36px;letter-spacing:10px;color:#fff;font-weight:900;">' + otp + '</div><p style="color:#a8bac8;">This code expires in 10 minutes.</p></div></div>',
    name: "SRCC Film & Photography Club"
  });
  return challenge;
}

/** Verifies an OTP challenge and completes login/reset flows. */
function verifyOtp_(data) {
  requireFields_(data, ["challenge", "otp"]);
  const key = securityKey_("OTP", data.challenge);
  const raw = securityStore_().getProperty(key);
  if (!raw) throw new Error("OTP challenge is invalid or expired.");
  const record = JSON.parse(raw);
  if (record.expiresAt < Date.now()) {
    securityStore_().deleteProperty(key);
    throw new Error("OTP has expired. Please request a new code.");
  }
  record.attempts += 1;
  if (record.attempts > 5) {
    securityStore_().deleteProperty(key);
    throw new Error("Too many incorrect OTP attempts. Please request a new code.");
  }
  if (hashPassword_(String(data.otp).trim()) !== record.hash) {
    securityStore_().setProperty(key, JSON.stringify(record));
    throw new Error("Invalid OTP.");
  }
  securityStore_().deleteProperty(key);

  if (record.purpose === "login_member" || record.purpose === "login_admin") {
    clearFailedLogin_(record.identity);
    return { message: "OTP verified. Login successful.", token: createSession_(record.payload.user), user: record.payload.user };
  }

  return { message: "OTP verified.", resetToken: createSession_({ role: "reset", identity: record.identity }) };
}

/** Authenticates a member using password and then requires OTP. */
function authenticateUser_(data) {
  requireFields_(data, ["username", "password"]);
  const identity = usernameKey_(data.username);
  assertNotLocked_(identity);
  const auth = getAllRows_(TABLES.AUTH).find(function(row) {
    return usernameKey_(row.username) === identity;
  });
  if (!auth || String(auth.status).toLowerCase() !== "active") {
    recordFailedLogin_(identity);
    throw new Error("Invalid username or inactive account.");
  }
  const currentHash = hashPassword_(data.password);
  const legacyHash = hashPassword_(data.password, CONFIG.LEGACY_SERVER_PEPPER);
  if (String(auth.password_hash) !== currentHash && String(auth.password_hash) !== legacyHash) {
    const state = recordFailedLogin_(identity);
    if (state.lockedUntil > Date.now()) throw new Error("Login is locked for 3 hours after 7 failed attempts.");
    throw new Error("Invalid username or password.");
  }
  if (String(auth.password_hash) === legacyHash) {
    updateRecordByRow_(TABLES.AUTH, auth._rowNumber, { password_hash: currentHash });
  }
  const profile = getAllRows_(TABLES.PROFILE).find(function(row) {
    return String(row.roll_number).trim() === String(auth.roll_number).trim();
  });
  const user = { roll_number: auth.roll_number, username: auth.username, role: "member", full_name: profile ? profile.full_name : "", email: profile ? profile.email : "" };
  const challenge = createOtpChallenge_("login_member", identity, user.email, { user: user });
  return { message: "Credentials verified. OTP sent to your registered email.", otpRequired: true, challenge: challenge };
}

/** Authenticates an administrator using password and then requires OTP. */
function adminLogin_(data) {
  requireFields_(data, ["username", "password"]);
  const identity = usernameKey_(data.username);
  assertNotLocked_(identity);
  let admin = getAllRows_(TABLES.ADMIN).find(function(row) {
    return usernameKey_(row.username) === identity && String(row.status || "").toLowerCase() === "active";
  });
  if (!admin && identity === usernameKey_(CONFIG.BOOTSTRAP_ADMIN_USERNAME) && String(data.password) === CONFIG.BOOTSTRAP_ADMIN_PASSWORD) {
    createDefaultAdminIfMissing_();
    admin = getAllRows_(TABLES.ADMIN).find(function(row) { return usernameKey_(row.username) === identity; });
  }
  if (!admin) { recordFailedLogin_(identity); throw new Error("Invalid admin credentials."); }
  const currentHash = hashPassword_(data.password);
  if (String(admin.password_hash) !== currentHash && !(identity === usernameKey_(CONFIG.BOOTSTRAP_ADMIN_USERNAME) && String(data.password) === CONFIG.BOOTSTRAP_ADMIN_PASSWORD)) {
    const state = recordFailedLogin_(identity);
    if (state.lockedUntil > Date.now()) throw new Error("Login is locked for 3 hours after 7 failed attempts.");
    throw new Error("Invalid admin credentials.");
  }
  const user = { admin_id: admin.admin_id, username: admin.username, role: CONFIG.ADMIN_ROLE, email: admin.email || "" };
  const challenge = createOtpChallenge_("login_admin", identity, admin.email || "fahim.creator.16@gmail.com", { user: user });
  return { message: "Credentials verified. OTP sent to your registered email.", otpRequired: true, challenge: challenge };
}

/** Starts a password reset using the registered member/admin email. */
function forgotPassword_(data) {
  requireFields_(data, ["username"]);
  const identity = usernameKey_(data.username);
  let account = getAllRows_(TABLES.AUTH).find(function(row) { return usernameKey_(row.username) === identity; });
  let purpose = "reset_member";
  if (!account) {
    account = getAllRows_(TABLES.ADMIN).find(function(row) { return usernameKey_(row.username) === identity; });
    purpose = "reset_admin";
  }
  if (!account) throw new Error("If the account exists, a reset code will be sent to its registered email.");
  let email = account.email || "";
  if (!email && purpose === "reset_member") {
    const profile = getAllRows_(TABLES.PROFILE).find(function(row) { return String(row.roll_number).trim() === String(account.roll_number).trim(); });
    email = profile ? profile.email : "";
  }
  const challenge = createOtpChallenge_(purpose, identity, email, { accountId: account.id || account.admin_id });
  return { message: "If the account is eligible, an OTP has been sent to its registered email.", otpRequired: true, challenge: challenge };
}

/** Resets a password after an OTP verification token. */
function resetPassword_(data) {
  requireFields_(data, ["resetToken", "newPassword"]);
  const session = requireSession_(data.resetToken);
  if (session.role !== "reset") throw new Error("Invalid password reset session.");
  const auth = getAllRows_(TABLES.AUTH).find(function(row) { return usernameKey_(row.username) === usernameKey_(session.identity); });
  const admin = getAllRows_(TABLES.ADMIN).find(function(row) { return usernameKey_(row.username) === usernameKey_(session.identity); });
  if (!auth && !admin) throw new Error("Account not found.");
  if (auth) updateRecordByRow_(TABLES.AUTH, auth._rowNumber, { password_hash: hashPassword_(data.newPassword) });
  if (admin) updateRecordByRow_(TABLES.ADMIN, admin._rowNumber, { password_hash: hashPassword_(data.newPassword) });
  notifyAdmin_("Password Reset", { table_name: auth ? TABLES.AUTH : TABLES.ADMIN, action: "Password Reset", target_identifier: session.identity, note: "Password value intentionally omitted." }, { type: auth ? "Member" : "Admin", username: session.identity });
  return { message: "Password reset successfully." };
}

/** Changes a username for a member or admin with a fourteen-day cooldown. */
function changeUsername_(data, token) {
  const user = requireSession_(token);
  requireFields_(data, ["currentPassword", "newUsername"]);
  const newUsername = usernameKey_(data.newUsername);
  if (!newUsername) throw new Error("New username is required.");
  const isAdmin = user.role === CONFIG.ADMIN_ROLE;
  const table = isAdmin ? TABLES.ADMIN : TABLES.AUTH;
  const rows = getAllRows_(table);
  const account = rows.find(function(row) { return String(isAdmin ? row.admin_id : row.roll_number).trim() === String(isAdmin ? user.admin_id : user.roll_number).trim(); });
  if (!account) throw new Error("Account not found.");
  if (hashPassword_(data.currentPassword) !== String(account.password_hash)) throw new Error("Sorry! Your password is wrong");
  if (rows.some(function(row) { return usernameKey_(row.username) === newUsername && usernameKey_(row.username) !== usernameKey_(account.username); })) throw new Error("This username is already in use.");
  if (account.username_changed_at) {
    const elapsed = Date.now() - new Date(account.username_changed_at).getTime();
    if (elapsed < 14 * 24 * 60 * 60 * 1000) throw new Error("Username can be changed again only after 14 days.");
  }
  updateRecordByRow_(table, account._rowNumber, { username: data.newUsername.trim(), username_changed_at: timestamp_() });
  notifyAdmin_("Username Change", { table_name: table, action: "Username Changed", target_identifier: isAdmin ? user.admin_id : user.roll_number, old_username: account.username, new_username: data.newUsername.trim() }, { type: isAdmin ? "Admin" : "Member", username: account.username });
  return { message: "Username changed successfully. Please sign in again." };
}

/** Changes a member/admin password after current-password verification. */
function changePassword_(data, token) {
  const user = requireSession_(token);
  requireFields_(data, ["currentPassword", "newPassword"]);
  const isAdmin = user.role === CONFIG.ADMIN_ROLE;
  const table = isAdmin ? TABLES.ADMIN : TABLES.AUTH;
  const rows = getAllRows_(table);
  const account = rows.find(function(row) { return String(isAdmin ? row.admin_id : row.roll_number).trim() === String(isAdmin ? user.admin_id : user.roll_number).trim(); });
  if (!account) throw new Error("Account not found.");
  if (hashPassword_(data.currentPassword) !== String(account.password_hash)) throw new Error("Sorry! Your password is wrong");
  updateRecordByRow_(table, account._rowNumber, { password_hash: hashPassword_(data.newPassword) });
  notifyAdmin_("Password Change", { table_name: table, action: "Password Changed", target_identifier: isAdmin ? user.admin_id : user.roll_number, note: "Password value intentionally omitted." }, { type: isAdmin ? "Admin" : "Member", username: account.username });
  return { message: "Password changed successfully." };
}

/** Stores a persistent member chat message. */
function sendChatMessage_(data, token) {
  const user = requireSession_(token);
  if (user.role !== "member") throw new Error("Member access required.");
  const message = String(data.message || "").trim();
  if (!message) throw new Error("Message cannot be empty.");
  if (message.length > 2000) throw new Error("Message is too long.");
  const safeMessage = message.replace(/<[^>]*>/g, "");
  const record = { message_id: uuid_(), timestamp: timestamp_(), sender_roll_number: user.roll_number, sender_username: user.username, sender_name: user.full_name || "Member", message: safeMessage, status: "active" };
  appendRecord_(TABLES.CHAT, record);
  notifyAdmin_("Member Chat Message", { table_name: TABLES.CHAT, action: "New Chat Message", target_identifier: record.message_id, roll_number: user.roll_number, message_preview: safeMessage.slice(0, 120) }, { type: "Member", username: user.username });
  return { message: "Message sent.", item: record };
}

/** Loads persistent member chat history with a safe limit. */
function getChatMessages_(data, token) {
  const user = requireSession_(token);
  if (user.role !== "member") throw new Error("Member access required.");
  const limit = Math.min(Math.max(Number(data.limit || 50), 1), 100);
  const rows = getAllRows_(TABLES.CHAT).filter(function(row) { return String(row.status || "active").toLowerCase() === "active"; });
  return { messages: rows.slice(Math.max(0, rows.length - limit)) };
}

/** Archives all member-linked rows before removing/deactivating them. */
function removeMember_(data, token) {
  const admin = requireAdmin_(token);
  requireFields_(data, ["roll_number"]);
  const roll = String(data.roll_number).trim();
  const relatedTables = Object.keys(TABLES).map(function(key) { return TABLES[key]; }).filter(function(name) { return [TABLES.JOINING, TABLES.AUTH, TABLES.PROFILE, TABLES.INTEREST, TABLES.REPORT, TABLES.TASK, TABLES.EVENT, TABLES.RESPONSE, TABLES.DEVICE, TABLES.LOG, TABLES.REJOIN].indexOf(name) !== -1; });
  const archive = {};
  let memberName = "";
  relatedTables.forEach(function(tableName) {
    archive[tableName] = getAllRows_(tableName).filter(function(row) { return String(row.roll_number || "").trim() === roll; }).map(function(row) { if (!memberName) memberName = row.full_name || ""; const copy = {}; Object.keys(row).forEach(function(k) { if (k !== "_rowNumber") copy[k] = row[k]; }); return copy; });
  });
  if (!Object.keys(archive).some(function(k) { return archive[k].length; })) throw new Error("No member-linked records were found.");
  const archiveId = uuid_();
  appendRecord_(TABLES.REMOVE, { archive_id: archiveId, removed_at: timestamp_(), removed_by: admin.username, roll_number: roll, member_name: memberName, removal_scope: "all_related_tables", archive_json: JSON.stringify(archive), status: "removed" });
  // Archive is written before active rows are removed.
  relatedTables.forEach(function(tableName) {
    const sheet = getSheet_(tableName);
    const rows = getAllRows_(tableName).filter(function(row) { return String(row.roll_number || "").trim() === roll; }).sort(function(a,b){ return b._rowNumber-a._rowNumber; });
    rows.forEach(function(row) { sheet.deleteRow(row._rowNumber); });
  });
  notifyAdmin_("Member Removed", { table_name: TABLES.REMOVE, action: "Member Removed From All Related Tables", target_identifier: archiveId, roll_number: roll, member_name: memberName, removed_by: admin.username }, { type: "Admin", username: admin.username });
  return { message: "Complete member archive created and related active records removed.", archive_id: archiveId };
}

/** Lists complete member removal archives. */
function listRemovedMembers_(token) {
  requireAdmin_(token);
  return { removed: getAllRows_(TABLES.REMOVE).map(function(row) { return { archive_id: row.archive_id, removed_at: row.removed_at, removed_by: row.removed_by, roll_number: row.roll_number, member_name: row.member_name, removal_scope: row.removal_scope, status: row.status }; }) };
}

/** Returns an archive with all source-table data for View All Details. */
function getRemovedDetails_(data, token) {
  requireAdmin_(token);
  requireFields_(data, ["archive_id"]);
  const row = findByPrimaryKey_(TABLES.REMOVE, data.archive_id);
  if (!row) throw new Error("Removal archive not found.");
  return { archive: row };
}

/** Restores every archived source-table row without silently overwriting conflicts. */
function restoreMember_(data, token) {
  const admin = requireAdmin_(token);
  requireFields_(data, ["archive_id"]);
  const archiveRow = findByPrimaryKey_(TABLES.REMOVE, data.archive_id);
  if (!archiveRow) throw new Error("Removal archive not found.");
  const archive = JSON.parse(archiveRow.archive_json || "{}");
  Object.keys(archive).forEach(function(tableName) {
    const records = archive[tableName] || [];
    const headers = getHeaders_(getSheet_(tableName));
    const primaryKey = PRIMARY_KEYS[tableName] || inferPrimaryKey_(headers);
    records.forEach(function(record) {
      if (primaryKey && findByPrimaryKey_(tableName, record[primaryKey])) throw new Error("Restore conflict in " + tableName + " for " + primaryKey + ".");
      if (tableName === TABLES.AUTH && getAllRows_(TABLES.AUTH).some(function(row){ return usernameKey_(row.username) === usernameKey_(record.username); })) throw new Error("Restore username conflict.");
      if (tableName === TABLES.PROFILE && getAllRows_(TABLES.PROFILE).some(function(row){ return String(row.roll_number).trim() === String(record.roll_number).trim(); })) throw new Error("Restore roll number conflict in Personal Details Table.");
      appendRecord_(tableName, record);
    });
  });
  updateRecordByRow_(TABLES.REMOVE, archiveRow._rowNumber, { status: "restored" });
  notifyAdmin_("Member Restored", { table_name: TABLES.REMOVE, action: "Complete Member Restore", target_identifier: data.archive_id, roll_number: archiveRow.roll_number, member_name: archiveRow.member_name, restored_by: admin.username }, { type: "Admin", username: admin.username });
  return { message: "Complete member data restored successfully." };
}

/** Sends birthday emails once per member/year. */
function runBirthdayCheck_(token) {
  if (token) requireAdmin_(token);
  const today = new Date();
  const monthDay = Utilities.formatDate(today, CONFIG.TIME_ZONE, "MM-dd");
  const year = Utilities.formatDate(today, CONFIG.TIME_ZONE, "yyyy");
  const sent = [];
  getAllRows_(TABLES.PROFILE).forEach(function(member) {
    const dob = String(member.dob || "").trim();
    if (!dob) return;
    const normalized = dob.replace(/\//g, "-");
    if (normalized.slice(5, 10) !== monthDay) return;
    const already = getAllRows_(TABLES.BIRTHDAY_LOG).some(function(row) { return String(row.roll_number).trim() === String(member.roll_number).trim() && String(row.birthday_year) === year && String(row.status).toLowerCase() === "sent"; });
    if (already) return;
    try {
      sendBirthdayEmail_(member.email, member.full_name);
      appendRecord_(TABLES.BIRTHDAY_LOG, { id: uuid_(), timestamp: timestamp_(), roll_number: member.roll_number, member_name: member.full_name, email: member.email, birthday_year: year, status: "sent", error: "" });
      sent.push(member.roll_number);
    } catch (error) {
      appendRecord_(TABLES.BIRTHDAY_LOG, { id: uuid_(), timestamp: timestamp_(), roll_number: member.roll_number, member_name: member.full_name, email: member.email, birthday_year: year, status: "failed", error: error.message || String(error) });
    }
  });
  return { message: "Birthday check completed.", sent: sent };
}

/** Sends the premium birthday HTML email. */
function sendBirthdayEmail_(email, fullName) {
  if (!email) throw new Error("Birthday member email is missing.");
  const name = escapeHtml_(fullName || "Creative Soul");
  const html = '<div style="margin:0;padding:32px 14px;background:#03050a;font-family:Arial,Helvetica,sans-serif;color:#fff;line-height:1.7;"><div style="max-width:680px;margin:auto;background:#08111f;border:1px solid rgba(86,220,255,.38);border-radius:24px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.5);"><div style="padding:34px 28px;text-align:center;background:linear-gradient(135deg,#08111f,#17102a);"><img src="https://files.catbox.moe/vl3wpi.png" alt="SRCCFPC" style="width:82px;display:block;margin:0 auto 14px;"><div style="font-size:11px;letter-spacing:3px;color:#5fffc1;font-weight:800;">SRCC FILM &amp; PHOTOGRAPHY CLUB</div><h1 style="margin:12px 0;color:#56dcff;font-size:28px;">Happy Birthday, ' + name + '! 🎂✨</h1><div style="color:#b76cff;font-weight:800;">May Your Life’s Canvas Be Filled With Light &amp; Art</div></div><div style="padding:30px 28px;"><p>Dear Creative Soul,</p><p>Today is a truly special day! On behalf of the entire SRCC Film &amp; Photography Club family, we send you our warmest wishes and happiest thoughts on your Birthday! 🎂🎉</p><p>Just as a camera lens freezes ordinary moments into timeless masterpieces, we wish that your life gets framed with infinite joy, vibrant colors, and unforgettable memories. May every new chapter of your journey unfold like a cinematic dream, illuminated by passion, creativity, and inner strength.</p><p>As a valued member of our artistic family, your unique vision, brilliant ideas, and creative perspective continue to inspire us all. We look forward to capturing many more amazing milestones and creative projects together through your lens in the days ahead.</p><p>May the coming year bring you good health, endless inspiration, and boundless success in all your visual storytelling adventures. Happy Birthday once again! 🥂✨</p><div style="margin-top:24px;padding:18px;border-radius:16px;background:rgba(86,220,255,.06);border:1px solid rgba(86,220,255,.2);text-align:center;color:#56dcff;font-weight:800;">Keep creating. Keep capturing. Keep telling beautiful stories.</div></div><div style="padding:20px 28px;text-align:center;border-top:1px solid rgba(255,255,255,.1);color:#91a1b6;font-size:12px;"><strong style="color:#fff;">Warmest regards,</strong><br>SRCC Film &amp; Photography Club</div></div></div>';
  const plain = "Dear Creative Soul,\n\nToday is a truly special day! On behalf of the entire SRCC Film & Photography Club family, we send you our warmest wishes and happiest thoughts on your Birthday!\n\nMay your life be framed with infinite joy, vibrant colors, unforgettable memories, passion, creativity, and success.\n\nWarmest regards,\nSRCC Film & Photography Club";
  MailApp.sendEmail({ to: email, subject: "Happy Birthday! May Your Life’s Canvas Be Filled With Light & Art 🎬✨", body: plain, htmlBody: html, name: "SRCC Film & Photography Club" });
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
/** Runs the automated daily birthday check. */
function runBirthdayTrigger_() {
  runBirthdayCheck_("");
}

function setupTriggers() {
  // Remove duplicate birthday triggers before creating the daily midnight check.
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "runBirthdayTrigger_") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("runBirthdayTrigger_").timeBased().atHour(0).everyDays(1).inTimezone(CONFIG.TIME_ZONE).create();
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
  if (tableName === TABLES.ADMIN || tableName === TABLES.REMOVE) {
    throw new Error("This table cannot be deleted directly.");
  }

  const target = findDynamicRow_(tableName, data.primaryKeyValue);
  if (!target) {
    throw new Error("Record not found.");
  }

  getSheet_(tableName).deleteRow(target._rowNumber);

  notifyAdmin_("Table Record Deleted", {
    table_name: tableName,
    action: "Delete From This Table Only",
    target_identifier: data.primaryKeyValue,
    roll_number: target.roll_number || "",
    deleted_by: admin.username
  }, { type: "Admin", username: admin.username });

  return { message: "Record deleted from this table only." };
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
