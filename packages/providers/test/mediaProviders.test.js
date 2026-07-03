import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilityRequest } from '@wcf/core';
import {
  pollUntilComplete,
  createFluxProvider,
  createOpenAiCompatibleImageProvider,
  createHyperFramesProvider,
  createVeoProvider,
  createBrowserTtsProvider,
  createElevenLabsProvider,
} from '../src/index.js';

test('pollUntilComplete polls until isDone, then returns the final result', async () => {
  let calls = 0;
  const result = await pollUntilComplete({
    poll: async () => {
      calls += 1;
      return { status: calls < 3 ? 'pending' : 'done' };
    },
    isDone: (r) => r.status === 'done',
    intervalMs: 1,
  });
  assert.equal(calls, 3);
  assert.equal(result.status, 'done');
});

test('pollUntilComplete throws on isFailed instead of polling forever', async () => {
  await assert.rejects(
    pollUntilComplete({
      poll: async () => ({ status: 'failed' }),
      isDone: () => false,
      isFailed: (r) => r.status === 'failed',
      getError: () => 'boom',
      intervalMs: 1,
    }),
    /boom/
  );
});

test('pollUntilComplete gives up after maxAttempts', async () => {
  await assert.rejects(
    pollUntilComplete({ poll: async () => ({ status: 'pending' }), isDone: () => false, intervalMs: 1, maxAttempts: 3 }),
    /did not complete after 3 poll attempts/
  );
});

// --- FLUX ---------------------------------------------------------------

test('flux provider is unavailable with no API key', () => {
  const provider = createFluxProvider({});
  assert.equal(provider.healthStatus, 'unavailable');
  assert.equal(provider.tier, 'low_cost');
});

test('flux provider submits a job then polls until Ready', async () => {
  let call = 0;
  const fakeFetch = async (url, init) => {
    call += 1;
    if (call === 1) {
      assert.match(url, /^https:\/\/api\.bfl\.ml\/v1\/flux-pro-1\.1$/);
      assert.equal(init.headers['x-key'], 'flux-key');
      return { ok: true, json: async () => ({ id: 'job-1', polling_url: 'https://api.bfl.ml/v1/poll' }) };
    }
    return { ok: true, json: async () => ({ status: call < 3 ? 'Pending' : 'Ready', result: { sample: 'https://cdn.bfl.ml/out.png' } }) };
  };
  const provider = createFluxProvider({ apiKey: 'flux-key', fetchImpl: fakeFetch, pollIntervalMs: 1 });
  const request = createCapabilityRequest({ capability: 'generate_image', input: { prompt: 'a friendly pharmacist' } });
  const result = await provider.execute(request);
  assert.equal(result.output.imageUrl, 'https://cdn.bfl.ml/out.png');
  assert.ok(call >= 3);
});

test('flux provider throws a clear error when the job fails', async () => {
  const fakeFetch = async (url, init) => {
    if (init?.method === 'POST') return { ok: true, json: async () => ({ id: 'job-1', polling_url: 'https://api.bfl.ml/v1/poll' }) };
    return { ok: true, json: async () => ({ status: 'Error' }) };
  };
  const provider = createFluxProvider({ apiKey: 'flux-key', fetchImpl: fakeFetch, pollIntervalMs: 1 });
  const request = createCapabilityRequest({ capability: 'generate_image', input: { prompt: 'x' } });
  await assert.rejects(provider.execute(request), /FLUX generation failed/);
});

// --- OpenAI-compatible image ---------------------------------------------

test('openAiCompatibleImageProvider is unavailable for a remote endpoint with no API key', () => {
  const provider = createOpenAiCompatibleImageProvider({ id: 'openai-image', baseUrl: 'https://api.openai.com/v1', model: 'gpt-image-1' });
  assert.equal(provider.healthStatus, 'unavailable');
});

test('openAiCompatibleImageProvider generates an image and returns its url', async () => {
  let captured;
  const fakeFetch = async (url, init) => {
    captured = { url, body: JSON.parse(init.body) };
    return { ok: true, json: async () => ({ data: [{ url: 'https://cdn.openai.com/out.png' }] }) };
  };
  const provider = createOpenAiCompatibleImageProvider({
    id: 'openai-image', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test', model: 'gpt-image-1', fetchImpl: fakeFetch,
  });
  const request = createCapabilityRequest({ capability: 'generate_image', input: { prompt: 'a logo' } });
  const result = await provider.execute(request);
  assert.equal(result.output.imageUrl, 'https://cdn.openai.com/out.png');
  assert.equal(captured.url, 'https://api.openai.com/v1/images/generations');
  assert.equal(captured.body.prompt, 'a logo');
});

test('openAiCompatibleImageProvider is free and local for a localhost endpoint with no key', async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'ZmFrZQ==' }] }) });
  const provider = createOpenAiCompatibleImageProvider({ id: 'local-sdxl', baseUrl: 'http://localhost:7860/v1', model: 'sdxl', fetchImpl: fakeFetch });
  assert.equal(provider.tier, 'local');
  assert.equal(provider.healthStatus, 'healthy');
  const result = await provider.execute(createCapabilityRequest({ capability: 'generate_image', input: { prompt: 'x' } }));
  assert.equal(result.costUsd, 0);
  assert.equal(result.output.imageBase64, 'ZmFrZQ==');
});

// --- HyperFrames ----------------------------------------------------------

test('hyperframes provider is unavailable with no API key', () => {
  const provider = createHyperFramesProvider({});
  assert.equal(provider.healthStatus, 'unavailable');
  assert.equal(provider.tier, 'low_cost');
});

