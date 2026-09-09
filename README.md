# WhatsApp Calendar Reminder

Google Calendar → Google Apps Script → WhatsApp Business Cloud API.

This project looks for appointments whose **24-hour reminder has become due**, extracts a patient/client name and Nicaragua phone number from messy Google Calendar events, and sends an approved WhatsApp template.

## What it tolerates

Examples of titles:

- `Citas Dra. Mariaraul (María Pérez)`
- `María Pérez + Botox`
- `María Pérez - Botox`
- `María Pérez | Botox`
- `María Pérez`

Examples of descriptions:

```text
Reservada por:
María Pérez
maria@example.com
8888 8888 $10 anticipo

Procedimiento:
Botox
```

or:

```text
Reservada por:
María Pérez
maria@example.com
+505 8888-8888

whatever body text
```

The procedure/treatment is **not required**.

If there is no valid phone number, the event is skipped and logged as:

`SKIPPED_NO_PHONE`

## Reminder message

Create an approved WhatsApp template named `recordatorio_cita_24h`:

```text
Buen día, {{1}} ✨

Le recordamos que tiene una cita programada para mañana a las {{2}}.

Por favor, confírmenos su asistencia respondiendo a este mensaje.

Le recordamos que las cancelaciones realizadas con menos de 24 horas de anticipación no aplican para devolución del depósito; sin embargo, este podrá utilizarse para reprogramar su cita.

¡Muchas gracias! Esperamos verle mañana.
```

Variables:

- `{{1}}`: name
- `{{2}}`: appointment time

## Architecture

There is no server.

Google Apps Script runs in Google's cloud. A time-driven trigger calls `runReminders()` every minute.

The script stores the timestamp of the previous execution. On each run, it finds appointments whose **24-hour reminder became due between the previous run and the current run**.

That avoids:
- sending the same reminder twice;
- missing an appointment just because a trigger executes a little late.

Apps Script triggers are not real-time schedulers, so "24 hours before" means as close as the recurring trigger executes, normally around the minute boundary rather than guaranteed to the second.

## Files

- `Code.gs` — scheduler / main flow
- `Config.gs` — configuration and log spreadsheet helper
- `Parser.gs` — messy Calendar parser
- `WhatsApp.gs` — Meta Cloud API call
- `State.gs` — duplicate protection
- `Logging.gs` — execution log
- `appsscript.json` — Apps Script manifest
- `TEMPLATE.txt` — WhatsApp template text

---

# Setup — easiest method

## 1. Create the Apps Script project

Go to:

`https://script.google.com/`

Create a new standalone project.

Name it:

`WhatsApp Calendar Reminder`

In **Project Settings**, enable:

> Show "appsscript.json" manifest file in editor

Create/paste the `.gs` files from this repository into the project and replace the manifest with `appsscript.json`.

Alternatively use `clasp` as described later.

## 2. Choose the Google Calendar

If the appointments are in your primary calendar, no change is needed.

Script Property:

```text
CALENDAR_ID = primary
```

If appointments use another calendar, open Google Calendar:

Settings → select the calendar → Integrate calendar → Calendar ID.

Set that value as `CALENDAR_ID`.

## 3. Add Script Properties

Apps Script:

Project Settings → Script Properties.

Add:

```text
CALENDAR_ID              primary
TIMEZONE                 America/Managua
REMINDER_HOURS_BEFORE    24
MAX_CATCHUP_MINUTES      180
DRY_RUN                  true

WHATSAPP_TOKEN            <leave until Meta setup>
WHATSAPP_PHONE_NUMBER_ID  <leave until Meta setup>
GRAPH_API_VERSION         <current supported Meta Graph API version>
TEMPLATE_NAME             recordatorio_cita_24h
TEMPLATE_LANGUAGE         es
```

Optional:

```text
TEST_PHONE                50588888888
LOG_SPREADSHEET_ID
```

Do **not** put tokens in GitHub.

## 4. Authorize Google access

In the Apps Script editor select:

`previewNext48Hours`

Press **Run**.

Google will request Calendar permissions.

Approve them.

Open **Execution log**.

You should see entries showing:

- event title
- extracted name
- extracted phone
- whether the reminder could be sent

Nothing is sent because `DRY_RUN=true`.

## 5. Optional: create a log spreadsheet

Run:

`createLogSpreadsheet`

The script creates a Google Sheet and stores its ID automatically.

From then on it records:

- `SENT`
- `DRY_RUN`
- `SKIPPED_NO_PHONE`
- `SKIPPED_ALL_DAY`
- `ERROR`

## 6. Configure WhatsApp Business Cloud API

In Meta's developer/business tools:

1. Create or use a Meta app with WhatsApp.
2. Connect the WhatsApp Business Account / phone number.
3. Obtain the **Phone Number ID**.
4. Obtain an access token suitable for the WhatsApp Business Platform.
5. Create and submit the template in `TEMPLATE.txt`.
6. Wait until the template is approved.
7. Note the exact template language code.
8. Add the values to Apps Script Script Properties.

Properties:

```text
WHATSAPP_TOKEN
WHATSAPP_PHONE_NUMBER_ID
GRAPH_API_VERSION
TEMPLATE_NAME
TEMPLATE_LANGUAGE
```

## 7. Test WhatsApp

Set:

```text
TEST_PHONE = your test WhatsApp number in international format
```

Example Nicaragua:

```text
50588888888
```

Run:

`testWhatsApp`

If configured correctly, the approved template should arrive.

## 8. Dry-run against real Calendar events

Keep:

```text
DRY_RUN = true
```

Run:

`previewNext48Hours`

Check the parsing.

Then manually run:

`runReminders`

Check the execution log / spreadsheet.

No WhatsApp message is sent while `DRY_RUN=true`.

## 9. Turn on real sending

Change:

```text
DRY_RUN = false
```

Run `testWhatsApp` again.

Then run:

`installTrigger`

This deletes old `runReminders` triggers and creates one that runs every minute.

Done.

---

# GitHub + clasp method

If you want this exact GitHub repository to be the source of truth:

## Requirements

- Node.js
- npm

Clone your repo and run:

```bash
npm install
npx clasp login
```

Create a new Apps Script project in the browser, then copy its **Script ID** from:

Project Settings → IDs → Script ID

Copy:

`.clasp.json.example`

to:

`.clasp.json`

and paste the Script ID.

Then:

```bash
npx clasp push
npx clasp open
```

`.clasp.json` is gitignored.

## Security

Never commit:

- WhatsApp tokens
- system-user tokens
- passwords
- Meta app secrets

They belong in Apps Script **Script Properties**.

## Phone parsing

The parser accepts Nicaragua numbers such as:

```text
88888888
8888-8888
8888 8888
+505 8888 8888
50588888888
```

It normalizes them to:

```text
50588888888
```

If no number exists, there is nothing the script can infer. The event is skipped.

## Duplicate protection

Each reminder is keyed by:

```text
Google Calendar event ID + appointment start time
```

Once successfully sent, the script stores a sent marker so the same event occurrence is not sent again.

If the appointment date/time changes, its new start time creates a new key.

## Important operational note

Do not use the WhatsApp Business App UI as a "bot" with Selenium/Puppeteer. This project uses the official WhatsApp Business Cloud API.

Business-initiated reminder messages should be sent with an approved WhatsApp message template.
