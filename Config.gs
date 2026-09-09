/**
 * Non-secret defaults.
 *
 * Secrets and account identifiers belong in Apps Script > Project Settings >
 * Script Properties, NOT in GitHub.
 */
function getConfig_() {
  const p = PropertiesService.getScriptProperties();

  const cfg = {
    CALENDAR_ID: p.getProperty("CALENDAR_ID") || "primary",
    TIMEZONE: p.getProperty("TIMEZONE") || "America/Managua",

    // Meta / WhatsApp
    WHATSAPP_TOKEN: p.getProperty("WHATSAPP_TOKEN") || "",
    WHATSAPP_PHONE_NUMBER_ID: p.getProperty("WHATSAPP_PHONE_NUMBER_ID") || "",
    GRAPH_API_VERSION: p.getProperty("GRAPH_API_VERSION") || "",
    TEMPLATE_NAME: p.getProperty("TEMPLATE_NAME") || "recordatorio_cita_24h",
    TEMPLATE_LANGUAGE: p.getProperty("TEMPLATE_LANGUAGE") || "es",

    // Reminder behavior
    REMINDER_HOURS_BEFORE: Number(p.getProperty("REMINDER_HOURS_BEFORE") || "24"),
    MAX_CATCHUP_MINUTES: Number(p.getProperty("MAX_CATCHUP_MINUTES") || "180"),
    DRY_RUN: (p.getProperty("DRY_RUN") || "true").toLowerCase() === "true",

    // Optional Google Sheet logging
    LOG_SPREADSHEET_ID: p.getProperty("LOG_SPREADSHEET_ID") || "",
  };

  if (!cfg.GRAPH_API_VERSION && !cfg.DRY_RUN) {
    throw new Error(
      "GRAPH_API_VERSION is required when DRY_RUN=false. Set it to the currently supported Meta Graph API version, e.g. vXX.X."
    );
  }

  if (!cfg.WHATSAPP_TOKEN && !cfg.DRY_RUN) {
    throw new Error("WHATSAPP_TOKEN is required when DRY_RUN=false.");
  }

  if (!cfg.WHATSAPP_PHONE_NUMBER_ID && !cfg.DRY_RUN) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is required when DRY_RUN=false.");
  }

  return cfg;
}


/**
 * Optional helper to create a log spreadsheet and save its ID automatically.
 * Run once if you want a human-readable record of SENT / SKIPPED / ERROR.
 */
function createLogSpreadsheet() {
  const ss = SpreadsheetApp.create("WhatsApp Appointment Reminder Log");
  const sheet = ss.getSheets()[0];
  sheet.setName("Log");
  sheet.appendRow([
    "Timestamp",
    "Status",
    "Event ID",
    "Event title",
    "Appointment start",
    "Name",
    "Phone",
    "Details",
  ]);

  PropertiesService.getScriptProperties().setProperty(
    "LOG_SPREADSHEET_ID",
    ss.getId()
  );

  console.log(`Log spreadsheet created: ${ss.getUrl()}`);
  return ss.getUrl();
}