test('hyperframes provider submits a job then polls until completed', async () => {
  let call = 0;
  const fakeFetch = async (url, init) => {
    call += 1;
    if (init?.method === 'POST') {
      assert.equal(init.headers.authorization, 'Bearer hf-key');
      return { ok: true, json: async () => ({ id: 'job-1', status_url: 'https://api.hyperframes.ai/v1/generations/job-1' }) };
    }
    return { ok: true, json: async () => (call < 3 ? { status: 'processing' } : { status: 'completed', video_url: 'https://cdn.hyperframes.ai/out.mp4' }) };
  };
  const provider = createHyperFramesProvider({ apiKey: 'hf-key', fetchImpl: fakeFetch, pollIntervalMs: 1 });
  const request = createCapabilityRequest({ capability: 'generate_video', input: { prompt: 'a product demo' } });
  const result = await provider.execute(request);
  assert.equal(result.output.videoUrl, 'https://cdn.hyperframes.ai/out.mp4');
});

// --- Veo --------------------------------------------------------------

test('veo provider is unavailable with no API key', () => {
  const provider = createVeoProvider({});
  assert.equal(provider.healthStatus, 'unavailable');
  assert.equal(provider.tier, 'premium');
});

test('veo provider submits a long-running operation then polls until done', async () => {
  let call = 0;
  const fakeFetch = async (url) => {
    call += 1;
    if (call === 1) {
      assert.match(url, /predictLongRunning\?key=veo-key$/);
      return { ok: true, json: async () => ({ name: 'operations/op-1' }) };
    }
    assert.match(url, /operations\/op-1\?key=veo-key$/);
    if (call < 3) return { ok: true, json: async () => ({ done: false }) };
    return {
      ok: true,
      json: async () => ({ done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://veo.googleapis.com/out.mp4' } }] } } }),
    };
  };
  const provider = createVeoProvider({ apiKey: 'veo-key', fetchImpl: fakeFetch, pollIntervalMs: 1 });
  const request = createCapabilityRequest({ capability: 'generate_video', input: { prompt: 'a product demo' } });
  const result = await provider.execute(request);
  assert.equal(result.output.videoUrl, 'https://veo.googleapis.com/out.mp4');
});

test('veo provider surfaces the operation error message on failure', async () => {
  const fakeFetch = async (url) =>
    url.includes('predictLongRunning')
      ? { ok: true, json: async () => ({ name: 'operations/op-1' }) }
      : { ok: true, json: async () => ({ done: true, error: { message: 'quota exceeded' } }) };
  const provider = createVeoProvider({ apiKey: 'veo-key', fetchImpl: fakeFetch, pollIntervalMs: 1 });
  await assert.rejects(
    provider.execute(createCapabilityRequest({ capability: 'generate_video', input: { prompt: 'x' } })),
    /quota exceeded/
  );
});

// --- Browser TTS ------------------------------------------------------

test('browser TTS provider is unavailable when no SpeechSynthesis API is present (e.g. Node)', () => {
  const provider = createBrowserTtsProvider({});
  assert.equal(provider.healthStatus, 'unavailable');
  assert.equal(provider.tier, 'browser');
});

test('browser TTS provider is healthy and free when a SpeechSynthesis-like API is injected', async () => {
  const fakeSpeechSynthesis = { speak: () => {} };
  const provider = createBrowserTtsProvider({ speechSynthesisImpl: fakeSpeechSynthesis, voice: 'en-US' });
  assert.equal(provider.healthStatus, 'healthy');
  assert.equal(provider.estimateCostUsd({}), 0);
  const request = createCapabilityRequest({ capability: 'generate_speech', input: { prompt: 'Welcome to PillFill' } });
  const result = await provider.execute(request);
  assert.equal(result.costUsd, 0);
  assert.equal(result.output.mode, 'browser-speech-synthesis');
  assert.equal(result.output.text, 'Welcome to PillFill');
  assert.equal(result.output.voice, 'en-US');
});

// --- ElevenLabs ---------------------------------------------------------

test('elevenlabs provider is unavailable with no API key', () => {
  const provider = createElevenLabsProvider({});
  assert.equal(provider.healthStatus, 'unavailable');
});

test('elevenlabs provider posts text and returns base64 audio', async () => {
  let captured;
  const fakeFetch = async (url, init) => {
    captured = { url, headers: init.headers, body: JSON.parse(init.body) };
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode('fake-mp3-bytes').buffer };
  };
  const provider = createElevenLabsProvider({ apiKey: 'el-key', fetchImpl: fakeFetch });
  const request = createCapabilityRequest({ capability: 'generate_speech', input: { text: 'Welcome to PillFill' } });
  const result = await provider.execute(request);
  assert.equal(captured.url, 'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM');
  assert.equal(captured.headers['xi-api-key'], 'el-key');
  assert.equal(captured.body.text, 'Welcome to PillFill');
  assert.equal(result.output.mimeType, 'audio/mpeg');
  assert.equal(Buffer.from(result.output.audioBase64, 'base64').toString('utf8'), 'fake-mp3-bytes');
  assert.ok(result.costUsd > 0);
});

test('elevenlabs provider surfaces a clear error on a non-ok API response', async () => {
  const fakeFetch = async () => ({ ok: false, status: 401, text: async () => 'invalid api key' });
  const provider = createElevenLabsProvider({ apiKey: 'bad-key', fetchImpl: fakeFetch });
  const request = createCapabilityRequest({ capability: 'generate_speech', input: { text: 'hi' } });
  await assert.rejects(provider.execute(request), /ElevenLabs API error 401/);
});
