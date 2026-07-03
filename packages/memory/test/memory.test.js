import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInMemoryCacheStore } from '@wcf/infrastructure';
import {
  createMemoryRecord,
  applyMemoryUpdate,
  MAX_HISTORY_ENTRIES,
  defineMemoryProvider,
  matchesQuery,
  MemoryManager,
  MEMORY_COLLECTIONS,
  createBrandMemoryData,
  createProjectMemoryData,
  createCampaignMemoryData,
  createConversationMemoryData,
  createInMemoryMemoryProvider,
  createLocalJsonMemoryProvider,
} from '../src/index.js';

// --- memoryRecord ---------------------------------------------------------

test('createMemoryRecord fills defaults and stamps audit timestamps', () => {
  const record = createMemoryRecord({ collection: 'brand', key: 'pillfill', data: { voice: 'friendly' } });
  assert.equal(record.version, 1);
  assert.deepEqual(record.tags, []);
  assert.deepEqual(record.previousVersions, []);
  assert.ok(record.audit.createdAt);
  assert.equal(record.audit.createdAt, record.audit.updatedAt);
});

test('applyMemoryUpdate shallow-merges patch into data, bumps version, snapshots history', () => {
  const record = createMemoryRecord({ collection: 'brand', key: 'pillfill', data: { voice: 'friendly', style: 'bold' } });
  const updated = applyMemoryUpdate(record, { voice: 'warm' }, { actor: 'user-1' });
  assert.equal(updated.version, 2);
  assert.deepEqual(updated.data, { voice: 'warm', style: 'bold' });
  assert.equal(updated.previousVersions.length, 1);
  assert.deepEqual(updated.previousVersions[0].data, { voice: 'friendly', style: 'bold' });
  assert.equal(updated.audit.updatedBy, 'user-1');
  assert.equal(updated.audit.createdAt, record.audit.createdAt);
});

test('applyMemoryUpdate bounds history to MAX_HISTORY_ENTRIES', () => {
  let record = createMemoryRecord({ collection: 'brand', key: 'x', data: { n: 0 } });
  for (let i = 1; i <= MAX_HISTORY_ENTRIES + 5; i += 1) {
    record = applyMemoryUpdate(record, { n: i });
  }
  assert.equal(record.previousVersions.length, MAX_HISTORY_ENTRIES);
  assert.equal(record.version, MAX_HISTORY_ENTRIES + 6);
});

// --- memoryProviderInterface -----------------------------------------

test('defineMemoryProvider throws when a required function is missing', () => {
  assert.throws(() => defineMemoryProvider({ id: 'broken' }), /missing required function/);
});

test('defineMemoryProvider defaults semanticSearch to a not-implemented stub', async () => {
  const provider = defineMemoryProvider({
    id: 'x', read: async () => null, write: async () => ({}), update: async () => ({}),
    delete: async () => true, search: async () => [], list: async () => [],
  });
  await assert.rejects(provider.semanticSearch('brand', 'query'), /not implemented/);
});

test('matchesQuery checks tags (AND), keyPrefix, and textContains', () => {
  const record = { key: 'pillfill-launch', tags: ['launch', 'pharmacy'], data: { headline: 'PillFill goes live' } };
  assert.equal(matchesQuery(record, {}), true);
  assert.equal(matchesQuery(record, { tags: ['launch'] }), true);
  assert.equal(matchesQuery(record, { tags: ['launch', 'missing'] }), false);
  assert.equal(matchesQuery(record, { keyPrefix: 'pillfill' }), true);
  assert.equal(matchesQuery(record, { keyPrefix: 'other' }), false);
  assert.equal(matchesQuery(record, { textContains: 'goes live' }), true);
  assert.equal(matchesQuery(record, { textContains: 'nope' }), false);
});

// --- MemoryManager -----------------------------------------------------

test('MemoryManager routes by collection to a specific provider, falling back to the default', async () => {
  const manager = new MemoryManager();
  const brandProvider = createInMemoryMemoryProvider({ id: 'brand-store' });
  const defaultProvider = createInMemoryMemoryProvider({ id: 'default-store' });
  manager.registerProvider(brandProvider, { collections: ['brand'] });
  manager.registerProvider(defaultProvider);

  await manager.write('brand', 'pillfill', { voice: 'friendly' });
  await manager.write('conversation', 'session-1', { context: {} });

  assert.deepEqual((await brandProvider.read('brand', 'pillfill')).data, { voice: 'friendly' });
  assert.equal(await defaultProvider.read('brand', 'pillfill'), null);
  assert.deepEqual((await defaultProvider.read('conversation', 'session-1')).data, { context: {} });
});

test('MemoryManager.getProvider throws a clear error with no provider registered at all', () => {
  const manager = new MemoryManager();
  assert.throws(() => manager.getProvider('brand'), /No memory provider registered/);
});

test('MemoryManager throws when the resolved provider is unavailable', async () => {
  const manager = new MemoryManager();
  manager.registerProvider(createLocalJsonMemoryProvider({})); // no filePath -> unavailable
  await assert.rejects(manager.read('global', 'x'), /unavailable/);
});

