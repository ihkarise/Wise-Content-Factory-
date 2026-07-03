/**
 * Google Drive Memory Provider — documents/assets. Each record is stored as one JSON file in a
 * configured Drive folder, named `wcf-memory__{collection}__{key}.json`, with `collection`/`key`/
 * `version` mirrored into Drive's per-file custom `properties` (small key/value metadata Drive
 * indexes and lets you query with `properties has {...}`) so `search`/`list` don't need to
 * download every file's content just to filter by collection.
 *
 * Uses the Drive REST API v3 directly over `fetch` (not the GAS-only `DriveApp` global), so this
 * runs anywhere Node runs — a future worker, `apps/omniroute-server`, or a test — the same
 * portability tradeoff `packages/publishing`'s adapters make. `accessToken` is injected by the
 * caller (a real OAuth flow lives elsewhere), never acquired by this file.
 */
import { defineMemoryProvider, matchesQuery } from '../memoryProviderInterface.js';
import { applyMemoryUpdate, nextMemoryRecordVersion } from '../memoryRecord.js';

const API_BASE_URL = 'https://www.googleapis.com/drive/v3';
const UPLOAD_BASE_URL = 'https://www.googleapis.com/upload/drive/v3';

/** @param {{accessToken?: string, folderId?: string, id?: string, fetchImpl?: typeof fetch}} [options] */
export function createGoogleDriveMemoryProvider({ accessToken, folderId, id = 'google-drive', fetchImpl = globalThis.fetch } = {}) {
  const configured = Boolean(accessToken && folderId);
  if (!configured) {
    return defineMemoryProvider({
      id,
      healthStatus: 'unavailable',
      async read() { throw new Error(`Memory provider "${id}" has no accessToken/folderId configured.`); },
      async write() { throw new Error(`Memory provider "${id}" has no accessToken/folderId configured.`); },
      async update() { throw new Error(`Memory provider "${id}" has no accessToken/folderId configured.`); },
      async delete() { throw new Error(`Memory provider "${id}" has no accessToken/folderId configured.`); },
      async search() { throw new Error(`Memory provider "${id}" has no accessToken/folderId configured.`); },
      async list() { throw new Error(`Memory provider "${id}" has no accessToken/folderId configured.`); },
    });
  }

  const authHeader = { authorization: `Bearer ${accessToken}` };

  function fileName(collection, key) {
    return `wcf-memory__${collection}__${key}.json`;
  }

  async function driveRequest(url, init) {
    // A hung upstream connection would otherwise tie up the request indefinitely — Node's fetch
    // has no default timeout of its own. Generous since this covers both small metadata calls and
    // full file uploads/downloads.
    const response = await fetchImpl(url, {
      ...init,
      headers: { ...authHeader, ...(init?.headers || {}) },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Google Drive API error ${response.status}: ${body}`);
    }
    return response.status === 204 ? null : response.json();
  }

  async function findFile(collection, key) {
    const q = `name = '${fileName(collection, key)}' and '${folderId}' in parents and trashed = false`;
    const data = await driveRequest(`${API_BASE_URL}/files?q=${encodeURIComponent(q)}&fields=files(id,name,properties)`);
    return data.files?.[0] ?? null;
  }

  async function readFileContent(fileId) {
    return driveRequest(`${API_BASE_URL}/files/${fileId}?alt=media`);
  }

  async function upsertFile(existingFileId, record) {
    const boundary = `wcf_memory_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const metadata = {
      name: fileName(record.collection, record.key),
      ...(existingFileId ? {} : { parents: [folderId] }),
      properties: { collection: record.collection, key: record.key, version: String(record.version) },
    };
    const body = buildMultipartRelatedBody(boundary, metadata, JSON.stringify(record));
    const url = existingFileId
      ? `${UPLOAD_BASE_URL}/files/${existingFileId}?uploadType=multipart`
      : `${UPLOAD_BASE_URL}/files?uploadType=multipart`;
    return driveRequest(url, {
      method: existingFileId ? 'PATCH' : 'POST',
      headers: { 'content-type': `multipart/related; boundary=${boundary}` },
      body,
    });
  }

  async function listFilesForCollection(collection) {
    const q = `'${folderId}' in parents and trashed = false and properties has { key='collection' and value='${collection}' }`;
    const data = await driveRequest(`${API_BASE_URL}/files?q=${encodeURIComponent(q)}&fields=files(id,name,properties)&pageSize=1000`);
    return data.files || [];
  }

  return defineMemoryProvider({
    id,
    healthStatus: 'healthy',
    async read(collection, key) {
      const file = await findFile(collection, key);
      return file ? readFileContent(file.id) : null;
    },
    async write(collection, key, data, options = {}) {
      const existingFile = await findFile(collection, key);
      const existingRecord = existingFile ? await readFileContent(existingFile.id) : null;
      const record = nextMemoryRecordVersion(existingRecord, { collection, key, data, options });
      await upsertFile(existingFile?.id, record);
      return record;
    },
    async update(collection, key, patch, options = {}) {
      const existingFile = await findFile(collection, key);
      if (!existingFile) throw new Error(`Cannot update: no record at collection "${collection}", key "${key}".`);
      const existing = await readFileContent(existingFile.id);
      const updated = applyMemoryUpdate(existing, patch, options);
      await upsertFile(existingFile.id, updated);
      return updated;
    },
    async delete(collection, key) {
      const file = await findFile(collection, key);
      if (!file) return false;
      await driveRequest(`${API_BASE_URL}/files/${file.id}`, { method: 'DELETE' });
      return true;
    },
    async search(collection, query = {}) {
      const files = await listFilesForCollection(collection);
      const records = await Promise.all(files.map((f) => readFileContent(f.id)));
      const results = records.filter((r) => matchesQuery(r, query));
      return query.limit ? results.slice(0, query.limit) : results;
    },
    async list(collection, options = {}) {
      const files = await listFilesForCollection(collection);
      const offset = options.offset || 0;
      const end = options.limit ? offset + options.limit : undefined;
      const page = files.slice(offset, end);
      return Promise.all(page.map((f) => readFileContent(f.id)));
    },
  });
}

/** Drive's multipart/related upload format: a JSON metadata part, then a JSON content part. */
function buildMultipartRelatedBody(boundary, metadata, contentJson) {
  return (
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${contentJson}\r\n` +
    `--${boundary}--`
  );
}
