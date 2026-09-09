/**
 * Parse only what we can reasonably trust:
 *   - name
 *   - Nicaragua phone
 *
 * Treatment/procedure is intentionally not required.
 */
function parseAppointment_(event) {
  const title = safe_(event.getTitle());
  const description = safe_(event.getDescription());
  const location = safe_(event.getLocation());

  const phone = extractPhone_([title, description, location].join("\n"));
  const name =
    extractNameFromReservedBy_(description) ||
    extractNameFromTitle_(title) ||
    "";

  return { name, phone };
}


/**
 * Finds a Nicaragua number in messy text.
 * Accepts examples such as:
 *   +505 8888 8888
 *   50588888888
 *   8888-8888
 *   8888 8888
 *
 * To reduce false positives, local 8-digit numbers must begin with 2, 5, 7 or 8.
 */
function extractPhone_(text) {
  if (!text) return null;

  const candidates = String(text).match(
    /(?:\+?505[\s().-]*)?(?:[2578])(?:[\s().-]*\d){7}/g
  ) || [];

  for (const candidate of candidates) {
    const normalized = normalizePhone_(candidate);
    if (normalized) return normalized;
  }

  return null;
}


function normalizePhone_(value) {
  let digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 8 && /^[2578]/.test(digits)) {
    digits = "505" + digits;
  }

  if (/^505[2578]\d{7}$/.test(digits)) {
    return digits; // Cloud API expects international digits; '+' is not required here.
  }

  return null;
}


/**
 * Preferred source: the structured-ish "Reservada por:" block.
 */
function extractNameFromReservedBy_(description) {
  if (!description) return null;

  const lines = String(description)
    .replace(/\r/g, "")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    if (/^reservad[ao]\s+por\s*:/i.test(lines[i])) {
      // Handles:
      // Reservada por:
      // María Pérez
      //
      // and:
      // Reservada por: María Pérez
      const inline = lines[i].replace(/^reservad[ao]\s+por\s*:/i, "").trim();
      if (looksLikePersonName_(inline)) return cleanName_(inline);

      if (i + 1 < lines.length && looksLikePersonName_(lines[i + 1])) {
        return cleanName_(lines[i + 1]);
      }
    }
  }

  return null;
}


/**
 * Handles the title variants described by the user:
 *
 * Citas Dra. Mariaraul (María Pérez)
 * María Pérez + Botox
 * María Pérez - Botox
 * María Pérez | Botox
 * María Pérez
 */
function extractNameFromTitle_(title) {
  if (!title) return null;
  let t = String(title).trim();

  const paren = t.match(/citas?\s+dra\.?\s*mariaraul\s*\(([^)]+)\)/i);
  if (paren && looksLikePersonName_(paren[1])) {
    return cleanName_(paren[1]);
  }

  t = t.replace(/^citas?\s+dra\.?\s*mariaraul\s*[:\-–—|]?\s*/i, "").trim();

  // If title is "Name + treatment", prefer the left side.
  const plusParts = t.split(/\s*\+\s*/);
  if (plusParts.length > 1 && looksLikePersonName_(plusParts[0])) {
    return cleanName_(plusParts[0]);
  }

  // Also tolerate "Name - treatment", "Name | treatment", "Name / treatment".
  const sepParts = t.split(/\s+(?:-|–|—|\||\/)\s+/);
  if (sepParts.length > 1 && looksLikePersonName_(sepParts[0])) {
    return cleanName_(sepParts[0]);
  }

  // Last resort: use the whole title only if it looks remotely name-like.
  if (looksLikePersonName_(t)) {
    return cleanName_(t);
  }

  return null;
}


function looksLikePersonName_(value) {
  if (!value) return false;
  const s = String(value).trim();

  if (s.length < 2 || s.length > 80) return false;
  if (/@/.test(s)) return false;
  if (/\d{4,}/.test(s)) return false;
  if (/^(procedimiento|servicio|tratamiento|cita|consulta)\s*:/i.test(s)) return false;

  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(s);
}


function cleanName_(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,\-–—|]+|[\s:;,\-–—|]+$/g, "")
    .trim();
}


function safe_(value) {
  return value == null ? "" : String(value);
}


function safeEventId_(event) {
  try {
    return event.getId() || "";
  } catch (e) {
    return "";
  }
}
