/**
 * Memory Record — the one shape every Memory Provider reads and writes, regardless of backend.
 * This is what makes Memory provider-independent (docs/architecture/PLATFORM_ARCHITECTURE.md,
 * "Memory Architecture"): business logic only ever sees this shape, never a Drive file, a Sheets
 * row, or a PropertiesService string — those are serialization details private to one adapter.
 *
 * @typedef {Object} MemoryRecord
 * @property {string} collection   One of MEMORY_COLLECTIONS (or a future custom collection).
 * @property {string} key          Unique within its collection (e.g. a brandId, projectId, or
 *   a composite like "campaign:pillfill:launch-2026").
 * @property {any} data            The actual payload — shape depends on collection, see
 *   collections.js for the documented conventions per collection.
 * @property {string[]} tags
 * @property {Record<string, string[]>} relationships  e.g. {brandId: ['pillfill'], projectId: [...]}
 * @property {Object} metadata     Free-form, adapter- or caller-defined.
 * @property {number} version      Starts at 1, incremented on every update().
 * @property {Array<{version: number, data: any, updatedAt: string}>} previousVersions
 *   Bounded history — see MAX_HISTORY_ENTRIES.
 * @property {{createdAt: string, updatedAt: string, createdBy: string|null, updatedBy: string|null}} audit
 */

export const MAX_HISTORY_ENTRIES = 20;

/** @param {Partial<MemoryRecord>} fields @returns {MemoryRecord} */
export function createMemoryRecord(fields = {}) {
  const now = new Date().toISOString();
  return {
    collection: fields.collection,
    key: fields.key,
    data: fields.data ?? null,
    tags: fields.tags || [],
    relationships: fields.relationships || {},
    metadata: fields.metadata || {},
    version: fields.version ?? 1,
    previousVersions: fields.previousVersions || [],
    audit: {
      createdAt: fields.audit?.createdAt || now,
      updatedAt: fields.audit?.updatedAt || now,
      createdBy: fields.audit?.createdBy ?? null,
      updatedBy: fields.audit?.updatedBy ?? null,
    },
  };
}

/**
 * Applies a partial update to an existing record: merges `patch` into `data` (shallow), bumps
 * the version, snapshots the pre-update state into `previousVersions` (bounded to the most recent
 * MAX_HISTORY_ENTRIES so a long-lived record can't grow without limit), and refreshes audit info.
 * Every adapter's `update()` should route through this so versioning behaves identically
 * everywhere — the one piece of business logic shared across backends.
 * @param {MemoryRecord} existing
 * @param {any} patch
 * @param {{tags?: string[], relationships?: Record<string,string[]>, metadata?: Object, actor?: string}} [options]
 */
export function applyMemoryUpdate(existing, patch, options = {}) {
  const now = new Date().toISOString();
  const mergedData =
    patch && typeof patch === 'object' && !Array.isArray(patch) && existing.data && typeof existing.data === 'object'
      ? { ...existing.data, ...patch }
      : patch;
  const snapshot = { version: existing.version, data: existing.data, updatedAt: existing.audit.updatedAt };
  const previousVersions = [...existing.previousVersions, snapshot].slice(-MAX_HISTORY_ENTRIES);
  return {
    ...existing,
    data: mergedData,
    tags: options.tags ?? existing.tags,
    relationships: options.relationships ?? existing.relationships,
    metadata: options.metadata ? { ...existing.metadata, ...options.metadata } : existing.metadata,
    version: existing.version + 1,
    previousVersions,
    audit: { ...existing.audit, updatedAt: now, updatedBy: options.actor ?? existing.audit.updatedBy },
  };
}
