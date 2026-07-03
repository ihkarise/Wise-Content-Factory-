/**
 * Real image-generation provider backed by Black Forest Labs' FLUX API
 * (https://docs.bfl.ml — submit a generation job, poll for the result). First priority in the
 * image-provider order given in docs/architecture/AI_INFRASTRUCTURE.md ("Image Models: FLUX,
 * SDXL, Imagen") and the project's build directive.
 *
 * Same conventions as every other provider: no API key -> healthStatus 'unavailable', apiKey
 * injected by the caller, fetchImpl injectable for testing. Submit + poll logic is shared via
 * asyncJobPolling.js since HyperFrames and Veo need the exact same pattern.
 */
import { defineProvider } from './providerInterface.js';
import { pollUntilComplete } from './asyncJobPolling.js';

const CAPABILITIES = ['generate_image', 'generate_thumbnail'];
const DEFAULT_MODEL = 'flux-pro-1.1';
const API_BASE_URL = 'https://api.bfl.ml/v1';

// Rough public per-image pricing for cost estimation only (not billing-accurate).
const COST_PER_IMAGE_USD = 0.04;

/**
 * @param {{apiKey?: string, model?: string, id?: string, tier?: string, width?: number,
 *   height?: number, fetchImpl?: typeof fetch, pollIntervalMs?: number, maxPollAttempts?: number}} options
 */
export function createFluxProvider({
  apiKey,
  model = DEFAULT_MODEL,
  id = 'flux',
  tier = 'low_cost',
  width = 1024,
  height = 1024,
  fetchImpl = globalThis.fetch,
  pollIntervalMs = 500,
  maxPollAttempts = 60,
} = {}) {
  return defineProvider({
    id,
    capabilities: CAPABILITIES,
    tier,
    healthStatus: apiKey ? 'healthy' : 'unavailable',
    estimateCostUsd: () => COST_PER_IMAGE_USD,
    estimateDurationMs: () => 8000,
    async execute(request) {
      if (!apiKey) throw new Error(`Provider "${id}" has no API key configured.`);
      const prompt = request.input.prompt || request.input.description || JSON.stringify(request.input);

      const submitResponse = await fetchImpl(`${API_BASE_URL}/${model}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-key': apiKey },
        body: JSON.stringify({ prompt, width, height }),
      });
      if (!submitResponse.ok) {
        const body = await submitResponse.text().catch(() => '');
        throw new Error(`FLUX API error ${submitResponse.status}: ${body}`);
      }
      const { id: jobId, polling_url: pollingUrl } = await submitResponse.json();
      if (!pollingUrl) throw new Error('FLUX API did not return a polling_url for the submitted job.');

      const final = await pollUntilComplete({
        poll: async () => {
          const pollResponse = await fetchImpl(`${pollingUrl}${pollingUrl.includes('?') ? '&' : '?'}id=${jobId}`, {
            headers: { 'x-key': apiKey },
          });
          if (!pollResponse.ok) {
            const body = await pollResponse.text().catch(() => '');
            throw new Error(`FLUX API polling error ${pollResponse.status}: ${body}`);
          }
          return pollResponse.json();
        },
        isDone: (result) => result.status === 'Ready',
        isFailed: (result) => result.status === 'Error' || result.status === 'Content Moderated' || result.status === 'Request Moderated',
        getError: (result) => `FLUX generation failed with status "${result.status}".`,
        intervalMs: pollIntervalMs,
        maxAttempts: maxPollAttempts,
      });

      return {
        output: { imageUrl: final.result?.sample, provider: id, model },
        costUsd: COST_PER_IMAGE_USD,
      };
    },
  });
}
