import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilityRequest, createSession } from '@wcf/core';
import {
  CacheEngine,
  createInMemoryCacheStore,
  rankProviders,
  tierRank,
  withExponentialBackoff,
  executeWithFailover,
  ProviderRouter,
  McpManager,
  ConfigManager,
  redact,
  encryptSecret,
  decryptSecret,
  signSessionToken,
  verifySessionToken,
  timingSafeEqualStrings,
  ObservabilityLog,
  OmniRoute,
} from '../src/index.js';

test('CacheEngine hits on identical capability + input, misses on different input', () => {
  const cache = new CacheEngine(createInMemoryCacheStore());
  const req1 = createCapabilityRequest({ capability: 'generate_text', input: { prompt: 'hello' } });
  const req2 = createCapabilityRequest({ capability: 'generate_text', input: { prompt: 'hello' } });
  const req3 = createCapabilityRequest({ capability: 'generate_text', input: { prompt: 'goodbye' } });
  assert.equal(cache.get(req1), undefined);
  cache.set(req1, { output: 'Hi there' });
  assert.deepEqual(cache.get(req2), { output: 'Hi there' });
  assert.equal(cache.get(req3), undefined);
  assert.equal(cache.stats().hits, 1);
  assert.equal(cache.stats().misses, 2);
});

test('createInMemoryCacheStore evicts the oldest entry once maxEntries is exceeded, so a long-running process cannot grow it without bound', () => {
  const store = createInMemoryCacheStore({ maxEntries: 3 });
  store.set('a', 1, 60_000);
  store.set('b', 2, 60_000);
  store.set('c', 3, 60_000);
  assert.equal(store.size(), 3);
  store.set('d', 4, 60_000);
  assert.equal(store.size(), 3, 'size should stay capped at maxEntries');
  assert.equal(store.get('a'), undefined, 'oldest entry should have been evicted');
  assert.equal(store.get('d'), 4, 'newest entry should still be present');
});

test('tierRank orders local-first waterfall correctly', () => {
  assert.ok(tierRank('local') < tierRank('free'));
  assert.ok(tierRank('free') < tierRank('low_cost'));
  assert.ok(tierRank('low_cost') < tierRank('premium'));
});

test('rankProviders prefers cheaper tier even if raw cost is higher on the expensive tier', () => {
  const ranked = rankProviders([
    { id: 'premium-a', tier: 'premium', estimateUsd: 0.001 },
    { id: 'free-a', tier: 'free', estimateUsd: 0.01 },
  ]);
  assert.equal(ranked[0].id, 'free-a');
});

test('withExponentialBackoff retries then succeeds', async () => {
  let attempts = 0;
  const result = await withExponentialBackoff(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('flaky');
    return 'ok';
  }, { retries: 3, baseDelayMs: 1 });
  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
});

test('executeWithFailover moves to next provider when the first fails entirely', async () => {
  const events = [];
  const { result, providerId } = await executeWithFailover(
    [
      { id: 'a', execute: async () => { throw new Error('a is down'); } },
      { id: 'b', execute: async () => 'success-from-b' },
    ],
    { retriesPerProvider: 0, onProviderFailover: (from, to) => events.push([from, to]) }
  );
  assert.equal(result, 'success-from-b');
  assert.equal(providerId, 'b');
  assert.deepEqual(events, [['a', 'b']]);
});

test('executeWithFailover throws a graceful error, never an unhandled crash, when everyone fails', async () => {
  await assert.rejects(
    executeWithFailover([{ id: 'a', execute: async () => { throw new Error('down'); } }], { retriesPerProvider: 0 }),
    /All 1 provider\(s\) failed/
  );
});

test('ProviderRouter filters by capability, health, budget, and preferred provider', () => {
  const router = new ProviderRouter();
  router.registerProvider({
    id: 'mock-free', capabilities: ['generate_text'], tier: 'free',
    estimateCostUsd: () => 0, estimateDurationMs: () => 10, execute: async () => ({ output: 'free' }),
  });
  router.registerProvider({
    id: 'mock-premium', capabilities: ['generate_text'], tier: 'premium',
    estimateCostUsd: () => 0.5, estimateDurationMs: () => 100, execute: async () => ({ output: 'premium' }),
  });
  router.registerProvider({
    id: 'mock-unavailable', capabilities: ['generate_text'], tier: 'free', healthStatus: 'unavailable',
    estimateCostUsd: () => 0, estimateDurationMs: () => 5, execute: async () => ({ output: 'nope' }),
  });
  const request = createCapabilityRequest({ capability: 'generate_text', input: {} });
  const ranked = router.rankCandidates(request);
  assert.deepEqual(ranked.map((r) => r.id), ['mock-free', 'mock-premium']);

  const budgeted = createCapabilityRequest({ capability: 'generate_text', input: {}, maxCostUsd: 0.01 });
  assert.deepEqual(router.rankCandidates(budgeted).map((r) => r.id), ['mock-free']);

  const preferred = createCapabilityRequest({ capability: 'generate_text', input: {}, preferredProvider: 'mock-premium' });
  assert.deepEqual(router.rankCandidates(preferred).map((r) => r.id), ['mock-premium']);
});

