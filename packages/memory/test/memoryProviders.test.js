import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPropertiesServiceMemoryProvider,
  createGoogleDriveMemoryProvider,
  createGoogleSheetsMemoryProvider,
} from '../src/index.js';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function parseUrl(url) {
  const u = new URL(url);
  return { pathname: u.pathname, params: Object.fromEntries(u.searchParams.entries()) };
}

// --- PropertiesService provider -------------------------------------

function fakePropertiesService() {
  const store = new Map();
  const api = {
    getProperty: (key) => (store.has(key) ? store.get(key) : null),
    setProperty: (key, value) => store.set(key, value),
    deleteProperty: (key) => store.delete(key),
    getProperties: () => Object.fromEntries(store.entries()),
  };
  return { getScriptProperties: () => api, getUserProperties: () => api, getDocumentProperties: () => api };
}

test('propertiesService provider is unavailable outside a GAS runtime (no global, none injected)', () => {
  const provider = createPropertiesServiceMemoryProvider({});
  assert.equal(provider.healthStatus, 'unavailable');
});

test('propertiesService provider: full CRUD + search + list against an injected fake service', async () => {
  const propertiesService = fakePropertiesService();
  const provider = createPropertiesServiceMemoryProvider({ propertiesService });
  assert.equal(provider.healthStatus, 'healthy');

  const written = await provider.write('global', 'featureFlags', { betaEnabled: true }, { tags: ['config'] });
  assert.equal(written.version, 1);

  const read = await provider.read('global', 'featureFlags');
  assert.deepEqual(read.data, { betaEnabled: true });

  const updated = await provider.update('global', 'featureFlags', { betaEnabled: false });
  assert.equal(updated.version, 2);
  assert.equal(updated.data.betaEnabled, false);

  const found = await provider.search('global', { tags: ['config'] });
  assert.equal(found.length, 1);

  const listed = await provider.list('global');
  assert.equal(listed.length, 1);

  assert.equal(await provider.delete('global', 'featureFlags'), true);
  assert.equal(await provider.read('global', 'featureFlags'), null);
});

// --- Google Drive provider -----------------------------------------------

test('google drive provider is unavailable without accessToken/folderId', () => {
  const provider = createGoogleDriveMemoryProvider({});
  assert.equal(provider.healthStatus, 'unavailable');
});

test('google drive provider: create (multipart), read, update, and delete a record file', async () => {
  const files = new Map(); // fileId -> { properties, content }
  let nextId = 1;
  const fakeFetch = async (url, init) => {
    const { pathname } = parseUrl(url);
    if (pathname === '/drive/v3/files' && (!init || init.method === undefined)) {
      // list/search query
      const collectionMatch = decodeURIComponent(url).match(/properties has \{ key='collection' and value='([^']+)' \}/);
      const nameMatch = decodeURIComponent(url).match(/name = '([^']+)'/);
      const matches = [...files.entries()].filter(([, f]) => {
        if (nameMatch) return f.name === nameMatch[1];
        if (collectionMatch) return f.properties.collection === collectionMatch[1];
        return true;
      });
      return jsonResponse({ files: matches.map(([id, f]) => ({ id, name: f.name, properties: f.properties })) });
    }
    if (pathname.startsWith('/upload/drive/v3/files') && init.method === 'POST') {
      const id = String(nextId++);
      const { metadata, content } = parseMultipart(init.body);
      files.set(id, { name: metadata.name, properties: metadata.properties, content });
      return jsonResponse({ id });
    }
    if (pathname.match(/^\/upload\/drive\/v3\/files\/(.+)$/) && init.method === 'PATCH') {
      const id = pathname.match(/^\/upload\/drive\/v3\/files\/(.+)$/)[1];
      const { metadata, content } = parseMultipart(init.body);
      const existing = files.get(id);
      files.set(id, { ...existing, properties: { ...existing.properties, ...metadata.properties }, content });
      return jsonResponse({ id });
    }
    if (pathname.match(/^\/drive\/v3\/files\/(.+)$/) && (!init || init.method === undefined)) {
      const id = pathname.match(/^\/drive\/v3\/files\/(.+)$/)[1];
      return jsonResponse(JSON.parse(files.get(id).content));
    }
    if (pathname.match(/^\/drive\/v3\/files\/(.+)$/) && init.method === 'DELETE') {
      const id = pathname.match(/^\/drive\/v3\/files\/(.+)$/)[1];
      files.delete(id);
      return { ok: true, status: 204 };
    }
    throw new Error(`unexpected ${init?.method || 'GET'} ${url}`);
  };

  const provider = createGoogleDriveMemoryProvider({ accessToken: 'gd-token', folderId: 'folder-1', fetchImpl: fakeFetch });

  const written = await provider.write('asset', 'logo-1', { url: 'https://cdn/logo.png' });
  assert.equal(written.version, 1);
  assert.equal(files.size, 1);

  const read = await provider.read('asset', 'logo-1');
  assert.deepEqual(read.data, { url: 'https://cdn/logo.png' });

  const updated = await provider.write('asset', 'logo-1', { url: 'https://cdn/logo-v2.png' });
  assert.equal(updated.version, 2);
  assert.equal(files.size, 1, 'writing an existing key should update, not create a second file');

  const foundBySearch = await provider.search('asset');
  assert.equal(foundBySearch.length, 1);
  assert.equal(foundBySearch[0].data.url, 'https://cdn/logo-v2.png');

  assert.equal(await provider.delete('asset', 'logo-1'), true);
  assert.equal(files.size, 0);
});

