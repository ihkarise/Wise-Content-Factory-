/**
 * In-memory Memory Provider — development/testing backend. Zero setup, zero persistence across
 * process restarts (matches `packages/providers/src/mockProvider.js`'s role: always available,
 * always free, correct for tests/examples, not a production datastore). See
 * `localJsonProvider.js` for the offline-but-persistent variant of the same engine.
 */
import { defineMemoryProvider } from '../memoryProviderInterface.js';
import { RecordStore } from '../recordStore.js';

/** @param {{id?: string}} [options] */
export function createInMemoryMemoryProvider({ id = 'in-memory' } = {}) {
  const store = new RecordStore();
  return defineMemoryProvider({
    id,
    healthStatus: 'healthy',
    read: (...args) => store.read(...args),
    write: (...args) => store.write(...args),
    update: (...args) => store.update(...args),
    delete: (...args) => store.delete(...args),
    search: (...args) => store.search(...args),
    list: (...args) => store.list(...args),
  });
}
