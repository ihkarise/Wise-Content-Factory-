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
    if (!storePromise) storePromise = loadStore();
    return storePromise;
  }

  function persist() {
    writeQueue = writeQueue.then(async () => {
      const store = await getStore();
      const fsModule = await getFs();
      await fsModule.writeFile(filePath, JSON.stringify(store.toJSON(), null, 2), 'utf8');
    });
    return writeQueue;
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
