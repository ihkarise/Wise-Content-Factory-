/**
 * Google Sheets Memory Provider — structured metadata. One row per record in a configured
 * spreadsheet/sheet tab, one fixed column per `MemoryRecord` field (see COLUMNS below). Good fit
 * for Brand/Project/Campaign records: human-readable/editable in the Sheets UI, no API quota
 * concerns at this platform's scale, and it's the "structured metadata" backend named explicitly
 * in the brief (Drive is for documents/assets instead).
 *
 * Uses the Sheets REST API v4 directly over `fetch`. `accessToken` is injected by the caller, same
 * as every other provider in this repo.
 *
 * IMPORTANT — no true row deletion. `delete()` is a soft delete: it sets the `deleted` column to
 * `TRUE` rather than removing the row (real deletion needs a `batchUpdate` `deleteDimension`
 * request, which shifts every subsequent row index — this provider caches a key->row-number index
 * for fast writes, and shifting indices on every delete would make that cache correctness-critical
 * in a much more fragile way). `write()` on a soft-deleted key resurrects that same row. See
 * "Failure Modes" in packages/memory/README.md.
 */
import { defineMemoryProvider, matchesQuery } from '../memoryProviderInterface.js';
import { applyMemoryUpdate, nextMemoryRecordVersion } from '../memoryRecord.js';

const API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const COLUMNS = ['collection', 'key', 'data', 'tags', 'version', 'relationships', 'metadata', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'previousVersions', 'deleted'];
const DATA_START_ROW = 2; // row 1 is the header

