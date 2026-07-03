/**
 * Cache Engine — caches every expensive operation so repeated requests never re-trigger a paid
 * provider call. See docs/architecture/AI_INFRASTRUCTURE.md ("Cache Engine") and the Architecture
 * Review Report, Cost Review #3: "if the cache backend is unspecified/absent, the entire
 * cost-optimization thesis silently fails."
 *
 * The default store is an in-memory Map, which is correct for tests, examples, and a single
 * gateway invocation. In apps/gateway (Google Apps Script) this must be backed by CacheService /
 * a real datastore across invocations — swap the `store` implementation, the interface below is
 * the contract both must satisfy.
 */

/**
 * @typedef {Object} CacheStore
 * @property {(key: string) => (any|undefined)} get
 * @property {(key: string, value: any, ttlMs: number) => void} set
 * @property {(key: string) => boolean} has
 * @property {(key: string) => void} delete
 */

const DEFAULT_MAX_ENTRIES = 5000;

/**
 * @param {{maxEntries?: number}} [options] Bounds the store's size (default 5000) so a
 *   long-running process with high cache-key cardinality (e.g. many distinct prompts, each cached
 *   under a unique key that's never revisited) can't grow this Map without limit — an unbounded
 *   memory leak otherwise, since TTL alone only expires entries lazily on `get`, never proactively.
 *   Oldest entries are evicted first once the cap is hit.
 */
export function createInMemoryCacheStore({ maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
  const map = new Map();
  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        map.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value, ttlMs) {
      map.delete(key); // re-set moves this key to the most-recently-inserted position below
      map.set(key, { value, expiresAt: Date.now() + ttlMs });
      while (map.size > maxEntries) {
        map.delete(map.keys().next().value);
      }
    },
    has(key) {
      return this.get(key) !== undefined;
    },
    delete(key) {
      map.delete(key);
    },
    size() {
      return map.size;
    },
  };
}

const DEFAULT_TTL_MS = 1000 * 60 * 60; // 1 hour

export class CacheEngine {
  /** @param {CacheStore} [store] */
  constructor(store = createInMemoryCacheStore()) {
    this.store = store;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Deterministic cache key for a capability request: same capability + same input + same
   * quality level should always hit the cache, regardless of request id or timestamp.
   * @param {import('@wcf/core').CapabilityRequest} request
   */
  static keyFor(request) {
    const stableInput = stableStringify(request.input || {});
    return `${request.capability}:${request.qualityLevel}:${stableInput}`;
  }

  /** @param {import('@wcf/core').CapabilityRequest} request */
  get(request) {
    const key = CacheEngine.keyFor(request);
    const value = this.store.get(key);
    if (value !== undefined) {
      this.hits += 1;
      return value;
    }
    this.misses += 1;
    return undefined;
  }

  /**
   * @param {import('@wcf/core').CapabilityRequest} request
   * @param {any} value
   * @param {number} [ttlMs]
   */
  set(request, value, ttlMs = DEFAULT_TTL_MS) {
    const key = CacheEngine.keyFor(request);
    this.store.set(key, value, ttlMs);
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}
