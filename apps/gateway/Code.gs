/**
 * Web app entry point. See README.md for deployment configuration and the CORS caveat below.
 *
 * CORS note: Apps Script Web Apps cannot set custom CORS headers or handle an OPTIONS preflight.
 * A POST with `Content-Type: application/json` from a browser triggers a CORS preflight that GAS
 * will not answer correctly. The GitHub Pages frontend therefore sends the JSON payload as a
 * `text/plain` body (a "simple request" that skips preflight) — doPost below parses it as JSON
 * regardless of the declared content type. See apps/web/gatewayClient.js.
 */

function doPost(e) {
  return respond_(handleRequest_(e));
}

function doGet(e) {
  // Only used for a lightweight health check; all real traffic is POST.
  return respond_({ status: 'ok', service: 'wise-content-factory-gateway' });
}

function handleRequest_(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw) throw new Error('Missing request body');
    var request = JSON.parse(raw);
    var result = dispatch_(request);
    return { ok: true, result: result };
  } catch (err) {
    logSecurely_('gateway_error', { message: err && err.message });
    // Never leak stack traces or internal details to the client — only the message, which every
    // handler above is written to keep user-safe (see CLAUDE.md, "Error Handling").
    return { ok: false, error: err && err.message ? err.message : 'Internal error' };
  }
}

function respond_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

/** Structured logging that never writes secret-like values, matching CLAUDE.md's Logging rule. */
function logSecurely_(event, data) {
  Logger.log(JSON.stringify({ event: event, data: redact_(data), timestamp: Date.now() }));
}

var SECRET_LIKE_KEY_PATTERN_ = /key|token|secret|password|credential|authorization/i;

function redact_(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact_);
  var out = {};
  Object.keys(value).forEach(function (k) {
    out[k] = SECRET_LIKE_KEY_PATTERN_.test(k) ? '[REDACTED]' : redact_(value[k]);
  });
  return out;
}
