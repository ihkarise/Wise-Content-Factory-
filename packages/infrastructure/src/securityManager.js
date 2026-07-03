/**
 * Security Manager — the only place secrets are ever touched. Providers, Agents, and Engines
 * receive resolved capability results, never raw API keys. See docs/architecture/SECURITY_ARCHITECTURE.md.
 *
 * This module is used by apps/gateway's tests and by Node-side tooling. The live Google Apps
 * Script gateway (apps/gateway/*.gs) re-implements the same HMAC-signed-token design using
 * Utilities.computeHmacSha256Signature, because GAS's V8 runtime does not support importing this
 * package directly (see apps/gateway/README.md). Keep the two implementations in sync if you
 * change the token format.
 *
 * IMPORTANT (see the Architecture Review Report, Security Review #3): Google Apps Script's
 * PropertiesService is plaintext to anyone with edit access to the script project. It is NOT a
 * secrets vault. `encryptSecret`/`decryptSecret` below add an application-level layer on top of
 * whatever storage is used, so a leaked Script Properties export is not immediately usable.
 * This is a defense-in-depth measure, not a substitute for a real secrets manager in production.
 */

import { createHmac, randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';

const SECRET_LIKE_KEYS = /key|token|secret|password|credential|authorization/i;

/**
 * Recursively strip anything that looks like a secret before it is logged, matching
 * CLAUDE.md's Logging rule: "Never log: Secrets, API Keys, Private Documents, Sensitive User Data."
 * @param {any} value
 */
export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET_LIKE_KEYS.test(k) ? '[REDACTED]' : redact(v)])
    );
  }
  return value;
}

/** @param {string} plaintext @param {string} passphrase */
export function encryptSecret(plaintext, passphrase) {
  const salt = randomBytes(16);
  const key = scryptSync(passphrase, salt, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, authTag, encrypted]).toString('base64');
}

/** @param {string} payload @param {string} passphrase */
export function decryptSecret(payload, passphrase) {
  const raw = Buffer.from(payload, 'base64');
  const salt = raw.subarray(0, 16);
  const iv = raw.subarray(16, 28);
  const authTag = raw.subarray(28, 44);
  const encrypted = raw.subarray(44);
  const key = scryptSync(passphrase, salt, 32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Short-lived signed session token (see SECURITY_ARCHITECTURE.md, Security Review recommendation
 * "design a concrete signed-token session scheme"). Format: base64(payload).base64(hmac).
 * @param {import('@wcf/core').SessionObject} session
 * @param {string} signingSecret
 */
export function signSessionToken(session, signingSecret) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = createHmac('sha256', signingSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

/**
 * @param {string} token
 * @param {string} signingSecret
 * @returns {import('@wcf/core').SessionObject}
 */
export function verifySessionToken(token, signingSecret) {
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) throw new Error('Malformed session token');
  const expected = createHmac('sha256', signingSecret).update(payload).digest('base64url');
  if (!timingSafeEqualStrings(signature, expected)) throw new Error('Invalid session token signature');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function timingSafeEqualStrings(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
