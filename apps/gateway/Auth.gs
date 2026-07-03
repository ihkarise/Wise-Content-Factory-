/**
 * Signed, short-lived session tokens — no Google sign-in required (Access is ANYONE_ANONYMOUS,
 * see README.md). Mirrors the format in packages/infrastructure/src/securityManager.js
 * (base64url(payload).base64url(hmacSha256(payload))) using GAS's Utilities service instead of
 * Node's crypto module. The two are independent implementations for independent runtimes, not
 * meant to cross-verify each other's tokens.
 */

var SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function createSession_(fields) {
  var role = fields.role || 'viewer';
  var now = fields.createdAt || Date.now();
  return {
    sessionId: fields.sessionId || Utilities.getUuid(),
    userId: fields.userId,
    role: role,
    createdAt: now,
    expiresAt: fields.expiresAt || (now + SESSION_TTL_MS),
  };
}

function issueSession_(userId, role) {
  var secret = getRequiredScriptProperty_('SESSION_SIGNING_SECRET');
  var session = createSession_({ userId: userId, role: role });
  return signSessionToken_(session, secret);
}

function signSessionToken_(session, signingSecret) {
  var payloadB64 = base64UrlEncode_(JSON.stringify(session));
  var signatureBytes = Utilities.computeHmacSha256Signature(payloadB64, signingSecret);
  var signatureB64 = base64UrlEncode_(signatureBytes);
  return payloadB64 + '.' + signatureB64;
}

function verifySessionToken_(token, signingSecret) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('Malformed session token');
  var payloadB64 = parts[0];
  var signatureB64 = parts[1];
  var expectedBytes = Utilities.computeHmacSha256Signature(payloadB64, signingSecret);
  var expectedB64 = base64UrlEncode_(expectedBytes);
  if (!timingSafeEqual_(signatureB64, expectedB64)) throw new Error('Invalid session token signature');
  return JSON.parse(base64UrlDecodeToString_(payloadB64));
}

/**
 * Verifies a request's session token, throwing if missing/invalid/expired, and enforces the
 * v1 permission matrix mirrored from packages/core/src/schemas/session.js.
 * @param {string} token
 * @param {string} [requiredPermission]
 */
function requireSession_(token, requiredPermission) {
  var secret = getRequiredScriptProperty_('SESSION_SIGNING_SECRET');
  var session = verifySessionToken_(token, secret);
  if (Date.now() >= session.expiresAt) throw new Error('Session expired');
  if (requiredPermission && !sessionHasPermission_(session, requiredPermission)) {
    throw new Error('Session role "' + session.role + '" lacks permission "' + requiredPermission + '"');
  }
  return session;
}

var ROLE_PERMISSIONS_ = {
  owner: ['*'],
  administrator: ['project:read', 'project:write', 'brand:read', 'brand:write', 'campaign:read', 'campaign:write', 'config:read', 'config:write'],
  content_creator: ['project:read', 'project:write', 'brand:read', 'campaign:read', 'campaign:write'],
  viewer: ['project:read', 'brand:read', 'campaign:read'],
  guest: ['campaign:read'],
};

function sessionHasPermission_(session, permission) {
  var scope = ROLE_PERMISSIONS_[session.role] || [];
  return scope.indexOf('*') !== -1 || scope.indexOf(permission) !== -1;
}

function base64UrlEncode_(data) {
  return Utilities.base64EncodeWebSafe(data).replace(/=+$/, '');
}

function base64UrlDecodeToString_(value) {
  var padded = value + Array((4 - (value.length % 4)) % 4 + 1).join('=');
  var bytes = Utilities.base64DecodeWebSafe(padded);
  return Utilities.newBlob(bytes).getDataAsString();
}

function timingSafeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var mismatch = 0;
  for (var i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function getRequiredScriptProperty_(key) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) throw new Error('Missing required script property: ' + key);
  return value;
}
