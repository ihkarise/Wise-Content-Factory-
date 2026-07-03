/**
 * Generic adapter for any OpenAI-compatible chat-completions endpoint — covers OpenRouter,
 * DeepSeek, GPT, and self-hosted local models (e.g. Ollama) with one implementation, since they
 * all speak the same wire format. This is the concrete demonstration of "AI provider independence":
 * three named providers from the architecture docs (OpenRouter, DeepSeek, GPT) are all just
 * configuration of this one adapter, not separate code paths.
 */

import { defineProvider } from './providerInterface.js';

const CAPABILITIES = ['generate_text', 'summarize', 'translate', 'reason', 'analyze'];

/**
 * @param {{id: string, baseUrl: string, apiKey?: string, model: string, tier?: string, costPer1kTokensUsd?: number, fetchImpl?: typeof fetch}} options
 */
export function createOpenAiCompatibleProvider({
  id,
  baseUrl,
  apiKey,
  model,
  tier = 'low_cost',
  costPer1kTokensUsd = 0.001,
  fetchImpl = globalThis.fetch,
} = {}) {
  // A local endpoint (e.g. http://localhost:11434 for Ollama) needs no API key and is free.
  const isLocalEndpoint = /localhost|127\.0\.0\.1/.test(baseUrl || '');
  const requiresKey = !isLocalEndpoint;

  return defineProvider({
    id,
    capabilities: CAPABILITIES,
    tier: isLocalEndpoint ? 'local' : tier,
    healthStatus: requiresKey && !apiKey ? 'unavailable' : 'healthy',
    estimateCostUsd: (request) => (isLocalEndpoint ? 0 : estimateCost(request, costPer1kTokensUsd)),
    estimateDurationMs: () => 1200,
    async execute(request) {
      if (requiresKey && !apiKey) throw new Error(`Provider "${id}" has no API key configured.`);
      const messages = [{ role: 'user', content: buildPrompt(request) }];
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ model, messages }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`${id} API error ${response.status}: ${body}`);
      }
      const data = await response.json();
      const output = data.choices?.[0]?.message?.content ?? '';
      return { output, costUsd: isLocalEndpoint ? 0 : estimateCost(request, costPer1kTokensUsd) };
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

function estimateCost(request, costPer1kTokensUsd) {
  const roughTokens = JSON.stringify(request.input).length / 4 + (request.input.maxTokens || 400);
  return (roughTokens / 1000) * costPer1kTokensUsd;
}
