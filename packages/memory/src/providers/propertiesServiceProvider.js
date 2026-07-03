/**
 * Google Apps Script PropertiesService Memory Provider — **configuration only**, per the explicit
 * scope given for this adapter. `PropertiesService` caps each property at ~9KB and ~500KB total
 * per store (Script/User/Document Properties), so this is deliberately not used for Brand/Project/
 * Campaign/Asset records — register it only for the `global` collection (small config knobs), and
 * use Drive/Sheets for anything larger or more structured.
 *
 * `PropertiesService` is a Google Apps Script global — it does not exist in Node. This file is the
 * *interface-conformant* adapter used by `packages/memory` (Node) and by tests: it accepts an
 * injected `propertiesService` (defaulting to `globalThis.PropertiesService`, which is undefined
 * outside GAS, so `healthStatus` is `'unavailable'` in Node — same pattern as
 * `packages/providers/src/browserTtsProvider.js`'s SpeechSynthesis detection). The actual
 * production code path for the live Apps Script gateway is `apps/gateway/Memory.gs`, a plain
 * global-scope `.gs` file (GAS can't `import` this package — see
 * `packages/infrastructure/src/securityManager.js`'s comment on the same constraint for
 * `Auth.gs`/`Secrets.gs`). Keep the two in sync if the storage key format changes.
 *
 * Only text (JSON-serialized) values are supported, since PropertiesService only stores strings.
 * `search`/`list` require enumerating all property keys — fine at the "global config" scale this
 * adapter is scoped to, not appropriate at Brand/Project/Asset scale (again, use Drive/Sheets).
 */
import { defineMemoryProvider, matchesQuery } from '../memoryProviderInterface.js';
import { createMemoryRecord, applyMemoryUpdate } from '../memoryRecord.js';

const KEY_PREFIX = 'wcf_memory__';

function detectPropertiesService(injected) {
  if (injected) return injected;
  return typeof globalThis !== 'undefined' ? globalThis.PropertiesService : undefined;
}

/** @param {{id?: string, propertiesService?: any, store?: 'script'|'user'|'document'}} [options] */
export function createPropertiesServiceMemoryProvider({ id = 'properties-service', propertiesService, store = 'script' } = {}) {
  const service = detectPropertiesService(propertiesService);
  if (!service) {
    return defineMemoryProvider({
      id,
      healthStatus: 'unavailable',
      async read() { throw new Error(`Memory provider "${id}" requires a Google Apps Script PropertiesService, which is not available here.`); },
      async write() { throw new Error(`Memory provider "${id}" requires a Google Apps Script PropertiesService, which is not available here.`); },
      async update() { throw new Error(`Memory provider "${id}" requires a Google Apps Script PropertiesService, which is not available here.`); },
      async delete() { throw new Error(`Memory provider "${id}" requires a Google Apps Script PropertiesService, which is not available here.`); },
      async search() { throw new Error(`Memory provider "${id}" requires a Google Apps Script PropertiesService, which is not available here.`); },
      async list() { throw new Error(`Memory provider "${id}" requires a Google Apps Script PropertiesService, which is not available here.`); },
    });
  }

  const properties =
    store === 'user' ? service.getUserProperties() : store === 'document' ? service.getDocumentProperties() : service.getScriptProperties();

  function storageKey(collection, key) {
    return `${KEY_PREFIX}${collection}::${key}`;
  }

  function readRecord(collection, key) {
    const raw = properties.getProperty(storageKey(collection, key));
    return raw ? JSON.parse(raw) : null;
  }

  function writeRecord(record) {
    properties.setProperty(storageKey(record.collection, record.key), JSON.stringify(record));
  }

  function allRecordsIn(collection) {
    const all = properties.getProperties ? properties.getProperties() : {};
    return Object.entries(all)
      .filter(([k]) => k.startsWith(`${KEY_PREFIX}${collection}::`))
      .map(([, v]) => JSON.parse(v));
  }

  return defineMemoryProvider({
    id,
    healthStatus: 'healthy',
    async read(collection, key) {
      return readRecord(collection, key);
    },
    async write(collection, key, data, options = {}) {
      const existing = readRecord(collection, key);
      const record = createMemoryRecord({
        collection, key, data,
        tags: options.tags, relationships: options.relationships, metadata: options.metadata,
        version: existing ? existing.version + 1 : 1,
        previousVersions: existing ? [...existing.previousVersions, { version: existing.version, data: existing.data, updatedAt: existing.audit.updatedAt }] : [],
        audit: existing ? { createdAt: existing.audit.createdAt, createdBy: existing.audit.createdBy, updatedBy: options.actor } : { createdBy: options.actor, updatedBy: options.actor },
      });
      writeRecord(record);
      return record;
    },
    async update(collection, key, patch, options = {}) {
      const existing = readRecord(collection, key);
      if (!existing) throw new Error(`Cannot update: no record at collection "${collection}", key "${key}".`);
      const updated = applyMemoryUpdate(existing, patch, options);
      writeRecord(updated);
      return updated;
    },
    async delete(collection, key) {
      const existing = readRecord(collection, key);
      properties.deleteProperty(storageKey(collection, key));
      return Boolean(existing);
    },
    async search(collection, query = {}) {
      const results = allRecordsIn(collection).filter((r) => matchesQuery(r, query));
      return query.limit ? results.slice(0, query.limit) : results;
    },
    async list(collection, options = {}) {
      const all = allRecordsIn(collection);
      const offset = options.offset || 0;
      const end = options.limit ? offset + options.limit : undefined;
      return all.slice(offset, end);
    },
  });
}
