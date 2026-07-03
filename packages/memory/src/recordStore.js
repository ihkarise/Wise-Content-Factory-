/**
 * In-process CRUD engine over a `Map<"collection::key", MemoryRecord>`, shared by the in-memory
 * and local-JSON providers (local JSON is just this plus disk persistence hooks) so versioning,
 * search, and list logic exists exactly once (CLAUDE.md: "never duplicate business logic").
 */
import { applyMemoryUpdate, nextMemoryRecordVersion } from './memoryRecord.js';
import { matchesQuery } from './memoryProviderInterface.js';

export class RecordStore {
  /** @param {{onChange?: () => void}} [options] */
  constructor({ onChange } = {}) {
    /** @type {Map<string, import('./memoryRecord.js').MemoryRecord>} */
    this.records = new Map();
    this.onChange = onChange || (() => {});
  }

  _mapKey(collection, key) {
    return `${collection}::${key}`;
  }

  async read(collection, key) {
    return this.records.get(this._mapKey(collection, key)) ?? null;
  }

  async write(collection, key, data, options = {}) {
    const existing = this.records.get(this._mapKey(collection, key));
    const record = nextMemoryRecordVersion(existing, { collection, key, data, options });
    this.records.set(this._mapKey(collection, key), record);
    this.onChange();
    return record;
  }

  async update(collection, key, patch, options = {}) {
    const existing = this.records.get(this._mapKey(collection, key));
    if (!existing) throw new Error(`Cannot update: no record at collection "${collection}", key "${key}".`);
    const updated = applyMemoryUpdate(existing, patch, options);
    this.records.set(this._mapKey(collection, key), updated);
    this.onChange();
    return updated;
  }

  async delete(collection, key) {
    const existed = this.records.delete(this._mapKey(collection, key));
    if (existed) this.onChange();
    return existed;
  }

  async search(collection, query = {}) {
    const results = [...this.records.values()].filter((r) => r.collection === collection && matchesQuery(r, query));
    return query.limit ? results.slice(0, query.limit) : results;
  }

  async list(collection, options = {}) {
    const all = [...this.records.values()].filter((r) => r.collection === collection);
    const offset = options.offset || 0;
    const end = options.limit ? offset + options.limit : undefined;
    return all.slice(offset, end);
  }

  /** Serializes the whole store — used by the local-JSON provider to persist to disk. */
  toJSON() {
    return [...this.records.entries()];
  }

  /** @param {Array<[string, import('./memoryRecord.js').MemoryRecord]>} entries */
  static fromEntries(entries, options) {
    const store = new RecordStore(options);
    for (const [mapKey, record] of entries) store.records.set(mapKey, record);
    return store;
  }
}
