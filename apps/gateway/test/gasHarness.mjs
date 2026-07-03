/**
 * Loads the real .gs files into a Node `vm` context with mocked Google Apps Script globals, so
 * the actual shipped gateway code is unit tested (not a re-implementation of it). GAS concatenates
 * every file in a project into one shared global scope — this harness does the same by running all
 * files as one script against one context.
 */
import vm from 'node:vm';
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GATEWAY_DIR = path.resolve(__dirname, '..');

function toSignedBytes(buffer) {
  return Array.from(buffer, (b) => (b << 24) >> 24);
}

function toUnsignedBuffer(byteArray) {
  return Buffer.from(byteArray.map((b) => b & 0xff));
}

function base64UrlAlphabet(base64) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64UrlAlphabet(base64url) {
  return base64url.replace(/-/g, '+').replace(/_/g, '/');
}

function makeUtilities() {
  return {
    getUuid: () => `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`,
    computeHmacSha256Signature: (value, key) => {
      const data = typeof value === 'string' ? Buffer.from(value, 'utf8') : toUnsignedBuffer(value);
      const digest = createHmac('sha256', key).update(data).digest();
      return toSignedBytes(digest);
    },
    base64EncodeWebSafe: (data) => {
      const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : toUnsignedBuffer(data);
      return base64UrlAlphabet(buf.toString('base64'));
    },
    base64DecodeWebSafe: (str) => {
      const buf = Buffer.from(fromBase64UrlAlphabet(str), 'base64');
      return toSignedBytes(buf);
    },
    base64Encode: (data) => {
      const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : toUnsignedBuffer(data);
      return buf.toString('base64');
    },
    newBlob: (data) => {
      const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : toUnsignedBuffer(data);
      return {
        getDataAsString: () => buf.toString('utf8'),
        getBytes: () => toSignedBytes(buf),
      };
    },
  };
}

function makePropertiesService(initial = {}) {
  const store = { ...initial };
  const api = {
    getProperty: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setProperty: (key, value) => { store[key] = value; },
    setProperties: (obj) => Object.assign(store, obj),
    deleteProperty: (key) => { delete store[key]; },
    getProperties: () => ({ ...store }),
  };
  return { getScriptProperties: () => api, _store: store };
}

function makeCacheService() {
  const store = new Map();
  const api = {
    get: (key) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
      return entry.value;
    },
    put: (key, value, ttlSeconds) => store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 }),
  };
  return { getScriptCache: () => api };
}

function makeContentService() {
  return {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (text) => ({
      _text: text,
      setMimeType() { return this; },
      getContent() { return this._text; },
    }),
  };
}

/**
 * @param {{scriptProperties?: Record<string,string>, fetchImpl?: (url: string, options: any) => any}} options
 */
export function loadGateway(options = {}) {
  const files = readdirSync(GATEWAY_DIR).filter((f) => f.endsWith('.gs'));
  const source = files.map((f) => readFileSync(path.join(GATEWAY_DIR, f), 'utf8')).join('\n;\n');

  const logs = [];
  const propertiesService = makePropertiesService(options.scriptProperties);
  const sandbox = {
    Utilities: makeUtilities(),
    PropertiesService: propertiesService,
    CacheService: makeCacheService(),
    ContentService: makeContentService(),
    UrlFetchApp: { fetch: options.fetchImpl || (() => { throw new Error('UrlFetchApp.fetch not mocked for this test'); }) },
    Logger: { log: (msg) => logs.push(msg) },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'gateway-bundle.gs' });
  sandbox.__logs = logs;
  sandbox.__properties = propertiesService._store;
  return sandbox;
}
