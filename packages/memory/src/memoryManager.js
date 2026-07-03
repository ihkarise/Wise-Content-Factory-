/**
 * Memory Manager — the single gateway between Wise Content Factory and every Memory Provider,
 * mirroring `McpManager` (MCP servers) and `PublishingManager` (social platforms). Engines and
 * Agents never talk to a storage backend directly; they always go through
 * `memoryManager.read/write/update/delete/search/list(collection, ...)`.
 *
 * Routes by *collection* (docs/architecture/PLATFORM_ARCHITECTURE.md's Memory levels: Global,
 * Brand, Project, Conversation, plus this platform's Campaign/Asset/Prompt Library/Template
 * Library/Knowledge Cache — see collections.js), not by cost tier like ProviderRouter — "store
 * Assets in Drive, structured Brand/Project/Campaign metadata in Sheets, small Global config in
 * PropertiesService" is a deliberate per-collection choice, not a ranked fallback chain. A single
 * default provider (e.g. the in-memory or local-JSON adapter) can still back every collection that
 * has no specific provider registered, so the platform is never left without storage.
 *
 * Optionally read-through caches with `packages/infrastructure`'s CacheEngine-style store (same
 * `{get,set,has,delete}` contract as `createInMemoryCacheStore`) to satisfy the Performance
 * requirements ("avoid duplicate storage", "optimize reads") without duplicating that engine.
 */

const DEFAULT_CACHE_TTL_MS = 60_000;

export class MemoryManager {
  /** @param {{cacheStore?: import('@wcf/infrastructure').CacheStore, cacheTtlMs?: number}} [options] */
  constructor({ cacheStore, cacheTtlMs = DEFAULT_CACHE_TTL_MS } = {}) {
    /** @type {Map<string, import('./memoryProviderInterface.js').MemoryProvider>} */
    this.providersByCollection = new Map();
    this.defaultProvider = null;
    this.cacheStore = cacheStore ?? null;
    this.cacheTtlMs = cacheTtlMs;
  }

  /**
   * @param {import('./memoryProviderInterface.js').MemoryProvider} provider
   * @param {{collections?: string[]}} [options] Omit `collections` to register as the fallback
   *   used by any collection with no specific provider.
   */
  registerProvider(provider, { collections } = {}) {
    if (!provider?.id) throw new Error('Memory provider must have an id');
    if (collections?.length) {
      for (const collection of collections) this.providersByCollection.set(collection, provider);
    } else {
      this.defaultProvider = provider;
    }
  }

  unregisterProvider(collection) {
    this.providersByCollection.delete(collection);
  }

  /** @param {string} collection */
  getProvider(collection) {
    const provider = this.providersByCollection.get(collection) || this.defaultProvider;
    if (!provider) throw new Error(`No memory provider registered for collection "${collection}" (and no default provider).`);
    if (provider.healthStatus === 'unavailable') {
      throw new Error(`Memory provider "${provider.id}" for collection "${collection}" is unavailable (not configured).`);
    }
    return provider;
  }

  _cacheKey(collection, key) {
    return `memory:${collection}:${key}`;
  }

  _invalidate(collection, key) {
    this.cacheStore?.delete(this._cacheKey(collection, key));
  }

  /** @param {string} collection @param {string} key */
  async read(collection, key) {
    const cacheKey = this._cacheKey(collection, key);
    if (this.cacheStore?.has(cacheKey)) return this.cacheStore.get(cacheKey);
    const record = await this.getProvider(collection).read(collection, key);
    if (record) this.cacheStore?.set(cacheKey, record, this.cacheTtlMs);
    return record;
  }

  /** @param {string} collection @param {string} key @param {any} data @param {Object} [options] */
  async write(collection, key, data, options) {
    const record = await this.getProvider(collection).write(collection, key, data, options);
    this._invalidate(collection, key);
    return record;
  }

  /** @param {string} collection @param {string} key @param {any} patch @param {Object} [options] */
  async update(collection, key, patch, options) {
    const record = await this.getProvider(collection).update(collection, key, patch, options);
    this._invalidate(collection, key);
    return record;
  }

  /** @param {string} collection @param {string} key */
  async delete(collection, key) {
    const deleted = await this.getProvider(collection).delete(collection, key);
    this._invalidate(collection, key);
    return deleted;
  }

  /** @param {string} collection @param {import('./memoryProviderInterface.js').MemoryQuery} [query] */
  async search(collection, query) {
    return this.getProvider(collection).search(collection, query);
  }

  /** @param {string} collection @param {{limit?: number, offset?: number}} [options] */
  async list(collection, options) {
    return this.getProvider(collection).list(collection, options);
  }

  /** @param {string} collection @param {string} queryText @param {Object} [options] */
  async semanticSearch(collection, queryText, options) {
    return this.getProvider(collection).semanticSearch(collection, queryText, options);
  }
}
