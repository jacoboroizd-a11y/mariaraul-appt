/**
 * Sends the approved WhatsApp template:
 *
 * Buen día, {{1}} ✨
 *
 * Le recordamos que tiene una cita programada para mañana a las {{2}}.
 *
 * Por favor, confírmenos su asistencia respondiendo a este mensaje.
 *
 * Le recordamos que las cancelaciones realizadas con menos de 24 horas de
 * anticipación no aplican para devolución del depósito; sin embargo, este
 * podrá utilizarse para reprogramar su cita.
 *
 * ¡Muchas gracias! Esperamos verle mañana.
 *
 * IMPORTANT:
 * The template text and parameter order in WhatsApp Manager must match.
 */
function sendReminderTemplate_(phone, name, timeText, cfg) {
  const url =
    `https://graph.facebook.com/${encodeURIComponent(cfg.GRAPH_API_VERSION)}/` +
    `${encodeURIComponent(cfg.WHATSAPP_PHONE_NUMBER_ID)}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "template",
    template: {
      name: cfg.TEMPLATE_NAME,
      language: {
        code: cfg.TEMPLATE_LANGUAGE,
      },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: name },
            { type: "text", text: timeText },
          ],
        },
      ],
    },
  };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${cfg.WHATSAPP_TOKEN}`,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  const body = response.getContentText();

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    parsed = { raw: body };
  }

  if (status < 200 || status >= 300) {
    throw new Error(
      `WhatsApp API error HTTP ${status}: ${JSON.stringify(parsed)}`
    );
  }

  return parsed;
}
