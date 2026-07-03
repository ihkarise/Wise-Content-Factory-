/**
 * Real text-generation provider backed by Google's Gemini API. Google is listed alongside Claude,
 * GPT, and DeepSeek under "Language Models" in docs/architecture/AI_INFRASTRUCTURE.md, but unlike
 * GPT/DeepSeek/OpenRouter (which all speak the OpenAI-compatible chat-completions format handled
 * by openAiCompatibleProvider.js) Gemini's request/response shape is its own — this is a genuinely
 * separate adapter, not another configuration of the generic one.
 *
 * Same rules as every other provider (see anthropicProvider.js): the API key must be injected by
 * the caller, never read from the environment inside this package; no key means
 * healthStatus: 'unavailable' so the Provider Router silently skips it instead of breaking the
 * workflow.
 */

import { defineProvider } from './providerInterface.js';

const CAPABILITIES = ['generate_text', 'summarize', 'translate', 'reason', 'analyze'];
const DEFAULT_MODEL = 'gemini-1.5-flash';
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Rough public per-token pricing for cost estimation only (not billing-accurate).
const COST_PER_1K_INPUT_TOKENS_USD = 0.000075;
const COST_PER_1K_OUTPUT_TOKENS_USD = 0.0003;

/**
 * @param {{apiKey?: string, model?: string, id?: string, tier?: string, fetchImpl?: typeof fetch}} options
 */
export function createGeminiProvider({
  apiKey,
  model = DEFAULT_MODEL,
  id = 'gemini',
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
      const url = `${API_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: request.input.maxTokens || 512 },
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Gemini API error ${response.status}: ${body}`);
      }
      const data = await response.json();
      const output = (data.candidates?.[0]?.content?.parts ?? []).map((part) => part.text).join('');
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
