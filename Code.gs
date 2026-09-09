/**
 * Entry point. Runs every minute using an Apps Script time-based trigger.
 * It sends reminders that became due since the previous execution.
 */
function runReminders() {
  const cfg = getConfig_();
  const now = new Date();

  const props = PropertiesService.getScriptProperties();
  const lastRunRaw = props.getProperty("LAST_RUN_ISO");

  // On the first run, look back two minutes so a newly installed trigger
  // doesn't miss an appointment right on the boundary.
  let lastRun = lastRunRaw
    ? new Date(lastRunRaw)
    : new Date(now.getTime() - 2 * 60 * 1000);

  // Prevent a very old LAST_RUN value from sending stale reminders after
  // the script has been disabled for days.
  const maxCatchupMs = cfg.MAX_CATCHUP_MINUTES * 60 * 1000;
  if (now.getTime() - lastRun.getTime() > maxCatchupMs) {
    lastRun = new Date(now.getTime() - maxCatchupMs);
  }

  const reminderMs = cfg.REMINDER_HOURS_BEFORE * 60 * 60 * 1000;
  const eventWindowStart = new Date(lastRun.getTime() + reminderMs);
  const eventWindowEnd = new Date(now.getTime() + reminderMs);

  console.log(
    `Checking events starting between ${eventWindowStart.toISOString()} and ${eventWindowEnd.toISOString()}`
  );

  const calendar = cfg.CALENDAR_ID === "primary"
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(cfg.CALENDAR_ID);

  if (!calendar) {
    throw new Error(`Calendar not found or not accessible: ${cfg.CALENDAR_ID}`);
  }

  const events = calendar.getEvents(eventWindowStart, eventWindowEnd);

  for (const event of events) {
    try {
      processEvent_(event, cfg, now);
    } catch (err) {
      logResult_({
        status: "ERROR",
        eventId: safeEventId_(event),
        title: safe_(event.getTitle()),
        start: event.getStartTime(),
        phone: "",
        name: "",
        details: String(err && err.stack ? err.stack : err),
      });
      console.error(err);
    }
  }

  // Update only after the batch finishes. Individual sends are idempotent.
  props.setProperty("LAST_RUN_ISO", now.toISOString());
}


/**
 * One-click installer for the recurring one-minute trigger.
 * Run this manually once from Apps Script.
 */
function installTrigger() {
  removeReminderTriggers_();

  ScriptApp.newTrigger("runReminders")
    .timeBased()
    .everyMinutes(1)
    .create();

  console.log("Trigger installed: runReminders() every minute.");
}


/**
 * Removes only triggers created for runReminders().
 */
function removeReminderTriggers_() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === "runReminders") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}


/**
 * Safe test: parses appointments in the next 48 hours and logs what would
 * happen. It DOES NOT send WhatsApp messages.
 */
function previewNext48Hours() {
  const cfg = getConfig_();
  const calendar = cfg.CALENDAR_ID === "primary"
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(cfg.CALENDAR_ID);

  if (!calendar) {
    throw new Error(`Calendar not found or not accessible: ${cfg.CALENDAR_ID}`);
  }

  const now = new Date();
  const end = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const events = calendar.getEvents(now, end);

  const result = events.map(event => {
    const parsed = parseAppointment_(event);
    return {
      start: Utilities.formatDate(event.getStartTime(), cfg.TIMEZONE, "yyyy-MM-dd HH:mm"),
      title: event.getTitle(),
      name: parsed.name,
      phone: parsed.phone || "(NO PHONE)",
      wouldSend: Boolean(parsed.phone),
    };
  });

  console.log(JSON.stringify(result, null, 2));
  return result;
}


/**
 * Sends a single test template to TEST_PHONE from Script Properties.
 * Useful after Meta configuration is complete.
 */
function testWhatsApp() {
  const cfg = getConfig_();
  const testPhone = normalizePhone_(
    PropertiesService.getScriptProperties().getProperty("TEST_PHONE") || ""
  );

  if (!testPhone) {
    throw new Error(
      "Add TEST_PHONE to Script Properties, e.g. 50588888888, then run testWhatsApp() again."
    );
  }

  const fakeName = "Prueba";
  const fakeTime = "10:00 AM";
  const result = sendReminderTemplate_(testPhone, fakeName, fakeTime, cfg);
  console.log(JSON.stringify(result, null, 2));
}


/**
 * Processes one event. Phone is mandatory. Treatment/procedure is deliberately
 * not required because calendar formatting is inconsistent.
 */
function processEvent_(event, cfg, now) {
  if (event.isAllDayEvent()) {
    logResult_({
      status: "SKIPPED_ALL_DAY",
      eventId: safeEventId_(event),
      title: event.getTitle(),
      start: event.getStartTime(),
      phone: "",
      name: "",
      details: "All-day event",
    });
    return;
  }

  const parsed = parseAppointment_(event);
  const eventKey = buildEventKey_(event);

  if (wasSent_(eventKey)) {
    console.log(`Already sent: ${event.getTitle()} (${eventKey})`);
    return;
  }

  if (!parsed.phone) {
    logResult_({
      status: "SKIPPED_NO_PHONE",
      eventId: safeEventId_(event),
      title: event.getTitle(),
      start: event.getStartTime(),
      phone: "",
      name: parsed.name || "",
      details: "No valid Nicaragua phone number found in title/description/location.",
    });
    return;
  }

  const name = parsed.name || "cliente";
  const formattedTime = Utilities.formatDate(
    event.getStartTime(),
    cfg.TIMEZONE,
    "h:mm a"
  );

  if (cfg.DRY_RUN) {
    logResult_({
      status: "DRY_RUN",
      eventId: safeEventId_(event),
      title: event.getTitle(),
      start: event.getStartTime(),
      phone: parsed.phone,
      name,
      details: `Would send reminder for ${formattedTime}`,
    });
    return;
  }

  const response = sendReminderTemplate_(
    parsed.phone,
    name,
    formattedTime,
    cfg
  );

  markSent_(eventKey, now);

  logResult_({
    status: "SENT",
    eventId: safeEventId_(event),
    title: event.getTitle(),
    start: event.getStartTime(),
    phone: parsed.phone,
    name,
    details: response && response.messages && response.messages[0]
      ? response.messages[0].id
      : "Sent",
  });
}
