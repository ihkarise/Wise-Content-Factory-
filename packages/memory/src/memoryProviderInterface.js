/**
 * Every Memory Provider (in-memory, local JSON, PropertiesService, Google Drive, Google Sheets,
 * and any future SQLite/Postgres/Supabase/Firestore adapter) must implement the same interface,
 * mirroring `packages/providers/src/providerInterface.js` for AI vendors and
 * `packages/publishing/src/publishingProviderInterface.js` for platforms. Business logic
 * (`MemoryManager`, Engines, Agents) only ever calls these methods — never a backend's native API
 * directly.
 *
 * @typedef {Object} MemoryQuery
 * @property {string[]} [tags]        Records must have every listed tag (AND match).
 * @property {string} [keyPrefix]     Records whose key starts with this prefix.
 * @property {string} [textContains]  Case-insensitive substring match against JSON.stringify(data).
 * @property {number} [limit]
 *
 * @typedef {Object} MemoryProvider
 * @property {string} id
 * @property {'healthy'|'unavailable'} healthStatus
 * @property {(collection: string, key: string) => Promise<import('./memoryRecord.js').MemoryRecord|null>} read
 * @property {(collection: string, key: string, data: any, options?: {tags?: string[], relationships?: Object, metadata?: Object, actor?: string}) => Promise<import('./memoryRecord.js').MemoryRecord>} write
 * @property {(collection: string, key: string, patch: any, options?: {tags?: string[], relationships?: Object, metadata?: Object, actor?: string}) => Promise<import('./memoryRecord.js').MemoryRecord>} update
 * @property {(collection: string, key: string) => Promise<boolean>} delete
 * @property {(collection: string, query?: MemoryQuery) => Promise<import('./memoryRecord.js').MemoryRecord[]>} search
 * @property {(collection: string, options?: {limit?: number, offset?: number}) => Promise<import('./memoryRecord.js').MemoryRecord[]>} list
 * @property {(collection: string, queryText: string, options?: Object) => Promise<import('./memoryRecord.js').MemoryRecord[]>} semanticSearch
 */

const REQUIRED_FUNCTIONS = ['read', 'write', 'update', 'delete', 'search', 'list'];

/**
 * @param {Partial<MemoryProvider>} fields
 * @returns {MemoryProvider}
 */
export function defineMemoryProvider(fields) {
  for (const fn of REQUIRED_FUNCTIONS) {
    if (typeof fields[fn] !== 'function') {
      throw new Error(`Memory provider "${fields.id ?? '(unnamed)'}" is missing required function "${fn}"`);
    }
  }
  return {
    id: fields.id,
    healthStatus: fields.healthStatus ?? 'healthy',
    read: fields.read,
    write: fields.write,
    update: fields.update,
    delete: fields.delete,
    search: fields.search,
    list: fields.list,
    semanticSearch:
      fields.semanticSearch ||
      (async () => {
        throw new Error(
          `Semantic lookup is not implemented for "${fields.id ?? '(unnamed)'}" yet — see "Future Extension Notes" in packages/memory/README.md.`
        );
      }),
  };
}

/** Simple, portable, in-process query matcher every adapter can reuse against a list of records. */
export function matchesQuery(record, query = {}) {
  if (query.tags?.length && !query.tags.every((tag) => record.tags.includes(tag))) return false;
  if (query.keyPrefix && !record.key.startsWith(query.keyPrefix)) return false;
  if (query.textContains && !JSON.stringify(record.data).toLowerCase().includes(query.textContains.toLowerCase())) return false;
  return true;
}
