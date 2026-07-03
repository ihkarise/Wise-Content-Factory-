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

export function getStoredSessionToken() {
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

export function storeSessionToken(token) {
  localStorage.setItem(SESSION_STORAGE_KEY, token);
}

export function clearSessionToken() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
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
  const data = await response.json();
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