test('MemoryManager full CRUD + search + list round-trip', async () => {
  const manager = new MemoryManager();
  manager.registerProvider(createInMemoryMemoryProvider());

  const written = await manager.write('project', 'launch-2026', createProjectMemoryData({ scripts: ['s1'] }), { tags: ['active'] });
  assert.equal(written.version, 1);

  const updated = await manager.update('project', 'launch-2026', { scripts: ['s1', 's2'] });
  assert.equal(updated.version, 2);
  assert.deepEqual(updated.data.scripts, ['s1', 's2']);

  const found = await manager.search('project', { tags: ['active'] });
  assert.equal(found.length, 1);
  assert.equal(found[0].key, 'launch-2026');

  const listed = await manager.list('project');
  assert.equal(listed.length, 1);

  const deleted = await manager.delete('project', 'launch-2026');
  assert.equal(deleted, true);
  assert.equal(await manager.read('project', 'launch-2026'), null);
});

test('MemoryManager caches reads and invalidates on write/update/delete', async () => {
  const manager = new MemoryManager({ cacheStore: createInMemoryCacheStore() });
  const provider = createInMemoryMemoryProvider();
  manager.registerProvider(provider);
  await manager.write('global', 'flags', { betaEnabled: true });

  let readCount = 0;
  const originalRead = provider.read;
  provider.read = async (...args) => { readCount += 1; return originalRead(...args); };

  await manager.read('global', 'flags');
  await manager.read('global', 'flags');
  assert.equal(readCount, 1, 'second read should be served from cache');

  await manager.update('global', 'flags', { betaEnabled: false });
  await manager.read('global', 'flags');
  assert.equal(readCount, 2, 'cache should be invalidated after update');
});

// --- collections.js ------------------------------------------------------

test('MEMORY_COLLECTIONS lists every collection named in the brief', () => {
  assert.deepEqual(MEMORY_COLLECTIONS, [
    'global', 'brand', 'project', 'campaign', 'conversation', 'asset', 'promptLibrary', 'templateLibrary', 'knowledgeCache',
  ]);
});

test('create*MemoryData factories fill the documented fields with sane defaults', () => {
  const brand = createBrandMemoryData({ identity: 'PillFill', preferredCtas: ['Shop now'] });
  assert.equal(brand.identity, 'PillFill');
  assert.deepEqual(brand.preferredCtas, ['Shop now']);
  assert.deepEqual(brand.colorPalette, []);

  const project = createProjectMemoryData({ scripts: ['s1'] });
  assert.deepEqual(project.scripts, ['s1']);
  assert.deepEqual(project.performanceMetadata, {});

  const campaign = createCampaignMemoryData({ prompt: 'Launch PillFill' });
  assert.equal(campaign.prompt, 'Launch PillFill');
  assert.equal(campaign.costEstimateUsd, 0);

  const conversation = createConversationMemoryData({ workflowState: { step: 2 } });
  assert.deepEqual(conversation.workflowState, { step: 2 });
});

// --- In-memory provider --------------------------------------------------

test('in-memory provider: full CRUD, versioning, and error on updating a missing record', async () => {
  const provider = createInMemoryMemoryProvider();
  assert.equal(provider.healthStatus, 'healthy');
  await provider.write('asset', 'logo-1', { url: 'https://cdn/logo.png' });
  const read = await provider.read('asset', 'logo-1');
  assert.equal(read.data.url, 'https://cdn/logo.png');
  await assert.rejects(provider.update('asset', 'missing', {}), /no record/);
});

// --- Local JSON provider --------------------------------------------------

test('local JSON provider is unavailable with no filePath', () => {
  const provider = createLocalJsonMemoryProvider({});
  assert.equal(provider.healthStatus, 'unavailable');
});

test('local JSON provider persists real records to disk and reloads them in a fresh provider instance', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wcf-memory-'));
  const filePath = path.join(dir, 'memory.json');
  try {
    const providerA = createLocalJsonMemoryProvider({ filePath });
    await providerA.write('promptLibrary', 'hook-1', { text: 'Stop scrolling.' }, { tags: ['hook'] });
    await providerA.write('promptLibrary', 'hook-2', { text: 'Wait, what?' });
    await providerA.update('promptLibrary', 'hook-1', { text: 'Stop scrolling — seriously.' });

    const onDisk = JSON.parse(await readFile(filePath, 'utf8'));
    assert.equal(onDisk.length, 2);

    const providerB = createLocalJsonMemoryProvider({ filePath });
    const reloaded = await providerB.read('promptLibrary', 'hook-1');
    assert.equal(reloaded.data.text, 'Stop scrolling — seriously.');
    assert.equal(reloaded.version, 2);

    const list = await providerB.list('promptLibrary');
    assert.equal(list.length, 2);

    await providerB.delete('promptLibrary', 'hook-2');
    const providerC = createLocalJsonMemoryProvider({ filePath });
    assert.equal(await providerC.read('promptLibrary', 'hook-2'), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
