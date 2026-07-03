/**
 * Session Object schema — issued by the Google Apps Script gateway after authentication.
 * See docs/architecture/SECURITY_ARCHITECTURE.md (Session model) and apps/gateway/Auth.gs.
 *
 * A session is a short-lived, signed token. The gateway is the only component that ever
 * verifies or issues these — the browser treats it as an opaque string.
 *
 * @typedef {'owner'|'administrator'|'content_creator'|'viewer'|'guest'} Role
 *
 * @typedef {Object} SessionObject
 * @property {string} sessionId
 * @property {string} userId
 * @property {Role} role
 * @property {number} createdAt   epoch ms
 * @property {number} expiresAt   epoch ms
 * @property {string[]} permissionScope
 */

const ROLES = ['owner', 'administrator', 'content_creator', 'viewer', 'guest'];

// v1 permission matrix. Full enterprise RBAC (per-brand overrides, custom roles) is deferred —
// see docs/architecture/SECURITY_ARCHITECTURE.md and the Architecture Review Report, Contradiction #7.
const ROLE_PERMISSIONS = {
  owner: ['*'],
  administrator: ['project:read', 'project:write', 'brand:read', 'brand:write', 'campaign:read', 'campaign:write', 'config:read', 'config:write'],
  content_creator: ['project:read', 'project:write', 'brand:read', 'campaign:read', 'campaign:write'],
  viewer: ['project:read', 'brand:read', 'campaign:read'],
  guest: ['campaign:read'],
};

/**
 * @param {Partial<SessionObject>} fields
 * @returns {SessionObject}
 */
export function createSession(fields = {}) {
  const role = ROLES.includes(fields.role) ? fields.role : 'viewer';
  const now = fields.createdAt ?? Date.now();
  return {
    sessionId: fields.sessionId || '',
    userId: fields.userId || '',
    role,
    createdAt: now,
    expiresAt: fields.expiresAt ?? now + 1000 * 60 * 60 * 12, // 12h default
    permissionScope: fields.permissionScope || ROLE_PERMISSIONS[role],
  };
}

/**
 * @param {SessionObject} session
 * @param {string} permission
 * @returns {boolean}
 */
export function sessionHasPermission(session, permission) {
  if (!session || !session.permissionScope) return false;
  return session.permissionScope.includes('*') || session.permissionScope.includes(permission);
}

/**
 * @param {SessionObject} session
 * @param {number} [now]
 * @returns {boolean}
 */
export function isSessionExpired(session, now = Date.now()) {
  return !session || now >= session.expiresAt;
}

export const SESSION_ROLES = ROLES;
export const SESSION_ROLE_PERMISSIONS = ROLE_PERMISSIONS;
