/**
 * Real video-generation provider for Google Veo, via the Gemini API's long-running-operation
 * pattern (`POST /models/{model}:predictLongRunning` returns an operation name, then
 * `GET /{operation.name}` is polled until `done: true`). Second priority in the video-provider
 * order given in docs/architecture/AI_INFRASTRUCTURE.md, after HyperFrames.
 *
 * Same conventions as geminiProvider.js: no API key -> healthStatus 'unavailable', apiKey
 * injected by the caller, fetchImpl injectable for testing. Polling is shared via
 * asyncJobPolling.js.
 */
import { defineProvider } from './providerInterface.js';
import { pollUntilComplete } from './asyncJobPolling.js';

const CAPABILITIES = ['generate_video'];
const DEFAULT_MODEL = 'veo-2.0-generate-001';
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Rough per-generation pricing for cost estimation only (not billing-accurate) — Veo is priced
// per second of output video; this assumes a short ~5s clip as a representative default.
const COST_PER_VIDEO_USD = 1.75;

// Each individual HTTP call (submit, each poll) gets its own bounded timeout — a hung upstream
// would otherwise tie up that one call indefinitely regardless of pollUntilComplete's own
// maxAttempts budget, since an attempt that never resolves never increments the attempt counter.
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * @param {{apiKey?: string, model?: string, id?: string, tier?: string, fetchImpl?: typeof fetch,
 *   pollIntervalMs?: number, maxPollAttempts?: number}} options
 */
export function createVeoProvider({
  apiKey,
  model = DEFAULT_MODEL,
  id = 'veo',
  tier = 'premium',
  fetchImpl = globalThis.fetch,
  pollIntervalMs = 5000,
  maxPollAttempts = 60,
} = {}) {
  return defineProvider({
    id,
    capabilities: CAPABILITIES,
    tier,
    healthStatus: apiKey ? 'healthy' : 'unavailable',
    estimateCostUsd: () => COST_PER_VIDEO_USD,
    estimateDurationMs: () => 120_000,
    async execute(request) {
      if (!apiKey) throw new Error(`Provider "${id}" has no API key configured.`);
      const prompt = request.input.prompt || JSON.stringify(request.input);

      const submitResponse = await fetchImpl(`${API_BASE_URL}/models/${model}:predictLongRunning?key=${apiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ instances: [{ prompt }] }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!submitResponse.ok) {
        const body = await submitResponse.text().catch(() => '');
        throw new Error(`Veo API error ${submitResponse.status}: ${body}`);
      }
      const { name: operationName } = await submitResponse.json();
      if (!operationName) throw new Error('Veo API did not return an operation name for the submitted job.');

      const final = await pollUntilComplete({
        poll: async () => {
          const pollResponse = await fetchImpl(`${API_BASE_URL}/${operationName}?key=${apiKey}`, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
          if (!pollResponse.ok) {
            const body = await pollResponse.text().catch(() => '');
            throw new Error(`Veo API polling error ${pollResponse.status}: ${body}`);
          }
          return pollResponse.json();
        },
        isDone: (result) => result.done === true,
        isFailed: (result) => result.done === true && Boolean(result.error),
        getError: (result) => result.error?.message || 'Veo generation failed.',
        intervalMs: pollIntervalMs,
        maxAttempts: maxPollAttempts,
      });

      const videoUri = final.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ?? null;
      return { output: { videoUrl: videoUri, provider: id, model }, costUsd: COST_PER_VIDEO_USD };
    },
  });
}
