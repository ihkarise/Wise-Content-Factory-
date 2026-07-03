import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OmniRoute } from '../../../packages/infrastructure/src/index.js';
import { createCapabilityRequest } from '../../../packages/core/src/index.js';
import { createOmniRouteServer, registerProvidersFromEnv } from '../server.js';

async function withServer(env, run) {
  const omniroute = new OmniRoute();
  const server = createOmniRouteServer({ env, omniroute });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`, omniroute);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('registerProvidersFromEnv always registers the local mock providers', () => {
  const omniroute = new OmniRoute();
  const ids = registerProvidersFromEnv(omniroute, {});
  assert.deepEqual(ids, ['mock-local-text', 'mock-local-media']);
});

test('registerProvidersFromEnv registers real providers only when credentials are present', () => {
  const omniroute = new OmniRoute();
  const ids = registerProvidersFromEnv(omniroute, {
    ANTHROPIC_API_KEY: 'sk-ant-test',
    GEMINI_API_KEY: 'goog-test',
    OPENAI_API_KEY: 'sk-openai-test',
    OLLAMA_BASE_URL: 'http://localhost:11434/v1',
    FLUX_API_KEY: 'flux-test',
    OPENAI_IMAGE_API_KEY: 'sk-openai-image-test',
    HYPERFRAMES_API_KEY: 'hf-test',
    VEO_API_KEY: 'veo-test',
    ELEVENLABS_API_KEY: 'el-test',
  });
  assert.deepEqual(ids, [
    'mock-local-text',
    'mock-local-media',
    'anthropic',
    'gemini',
    'openai',
    'ollama',
    'flux',
    'openai-image',
    'hyperframes',
    'veo',
    'elevenlabs',
  ]);
});

test('GET /health reports ok and the registered provider ids', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.deepEqual(body.providers, ['mock-local-text', 'mock-local-media']);
  });
});

test('POST rejects a request with no Bearer token when OMNIROUTE_API_KEY is configured', async () => {
  await withServer({ OMNIROUTE_API_KEY: 'shared-secret' }, async (base) => {
    const res = await fetch(base, { method: 'POST', body: '{}' });
    assert.equal(res.status, 401);
  });
});

test('POST rejects a request with an incorrect Bearer token (same and different length)', async () => {
  await withServer({ OMNIROUTE_API_KEY: 'shared-secret' }, async (base) => {
    const sameLength = await fetch(base, { method: 'POST', headers: { authorization: 'Bearer wrong-secret!' }, body: '{}' });
    assert.equal(sameLength.status, 401);
    const differentLength = await fetch(base, { method: 'POST', headers: { authorization: 'Bearer x' }, body: '{}' });
    assert.equal(differentLength.status, 401);
  });
});

test('POST is allowed unauthenticated when no OMNIROUTE_API_KEY is configured (dev mode)', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(createCapabilityRequest({ capability: 'generate_text', input: { prompt: 'hello' } })),
    });
    assert.equal(res.status, 200);
  });
});

test('POST end to end: valid capability request executes against a real registered provider and caches', async () => {
  await withServer({ OMNIROUTE_API_KEY: 'shared-secret' }, async (base) => {
    const request = createCapabilityRequest({ capability: 'generate_text', input: { prompt: 'Explain migraine triggers' } });
    const headers = { 'content-type': 'application/json', authorization: 'Bearer shared-secret' };

    const first = await fetch(base, { method: 'POST', headers, body: JSON.stringify(request) });
    assert.equal(first.status, 200);
    const firstBody = await first.json();
    assert.equal(firstBody.fromCache, false);
    assert.ok(firstBody.output.includes('migraine'));

    const second = await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify(createCapabilityRequest({ capability: 'generate_text', input: { prompt: 'Explain migraine triggers' } })),
    });
    const secondBody = await second.json();
    assert.equal(secondBody.fromCache, true);
  });
});

test('POST rejects an invalid capability request with 400', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ capability: 'not_a_real_capability', input: {} }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Invalid capability request/);
  });
});

test('POST rejects malformed JSON with 400', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json' });
    assert.equal(res.status, 400);
  });
});

test('unsupported HTTP method returns 405', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(base, { method: 'PUT', body: '{}' });
    assert.equal(res.status, 405);
  });
});

test('oversized request body is rejected with 413', async () => {
  await withServer({}, async (base) => {
    const hugePrompt = 'x'.repeat(1_100_000);
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(createCapabilityRequest({ capability: 'generate_text', input: { prompt: hugePrompt } })),
    });
    assert.equal(res.status, 413);
  });
});

test('a capability with no matching provider returns 502, never a crash', async () => {
  await withServer({}, async (base) => {
    // Neither mock provider declares "search_knowledge" — a clean way to exercise the "nothing
    // registered" failure path without the server process crashing.
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(createCapabilityRequest({ capability: 'search_knowledge', input: { query: 'x' } })),
    });
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.match(body.error, /No provider registered/);
  });
});
