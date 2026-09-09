/**
 * Idempotency: one reminder per event occurrence.
 * Including the start timestamp handles recurring events safely.
 */
function buildEventKey_(event) {
  return [
    safeEventId_(event),
    event.getStartTime().toISOString(),
  ].join("|");
}


function sentPropertyKey_(eventKey) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    eventKey,
    Utilities.Charset.UTF_8
  );

  const hex = digest
    .map(b => ("0" + ((b < 0 ? b + 256 : b).toString(16))).slice(-2))
    .join("");

  return "SENT_" + hex;
}


function wasSent_(eventKey) {
  return Boolean(
    PropertiesService.getScriptProperties().getProperty(
      sentPropertyKey_(eventKey)
    )
  );
}


function markSent_(eventKey, when) {
  PropertiesService.getScriptProperties().setProperty(
    sentPropertyKey_(eventKey),
    when.toISOString()
  );
}