/** @param {{spreadsheetId?: string, accessToken?: string, sheetName?: string, id?: string, fetchImpl?: typeof fetch}} [options] */
export function createGoogleSheetsMemoryProvider({
  spreadsheetId,
  accessToken,
  sheetName = 'Memory',
  id = 'google-sheets',
  fetchImpl = globalThis.fetch,
} = {}) {
  const configured = Boolean(spreadsheetId && accessToken);
  if (!configured) {
    return defineMemoryProvider({
      id,
      healthStatus: 'unavailable',
      async read() { throw new Error(`Memory provider "${id}" has no spreadsheetId/accessToken configured.`); },
      async write() { throw new Error(`Memory provider "${id}" has no spreadsheetId/accessToken configured.`); },
      async update() { throw new Error(`Memory provider "${id}" has no spreadsheetId/accessToken configured.`); },
      async delete() { throw new Error(`Memory provider "${id}" has no spreadsheetId/accessToken configured.`); },
      async search() { throw new Error(`Memory provider "${id}" has no spreadsheetId/accessToken configured.`); },
      async list() { throw new Error(`Memory provider "${id}" has no spreadsheetId/accessToken configured.`); },
    });
  }

  const authHeader = { authorization: `Bearer ${accessToken}` };
  let indexPromise = null; // lazy-loaded { rows: Map<rowNumber, string[]>, byMapKey: Map<string, rowNumber>, nextRow: number }

  async function sheetsRequest(path, init) {
    // A hung upstream connection would otherwise tie up the request indefinitely — Node's fetch
    // has no default timeout of its own.
    const response = await fetchImpl(`${API_BASE_URL}/${spreadsheetId}${path}`, {
      ...init,
      headers: { ...authHeader, 'content-type': 'application/json', ...(init?.headers || {}) },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Google Sheets API error ${response.status}: ${body}`);
    }
    return response.status === 204 ? null : response.json();
  }

  async function ensureHeader() {
    const data = await sheetsRequest(`/values/${encodeURIComponent(`${sheetName}!A1:M1`)}`);
    if (!data.values?.length) {
      await sheetsRequest(`/values/${encodeURIComponent(`${sheetName}!A1:M1`)}?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({ values: [COLUMNS] }),
      });
    }
  }

  async function loadIndex() {
    await ensureHeader();
    const data = await sheetsRequest(`/values/${encodeURIComponent(`${sheetName}!A2:M`)}`);
    const rows = new Map();
    const byMapKey = new Map();
    (data.values || []).forEach((row, i) => {
      const rowNumber = DATA_START_ROW + i;
      rows.set(rowNumber, row);
      if (row[0] !== undefined && row[1] !== undefined) byMapKey.set(`${row[0]}::${row[1]}`, rowNumber);
    });
    return { rows, byMapKey, nextRow: DATA_START_ROW + (data.values?.length || 0) };
  }

  function getIndex() {
    if (!indexPromise) {
      // If loadIndex() fails (e.g. a transient network error), don't cache the rejection forever
      // — clear it so the *next* call retries instead of every future operation on this provider
      // failing with the same stale error.
      indexPromise = loadIndex().catch((err) => {
        indexPromise = null;
        throw err;
      });
    }
    return indexPromise;
  }

  function recordToRow(record, deleted = false) {
    return [
      record.collection, record.key, JSON.stringify(record.data), JSON.stringify(record.tags),
      String(record.version), JSON.stringify(record.relationships), JSON.stringify(record.metadata),
      record.audit.createdAt, record.audit.updatedAt, record.audit.createdBy || '', record.audit.updatedBy || '',
      JSON.stringify(record.previousVersions), deleted ? 'TRUE' : 'FALSE',
    ];
  }

  function rowToRecord(row) {
    if (!row) return null;
    return {
      record: {
        collection: row[0], key: row[1], data: JSON.parse(row[2] || 'null'), tags: JSON.parse(row[3] || '[]'),
        version: Number(row[4] || 1), relationships: JSON.parse(row[5] || '{}'), metadata: JSON.parse(row[6] || '{}'),
        audit: { createdAt: row[7], updatedAt: row[8], createdBy: row[9] || null, updatedBy: row[10] || null },
        previousVersions: JSON.parse(row[11] || '[]'),
      },
      deleted: row[12] === 'TRUE',
    };
  }

  async function writeRow(rowNumber, row) {
    await sheetsRequest(`/values/${encodeURIComponent(`${sheetName}!A${rowNumber}:M${rowNumber}`)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: [row] }),
    });
  }

  async function appendRow(row) {
    const index = await getIndex();
    const rowNumber = index.nextRow;
    await writeRow(rowNumber, row);
    index.rows.set(rowNumber, row);
    index.byMapKey.set(`${row[0]}::${row[1]}`, rowNumber);
    index.nextRow += 1;
    return rowNumber;
  }

  async function readEntry(collection, key) {
    const index = await getIndex();
    const rowNumber = index.byMapKey.get(`${collection}::${key}`);
    if (rowNumber === undefined) return null;
    return { rowNumber, ...rowToRecord(index.rows.get(rowNumber)) };
  }

  return defineMemoryProvider({
    id,
    healthStatus: 'healthy',
    async read(collection, key) {
      const entry = await readEntry(collection, key);
      return entry && !entry.deleted ? entry.record : null;
    },
    async write(collection, key, data, options = {}) {
      const entry = await readEntry(collection, key);
      const existing = entry && !entry.deleted ? entry.record : null;
      const record = nextMemoryRecordVersion(existing, { collection, key, data, options });
      const row = recordToRow(record, false);
      if (entry) {
        await writeRow(entry.rowNumber, row);
        (await getIndex()).rows.set(entry.rowNumber, row);
      } else {
        await appendRow(row);
      }
      return record;
    },
    async update(collection, key, patch, options = {}) {
      const entry = await readEntry(collection, key);
      if (!entry || entry.deleted) throw new Error(`Cannot update: no record at collection "${collection}", key "${key}".`);
      const updated = applyMemoryUpdate(entry.record, patch, options);
      const row = recordToRow(updated, false);
      await writeRow(entry.rowNumber, row);
      (await getIndex()).rows.set(entry.rowNumber, row);
      return updated;
    },
    async delete(collection, key) {
      const entry = await readEntry(collection, key);
      if (!entry || entry.deleted) return false;
      const row = recordToRow(entry.record, true);
      await writeRow(entry.rowNumber, row);
      (await getIndex()).rows.set(entry.rowNumber, row);
      return true;
    },
    async search(collection, query = {}) {
      const index = await getIndex();
      const results = [...index.rows.values()]
        .map(rowToRecord)
        .filter((entry) => entry && !entry.deleted && entry.record.collection === collection)
        .map((entry) => entry.record)
        .filter((record) => matchesQuery(record, query));
      return query.limit ? results.slice(0, query.limit) : results;
    },
    async list(collection, options = {}) {
      const index = await getIndex();
      const all = [...index.rows.values()]
        .map(rowToRecord)
        .filter((entry) => entry && !entry.deleted && entry.record.collection === collection)
        .map((entry) => entry.record);
      const offset = options.offset || 0;
      const end = options.limit ? offset + options.limit : undefined;
      return all.slice(offset, end);
    },
  });
}
