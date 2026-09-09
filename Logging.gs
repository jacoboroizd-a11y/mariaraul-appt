function logResult_(entry) {
  const cfg = getConfig_();
  const timestamp = new Date();

  const line = {
    timestamp: timestamp.toISOString(),
    status: entry.status || "",
    eventId: entry.eventId || "",
    title: entry.title || "",
    start: entry.start instanceof Date ? entry.start.toISOString() : entry.start || "",
    name: entry.name || "",
    phone: entry.phone || "",
    details: entry.details || "",
  };

  console.log(JSON.stringify(line));

  if (!cfg.LOG_SPREADSHEET_ID) return;

  try {
    const ss = SpreadsheetApp.openById(cfg.LOG_SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Log") || ss.getSheets()[0];

    sheet.appendRow([
      timestamp,
      line.status,
      line.eventId,
      line.title,
      line.start ? new Date(line.start) : "",
      line.name,
      line.phone,
      line.details,
    ]);
  } catch (err) {
    console.error(`Could not write to log spreadsheet: ${err}`);
  }
}
