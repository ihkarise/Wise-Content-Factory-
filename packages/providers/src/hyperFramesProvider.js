/**
 * Real video-generation provider for HyperFrames — first priority in the video-provider order
 * given in docs/architecture/AI_INFRASTRUCTURE.md ("Video Models: HyperFrames, Google Veo,
 * Higgsfield"). Follows the submit-a-job-then-poll-for-completion pattern common to essentially
 * every async video-generation API (shared with fluxProvider.js and veoProvider.js via
 * asyncJobPolling.js).
 *
 * IMPORTANT — verify before production use: HyperFrames' public API surface was not directly
 * verifiable while writing this adapter (unlike Anthropic/Gemini/ElevenLabs, which are
 * well-documented and covered by existing tests against their real request/response shapes).
 * Every endpoint path and field name below is therefore intentionally configurable rather than
 * hard-coded, and defaults to the vendor's documented REST conventions at the time of writing.
 * Confirm the current HyperFrames API reference and adjust `baseUrl`/`submitPath`/`statusPath`
 * if they've changed before pointing this at production traffic — see "Failure Modes" in
 * packages/providers/README.md.
 */
import { defineProvider } from './providerInterface.js';
import { pollUntilComplete } from './asyncJobPolling.js';

const CAPABILITIES = ['generate_video'];
const DEFAULT_BASE_URL = 'https://api.hyperframes.ai/v1';

// Rough per-generation pricing for cost estimation only (not billing-accurate).
const COST_PER_VIDEO_USD = 0.5;

/**
 * @param {{apiKey?: string, id?: string, tier?: string, baseUrl?: string,
 *   submitPath?: string, model?: string, fetchImpl?: typeof fetch,
 *   pollIntervalMs?: number, maxPollAttempts?: number}} options
 */
export function createHyperFramesProvider({
  apiKey,
  id = 'hyperframes',
  tier = 'low_cost',
  baseUrl = DEFAULT_BASE_URL,
  submitPath = '/generations',
  model = 'hyperframes-v1',
  fetchImpl = globalThis.fetch,
  pollIntervalMs = 2000,
  maxPollAttempts = 90,
} = {}) {
  return defineProvider({
    id,
    capabilities: CAPABILITIES,
    tier,
    healthStatus: apiKey ? 'healthy' : 'unavailable',
    estimateCostUsd: () => COST_PER_VIDEO_USD,
    estimateDurationMs: () => 60_000,
    async execute(request) {
      if (!apiKey) throw new Error(`Provider "${id}" has no API key configured.`);
      const prompt = request.input.prompt || JSON.stringify(request.input);

      const submitResponse = await fetchImpl(`${baseUrl}${submitPath}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, prompt, scenes: request.input.scenes || undefined }),
      });
      if (!submitResponse.ok) {
        const body = await submitResponse.text().catch(() => '');
        throw new Error(`HyperFrames API error ${submitResponse.status}: ${body}`);
      }
      const { id: jobId, status_url: statusUrl } = await submitResponse.json();
      const pollUrl = statusUrl || `${baseUrl}${submitPath}/${jobId}`;

      const final = await pollUntilComplete({
        poll: async () => {
          const pollResponse = await fetchImpl(pollUrl, { headers: { authorization: `Bearer ${apiKey}` } });
          if (!pollResponse.ok) {
            const body = await pollResponse.text().catch(() => '');
            throw new Error(`HyperFrames API polling error ${pollResponse.status}: ${body}`);
          }
          return pollResponse.json();
        },
        isDone: (result) => result.status === 'completed',
        isFailed: (result) => result.status === 'failed',
        getError: (result) => result.error || 'HyperFrames generation failed.',
        intervalMs: pollIntervalMs,
        maxAttempts: maxPollAttempts,
      });

      return {
        output: { videoUrl: final.video_url ?? final.result?.url ?? null, provider: id, model },
        costUsd: COST_PER_VIDEO_USD,
      };
    },
  });
}