test('McpManager never hard-codes servers: register/callTool/unregister all work generically', async () => {
  const mcp = new McpManager();
  mcp.registerServer({
    name: 'notebooklm',
    capabilities: ['knowledge_retrieval'],
    tools: ['search'],
    callTool: async (tool, args) => `result for ${args.query}`,
  });
  const result = await mcp.callTool('knowledge_retrieval', 'search', { query: 'migraine' });
  assert.equal(result, 'result for migraine');
  assert.equal(mcp.getServersForCapability('knowledge_retrieval').length, 1);
  mcp.unregisterServer('notebooklm');
  await assert.rejects(mcp.callTool('knowledge_retrieval', 'search', {}), /No healthy MCP server/);
});

test('McpManager fails over to a second server for the same capability', async () => {
  const mcp = new McpManager();
  mcp.registerServer({
    name: 'server-a', capabilities: ['knowledge_retrieval'], tools: ['search'],
    callTool: async () => { throw new Error('a down'); },
  });
  mcp.registerServer({
    name: 'server-b', capabilities: ['knowledge_retrieval'], tools: ['search'],
    callTool: async () => 'from b',
  });
  const result = await mcp.callTool('knowledge_retrieval', 'search', {});
  assert.equal(result, 'from b');
});

test('ConfigManager resolves higher layers over lower layers, only when defined', () => {
  const config = new ConfigManager();
  config.set('global', { qualityLevel: 'balanced', theme: 'dark' });
  config.set('brand', { qualityLevel: 'professional' });
  config.set('project', {});
  assert.equal(config.get('qualityLevel'), 'professional');
  assert.equal(config.get('theme'), 'dark');
  assert.equal(config.get('missing', 'fallback'), 'fallback');
});

test('redact strips secret-like keys recursively but preserves everything else', () => {
  const redacted = redact({ apiKey: 'sk-123', nested: { authToken: 'abc', ok: 'fine' }, list: [{ password: 'x', name: 'y' }] });
  assert.equal(redacted.apiKey, '[REDACTED]');
  assert.equal(redacted.nested.authToken, '[REDACTED]');
  assert.equal(redacted.nested.ok, 'fine');
  assert.equal(redacted.list[0].password, '[REDACTED]');
  assert.equal(redacted.list[0].name, 'y');
});

test('encryptSecret/decryptSecret round-trip and reject the wrong passphrase', () => {
  const encrypted = encryptSecret('super-secret-api-key', 'passphrase-1');
  assert.equal(decryptSecret(encrypted, 'passphrase-1'), 'super-secret-api-key');
  assert.throws(() => decryptSecret(encrypted, 'wrong-passphrase'));
});

test('session token round-trips and rejects tampering', () => {
  const session = createSession({ sessionId: 's1', userId: 'u1', role: 'owner' });
  const token = signSessionToken(session, 'signing-secret');
  const verified = verifySessionToken(token, 'signing-secret');
  assert.equal(verified.userId, 'u1');
  const tampered = token.slice(0, -1) + (token.at(-1) === 'A' ? 'B' : 'A');
  assert.throws(() => verifySessionToken(tampered, 'signing-secret'), /Invalid session token/);
});

test('OmniRoute end-to-end: cache miss -> provider execution -> cache hit on repeat', async () => {
  const omniroute = new OmniRoute();
  let executions = 0;
  omniroute.registerProvider({
    id: 'mock-text', capabilities: ['generate_text'], tier: 'free',
    estimateCostUsd: () => 0, estimateDurationMs: () => 1,
    execute: async (req) => { executions += 1; return { output: `Echo: ${req.input.prompt}`, costUsd: 0 }; },
  });
  const request = createCapabilityRequest({ capability: 'generate_text', input: { prompt: 'hi' } });
  const first = await omniroute.request(request);
  assert.equal(first.fromCache, false);
  assert.equal(first.output, 'Echo: hi');
  assert.equal(executions, 1);

  const second = await omniroute.request(createCapabilityRequest({ capability: 'generate_text', input: { prompt: 'hi' } }));
  assert.equal(second.fromCache, true);
  assert.equal(executions, 1, 'provider should not execute again on a cache hit');

  const events = omniroute.observability.getEvents();
  assert.equal(events.length, 2);
  assert.equal(events[1].fromCache, true);
});

test('OmniRoute throws a clear error when no provider supports the capability', async () => {
  const omniroute = new OmniRoute();
  const request = createCapabilityRequest({ capability: 'generate_video', input: {} });
  await assert.rejects(omniroute.request(request), /No provider registered/);
});

test('ObservabilityLog bounds its event buffer so a long-running process cannot grow it without limit', () => {
  const log = new ObservabilityLog({ maxEvents: 5 });
  for (let i = 0; i < 12; i += 1) log.record({ i });
  const events = log.getEvents();
  assert.equal(events.length, 5, 'buffer should stay capped at maxEvents');
  assert.equal(events[0].i, 7, 'oldest events should have been dropped, newest 5 retained');
  assert.equal(events[4].i, 11);
});

test('timingSafeEqualStrings correctly compares equal/unequal/different-length strings', () => {
  assert.equal(timingSafeEqualStrings('secret-value', 'secret-value'), true);
  assert.equal(timingSafeEqualStrings('secret-value', 'wrong-value!'), false);
  assert.equal(timingSafeEqualStrings('short', 'a-much-longer-string'), false);
});
