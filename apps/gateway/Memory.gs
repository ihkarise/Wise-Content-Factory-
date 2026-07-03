/**
 * Google Apps Script PropertiesService Memory backend — configuration only, matching the scope
 * documented in packages/memory/src/providers/propertiesServiceProvider.js. PropertiesService
 * caps each property at ~9KB and ~500KB total per store, so this is for small global config
 * (feature flags, default quality level, active routing policy), never Brand/Project/Campaign/
 * Asset records — those belong in Drive/Sheets (see packages/memory/README.md).
 *
 * This is the real production implementation for the live Apps Script gateway. GAS's V8 runtime
 * cannot `import` packages/memory directly (every .gs file is concatenated into one global scope
 * — see securityManager.js's comment on the same constraint for Auth.gs/Secrets.gs), so this
 * reimplements the same record shape and versioning logic as
 * packages/memory/src/providers/propertiesServiceProvider.js in plain global functions. Keep the
 * two in sync if the record shape changes — test/gateway.test.mjs exercises this file directly via
 * gasHarness.mjs, it does not cross-verify against the Node adapter.
 */

var MEMORY_KEY_PREFIX_ = 'wcf_memory__';
var MEMORY_MAX_HISTORY_ = 20;

function memoryStorageKey_(collection, key) {
  return MEMORY_KEY_PREFIX_ + collection + '::' + key;
}

function memoryRead_(collection, key) {
  var raw = PropertiesService.getScriptProperties().getProperty(memoryStorageKey_(collection, key));
  return raw ? JSON.parse(raw) : null;
}

function memoryWrite_(collection, key, data, options) {
  options = options || {};
  var existing = memoryRead_(collection, key);
  var now = new Date().toISOString();
  var record = {
    collection: collection,
    key: key,
    data: data,
    tags: options.tags || (existing ? existing.tags : []),
    relationships: options.relationships || (existing ? existing.relationships : {}),
    metadata: options.metadata || (existing ? existing.metadata : {}),
    version: existing ? existing.version + 1 : 1,
    previousVersions: existing
      ? existing.previousVersions.concat([{ version: existing.version, data: existing.data, updatedAt: existing.audit.updatedAt }]).slice(-MEMORY_MAX_HISTORY_)
      : [],
    audit: {
      createdAt: existing ? existing.audit.createdAt : now,
      updatedAt: now,
      createdBy: existing ? existing.audit.createdBy : (options.actor || null),
      updatedBy: options.actor || null,
    },
  };
  PropertiesService.getScriptProperties().setProperty(memoryStorageKey_(collection, key), JSON.stringify(record));
  return record;
}

function memoryUpdate_(collection, key, patch, options) {
  options = options || {};
  var existing = memoryRead_(collection, key);
  if (!existing) throw new Error('Cannot update: no record at collection "' + collection + '", key "' + key + '".');
  var now = new Date().toISOString();
  var isPlainObjectPatch = patch && typeof patch === 'object' && !(patch instanceof Array);
  var mergedData = isPlainObjectPatch && existing.data && typeof existing.data === 'object' ? memoryMergeObjects_(existing.data, patch) : patch;
  var record = {
    collection: existing.collection,
    key: existing.key,
    data: mergedData,
    tags: options.tags || existing.tags,
    relationships: options.relationships || existing.relationships,
    metadata: options.metadata ? memoryMergeObjects_(existing.metadata, options.metadata) : existing.metadata,
    version: existing.version + 1,
    previousVersions: existing.previousVersions.concat([{ version: existing.version, data: existing.data, updatedAt: existing.audit.updatedAt }]).slice(-MEMORY_MAX_HISTORY_),
    audit: {
      createdAt: existing.audit.createdAt,
      updatedAt: now,
      createdBy: existing.audit.createdBy,
      updatedBy: options.actor || existing.audit.updatedBy,
    },
  };
  PropertiesService.getScriptProperties().setProperty(memoryStorageKey_(collection, key), JSON.stringify(record));
  return record;
}

function memoryDelete_(collection, key) {
  var existing = memoryRead_(collection, key);
  PropertiesService.getScriptProperties().deleteProperty(memoryStorageKey_(collection, key));
  return !!existing;
}

function memoryList_(collection, options) {
  options = options || {};
  var all = PropertiesService.getScriptProperties().getProperties();
  var prefix = MEMORY_KEY_PREFIX_ + collection + '::';
  var results = [];
  for (var k in all) {
    if (all.hasOwnProperty(k) && k.indexOf(prefix) === 0) results.push(JSON.parse(all[k]));
  }
  var offset = options.offset || 0;
  var end = options.limit ? offset + options.limit : results.length;
  return results.slice(offset, end);
}

function memorySearch_(collection, query) {
  query = query || {};
  var all = memoryList_(collection, {});
  var results = [];
  for (var i = 0; i < all.length; i += 1) {
    if (memoryRecordMatches_(all[i], query)) results.push(all[i]);
  }
  return query.limit ? results.slice(0, query.limit) : results;
}

function memoryRecordMatches_(record, query) {
  var i;
  if (query.tags && query.tags.length) {
    for (i = 0; i < query.tags.length; i += 1) {
      if (record.tags.indexOf(query.tags[i]) === -1) return false;
    }
  }
  if (query.keyPrefix && record.key.indexOf(query.keyPrefix) !== 0) return false;
  if (query.textContains && JSON.stringify(record.data).toLowerCase().indexOf(query.textContains.toLowerCase()) === -1) return false;
  return true;
}

function memoryMergeObjects_(a, b) {
  var out = {};
  var k;
  for (k in a) { if (a.hasOwnProperty(k)) out[k] = a[k]; }
  for (k in b) { if (b.hasOwnProperty(k)) out[k] = b[k]; }
  return out;
}
