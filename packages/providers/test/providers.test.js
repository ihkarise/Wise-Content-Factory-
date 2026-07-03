import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilityRequest } from '@wcf/core';
import { defineProvider, createMockTextProvider, createMockMediaProvider, createAnthropicProvider, createOpenAiCompatibleProvider } from '../src/index.js';

test('defineProvider throws when required functions are missing', () => {
  assert.throws(() => defineProvider({ id: 'broken' }), /missing required function/);
});

test('mock provider generates deterministic zero-cost text', async () => {
  const provider = createMockTextProvider();
  assert.equal(provider.tier, 'local');
  assert.equal(provider.estimateCostUsd({}), 0);
  const request = createCapabilityRequest({ capability: 'generate_text', input: { prompt: 'Promote PillFill to pharmacists' } });
  const result = await provider.execute(request);
  assert.equal(result.costUsd, 0);
  assert.match(result.output, /PillFill/);
});

test('mock provider summarize takes the first two sentences', async () => {
  const provider = createMockTextProvider();
  const request = createCapabilityRequest({
    capability: 'summarize',
    input: { text: 'First sentence. Second sentence. Third sentence that should be dropped.' },
  });
  const result = await provider.execute(request);
  assert.equal(result.output, 'First sentence. Second sentence.');
});

test('mock provider create_storyboard splits script lines into scenes', async () => {
  const provider = createMockTextProvider();
  const request = createCapabilityRequest({ capability: 'create_storyboard', input: { script: 'Open on clinic.\nDoctor explains migraine.\nCall to action.' } });
  const result = await provider.execute(request);
  assert.equal(result.output.scenes.length, 3);
  assert.equal(result.output.scenes[0].scene, 1);
});

test('mock provider rejects unsupported capability', async () => {
  const provider = createMockTextProvider();
  const request = createCapabilityRequest({ capability: 'generate_video', input: {} });
  await assert.rejects(provider.execute(request), /does not implement capability/);
});

test('mock media provider returns a structured zero-cost placeholder for image generation', async () => {
  const provider = createMockMediaProvider();
  assert.equal(provider.tier, 'local');
  const request = createCapabilityRequest({ capability: 'generate_image', input: { prompt: 'A friendly pharmacist' } });
  const result = await provider.execute(request);
  assert.equal(result.costUsd, 0);
  assert.equal(result.output.placeholder, true);
  assert.equal(result.output.mediaType, 'image');
  assert.match(result.output.description, /pharmacist/);
});

test('anthropic provider is marked unavailable with no API key, so the router will skip it', () => {
  const provider = createAnthropicProvider({});
  assert.equal(provider.healthStatus, 'unavailable');
});

test('anthropic provider calls the Messages API and returns text output when a key is present', async () => {
  let capturedRequest;
  const fakeFetch = async (url, init) => {
    capturedRequest = { url, init };
    return {
      ok: true,
      json: async () => ({ content: [{ text: 'Hello from Claude' }] }),
    };
  };
  const provider = createAnthropicProvider({ apiKey: 'sk-test', fetchImpl: fakeFetch });
  assert.equal(provider.healthStatus, 'healthy');
  const request = createCapabilityRequest({ capability: 'generate_text', input: { prompt: 'Say hi' } });
  const result = await provider.execute(request);
  assert.equal(result.output, 'Hello from Claude');
  assert.equal(capturedRequest.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(capturedRequest.init.headers['x-api-key'], 'sk-test');
});

test('anthropic provider surfaces a clear error on a non-ok API response', async () => {
  const fakeFetch = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  const provider = createAnthropicProvider({ apiKey: 'sk-test', fetchImpl: fakeFetch });
  const request = createCapabilityRequest({ capability: 'generate_text', input: { prompt: 'hi' } });
  await assert.rejects(provider.execute(request), /Anthropic API error 500/);
});

test('openAiCompatibleProvider works against a local (Ollama-style) endpoint with no API key, tier=local, cost=0', async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'local reply' } }] }) });
  const provider = createOpenAiCompatibleProvider({
    id: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3', fetchImpl: fakeFetch,
  });
  assert.equal(provider.tier, 'local');
  assert.equal(provider.healthStatus, 'healthy');
  const request = createCapabilityRequest({ capability: 'generate_text', input: { prompt: 'hi' } });
  const result = await provider.execute(request);
  assert.equal(result.output, 'local reply');
  assert.equal(result.costUsd, 0);
});

test('openAiCompatibleProvider is unavailable for a remote endpoint with no API key', () => {
  const provider = createOpenAiCompatibleProvider({ id: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'x' });
  assert.equal(provider.healthStatus, 'unavailable');
});

test('openAiCompatibleProvider authorizes with a bearer token for a remote endpoint', async () => {
  let capturedHeaders;
  const fakeFetch = async (url, init) => {
    capturedHeaders = init.headers;
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'remote reply' } }] }) };
  };
  const provider = createOpenAiCompatibleProvider({
    id: 'deepseek', baseUrl: 'https://api.deepseek.com', apiKey: 'ds-key', model: 'deepseek-chat', fetchImpl: fakeFetch,
  });
  const request = createCapabilityRequest({ capability: 'generate_text', input: { prompt: 'hi' } });
  await provider.execute(request);
  assert.equal(capturedHeaders.authorization, 'Bearer ds-key');
});
