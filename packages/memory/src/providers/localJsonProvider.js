/**
 * Local JSON Memory Provider — offline development backend. Same `RecordStore` engine as
 * `inMemoryProvider.js`, plus persistence to a single JSON file on disk, so state survives process
 * restarts without needing any Google service or external database. Good for CLI tools, local
 * scripts, and single-machine deployments that don't need Drive/Sheets.
 *
 * Loads lazily on first use (MCP_ARCHITECTURE.md's "Lazy-load" rule applies here too — no reason
 * to touch disk at construction time) and persists serially (a promise chain, not a lock file) so
 * concurrent writes from the same process never interleave and corrupt the file. This is a
 * single-process convenience store, not a multi-process-safe database — see "Failure Modes" in
 * packages/memory/README.md.
 */
import { defineMemoryProvider } from '../memoryProviderInterface.js';
import { RecordStore } from '../recordStore.js';

/** @param {{filePath?: string, id?: string, fsImpl?: typeof import('node:fs/promises')}} [options] */
export function createLocalJsonMemoryProvider({ filePath, id = 'local-json', fsImpl } = {}) {
  if (!filePath) {
    return defineMemoryProvider({
      id,
      healthStatus: 'unavailable',
      async read() { throw new Error(`Memory provider "${id}" has no filePath configured.`); },
      async write() { throw new Error(`Memory provider "${id}" has no filePath configured.`); },
      async update() { throw new Error(`Memory provider "${id}" has no filePath configured.`); },
      async delete() { throw new Error(`Memory provider "${id}" has no filePath configured.`); },
      async search() { throw new Error(`Memory provider "${id}" has no filePath configured.`); },
      async list() { throw new Error(`Memory provider "${id}" has no filePath configured.`); },
    });
  }

  let fs = fsImpl;
  let storePromise = null;
  let writeQueue = Promise.resolve();

  async function getFs() {
    if (!fs) fs = await import('node:fs/promises');
    return fs;
  }

  async function loadStore() {
    const fsModule = await getFs();
    let entries = [];
    try {
      const raw = await fsModule.readFile(filePath, 'utf8');
      entries = JSON.parse(raw);
    } catch (err) {
      if (err.code !== 'ENOENT') throw new Error(`Failed to load memory file "${filePath}": ${err.message}`);
    }
    return RecordStore.fromEntries(entries, { onChange: persist });
  }

  function getStore() {
    if (!storePromise) {
      // If loadStore() fails (e.g. a transient/permission read error, not a missing file), don't
      // cache the rejection forever — clear it so the *next* call retries instead of every future
      // operation on this provider failing with the same stale error.
      storePromise = loadStore().catch((err) => {
        storePromise = null;
        throw err;
      });
    }
    return storePromise;
  }

  function persist() {
    // Chain after the previous write regardless of whether it succeeded, so writes stay ordered
    // without a *permanently* rejected queue: `.then()` on a rejected promise never runs, so
    // without this `.catch(() => {})`, one transient disk error (e.g. disk full) would poison
    // `writeQueue` forever — every future read/write/search/list would throw that same stale
    // error, even though the in-memory store is perfectly healthy. The attempt promise itself
    // (returned below) still rejects normally, so the *caller* of the failing write still sees it.
    const attempt = writeQueue.catch(() => {}).then(async () => {
      const store = await getStore();
      const fsModule = await getFs();
      try {
        await fsModule.writeFile(filePath, JSON.stringify(store.toJSON(), null, 2), 'utf8');
      } catch (err) {
        throw new Error(`Failed to persist memory file "${filePath}": ${err.message}`);
      }
    });
    writeQueue = attempt;
    return attempt;
  }

  async function withStore(fn) {
    const store = await getStore();
    const result = await fn(store);
    await writeQueue; // ensure the caller's mutation is durably on disk before resolving
    return result;
  }

  return defineMemoryProvider({
    id,
    healthStatus: 'healthy',
    read: (collection, key) => withStore((store) => store.read(collection, key)),
    write: (collection, key, data, options) => withStore((store) => store.write(collection, key, data, options)),
    update: (collection, key, patch, options) => withStore((store) => store.update(collection, key, patch, options)),
    delete: (collection, key) => withStore((store) => store.delete(collection, key)),
    search: (collection, query) => withStore((store) => store.search(collection, query)),
    list: (collection, options) => withStore((store) => store.list(collection, options)),
  });
}
