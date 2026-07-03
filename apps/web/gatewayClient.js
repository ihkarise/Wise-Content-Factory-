/**
 * Talks to the Google Apps Script gateway. This is the ONLY file in apps/web allowed to know the
 * gateway's URL/session token — see docs/architecture/SECURITY_ARCHITECTURE.md ("The browser never
 * communicates directly with AI providers"). The browser holds a short-lived session token, never
 * a provider API key.
 *
 * Sent as `text/plain` rather than `application/json` deliberately — see apps/gateway/Code.gs's
 * CORS note: a JSON content-type from a browser triggers a CORS preflight (OPTIONS) that Apps
 * Script Web Apps cannot answer. `text/plain` is a "simple request" and skips preflight; the
 * gateway still parses the body as JSON regardless of the declared content type.
 */
import { GATEWAY_URL } from './config.js';

const SESSION_STORAGE_KEY = 'wcf_session_token';

export function isGatewayConfigured() {
  return Boolean(GATEWAY_URL);
}

// localStorage can throw (not just return null) in some browser configurations — e.g. Safari
// private browsing historically, or an org policy disabling site storage — so every access is
// guarded rather than left to crash the caller for what should be a soft "not signed in" state.
export function getStoredSessionToken() {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeSessionToken(token) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, token);
  } catch {
    // Session simply won't persist across reloads in this environment — the login itself still
    // succeeded, so don't fail the caller over it.
  }
}

export function clearSessionToken() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage was never writable in the first place.
  }
}

/**
 * @param {string} action
 * @param {Object} payload
 */
async function callGateway(action, payload = {}) {
  if (!GATEWAY_URL) throw new Error('GATEWAY_URL is not configured (see apps/web/config.js).');
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!response.ok) throw new Error(`Gateway returned HTTP ${response.status}. Check GATEWAY_URL and that the Apps Script deployment is live.`);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Gateway returned a response that was not valid JSON — check the deployed Apps Script for errors.');
  }
  if (!data.ok) throw new Error(data.error || 'Gateway request failed');
  return data.result;
}

/**
 * @param {string} passphrase
 * @param {string} [userId]
 */
export async function login(passphrase, userId = 'owner') {
  const result = await callGateway('login', { passphrase, userId });
  storeSessionToken(result.sessionToken);
  return result.sessionToken;
}

/**
 * @param {import('@wcf/core').CapabilityRequest} capabilityRequest
 */
export async function requestCapability(capabilityRequest) {
  const sessionToken = getStoredSessionToken();
  if (!sessionToken) throw new Error('Not signed in to the gateway.');
  const jobStatus = await callGateway('capability_request', { sessionToken, capabilityRequest });
  if (jobStatus.status === 'failed') throw new Error(jobStatus.error || 'Gateway job failed');
  return jobStatus.result;
}
