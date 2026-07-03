/**
 * Real text-generation provider backed by the Anthropic Messages API. This is one interchangeable
 * plugin among many (see ARCHITECTURE.md, "Provider Rules": "No business logic should depend on
 * provider APIs") — nothing outside packages/providers knows or cares that this specific adapter
 * exists.
 *
 * The API key must be injected by the caller (see apps/gateway, which holds it server-side and
 * never forwards it to the browser — see docs/architecture/SECURITY_ARCHITECTURE.md). If no key is
 * supplied, this provider registers itself as unavailable rather than throwing, so the Provider
 * Router silently skips it and falls back to a cheaper/local tier instead of breaking the workflow.
 */

import { defineProvider } from './providerInterface.js';

const CAPABILITIES = ['generate_text', 'summarize', 'translate', 'reason', 'analyze'];
const DEFAULT_MODEL = 'claude-3-5-haiku-latest';
const API_URL = 'https://api.anthropic.com/v1/messages';
// A hung upstream connection would otherwise tie up the request indefinitely — Node's fetch has
// no default timeout of its own.
const DEFAULT_TIMEOUT_MS = 30_000;

// Rough public per-token pricing for cost estimation only (not billing-accurate).
const COST_PER_1K_INPUT_TOKENS_USD = 0.0008;
const COST_PER_1K_OUTPUT_TOKENS_USD = 0.004;

/**
 * @param {{apiKey?: string, model?: string, id?: string, tier?: string, fetchImpl?: typeof fetch}} options
 */
export function createAnthropicProvider({
  apiKey,
  model = DEFAULT_MODEL,
  id = 'anthropic',
  tier = 'premium',
  fetchImpl = globalThis.fetch,
} = {}) {
  return defineProvider({
    id,
    capabilities: CAPABILITIES,
    tier,
    healthStatus: apiKey ? 'healthy' : 'unavailable',
    estimateCostUsd: (request) => estimateCost(request),
    estimateDurationMs: () => 1500,
    async execute(request) {
      if (!apiKey) throw new Error(`Provider "${id}" has no API key configured.`);
      const prompt = buildPrompt(request);
      const response = await fetchImpl(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: request.input.maxTokens || 512,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Anthropic API error ${response.status}: ${body}`);
      }
      const data = await response.json();
      const output = data.content?.map((block) => block.text).join('') ?? '';
      return { output, costUsd: estimateCost(request) };
    },
  });
}

function buildPrompt(request) {
  const { capability, input } = request;
  switch (capability) {
    case 'summarize':
      return `Summarize the following text concisely:\n\n${input.text}`;
    case 'translate':
      return `Translate the following text to ${input.targetLanguage}:\n\n${input.text}`;
    case 'reason':
    case 'analyze':
      return input.question || input.prompt || JSON.stringify(input);
    default:
      return input.prompt || JSON.stringify(input);
  }
}

function estimateCost(request) {
  const roughInputTokens = JSON.stringify(request.input).length / 4;
  const roughOutputTokens = (request.input.maxTokens || 512) / 2;
  return (
    (roughInputTokens / 1000) * COST_PER_1K_INPUT_TOKENS_USD +
    (roughOutputTokens / 1000) * COST_PER_1K_OUTPUT_TOKENS_USD
  );
}