function parseMultipart(body) {
  const boundary = body.match(/^--(\S+)/)[1];
  const parts = body.split(`--${boundary}`).filter((p) => p.trim() && p.trim() !== '--');
  const [metadataPart, contentPart] = parts.map((p) => p.replace(/^\r\n|\r\n$/g, '').split('\r\n\r\n')[1]);
  return { metadata: JSON.parse(metadataPart), content: contentPart };
}

// --- Google Sheets provider -----------------------------------------

test('google sheets provider is unavailable without spreadsheetId/accessToken', () => {
  const provider = createGoogleSheetsMemoryProvider({});
  assert.equal(provider.healthStatus, 'unavailable');
});

test('google sheets provider: ensures header, appends, reads, updates, and soft-deletes rows', async () => {
  const sheetRows = new Map(); // rowNumber -> row array
  let headerWritten = false;
  const fakeFetch = async (url, init) => {
    const { pathname } = parseUrl(url);
    const decodedUrl = decodeURIComponent(url);
    if (pathname.includes('/values/') && (!init || init.method === undefined)) {
      if (decodedUrl.includes('Memory!A1:M1')) {
        return jsonResponse(headerWritten ? { values: [['collection']] } : {});
      }
      // A2:M range read -> return rows in order
      const maxRow = Math.max(1, ...sheetRows.keys());
      const values = [];
      for (let r = 2; r <= maxRow; r += 1) values.push(sheetRows.get(r) || []);
      return jsonResponse({ values });
    }
    if (pathname.includes('/values/') && init.method === 'PUT') {
      const body = JSON.parse(init.body);
      if (decodedUrl.includes('Memory!A1:M1')) {
        headerWritten = true;
        return jsonResponse({});
      }
      const rowMatch = decodedUrl.match(/!A(\d+):M(\d+)/);
      const rowNumber = Number(rowMatch[1]);
      sheetRows.set(rowNumber, body.values[0]);
      return jsonResponse({});
    }
    throw new Error(`unexpected ${init?.method || 'GET'} ${url}`);
  };

  const provider = createGoogleSheetsMemoryProvider({ spreadsheetId: 'sheet-1', accessToken: 'gs-token', fetchImpl: fakeFetch });

  const written = await provider.write('brand', 'pillfill', { voice: 'friendly' }, { tags: ['brand'] });
  assert.equal(written.version, 1);
  assert.equal(headerWritten, true);
  assert.equal(sheetRows.size, 1);

  const read = await provider.read('brand', 'pillfill');
  assert.deepEqual(read.data, { voice: 'friendly' });

  const updated = await provider.update('brand', 'pillfill', { voice: 'warm' });
  assert.equal(updated.version, 2);
  assert.equal(sheetRows.size, 1, 'update should reuse the same row, not add a new one');

  const found = await provider.search('brand', { tags: ['brand'] });
  assert.equal(found.length, 1);
  assert.equal(found[0].data.voice, 'warm');

  assert.equal(await provider.delete('brand', 'pillfill'), true);
  assert.equal(await provider.read('brand', 'pillfill'), null);
  assert.equal(sheetRows.size, 1, 'delete is a soft delete — the row still exists, just flagged');

  const resurrected = await provider.write('brand', 'pillfill', { voice: 'back again' });
  assert.equal(sheetRows.size, 1, 'writing a soft-deleted key should reuse its row, not append a new one');
  assert.equal(resurrected.data.voice, 'back again');
});
