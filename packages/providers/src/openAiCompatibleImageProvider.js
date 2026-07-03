/**
 * Generic adapter for any OpenAI-compatible image-generation endpoint (`POST {baseUrl}/images/generations`,
 * `{model, prompt, size, n}` in, `{data: [{url|b64_json}]}` out) — covers OpenAI's own DALL-E/gpt-image
 * models and any self-hosted or third-party endpoint that mirrors that contract, the same way
 * openAiCompatibleProvider.js covers text models. Second priority in the image-provider order
 * (after FLUX) per docs/architecture/AI_INFRASTRUCTURE.md.
 */
import { defineProvider } from './providerInterface.js';

const CAPABILITIES = ['generate_image', 'generate_thumbnail'];

/**
 * @param {{id: string, baseUrl: string, apiKey?: string, model: string, size?: string,
 *   tier?: string, costPerImageUsd?: number, fetchImpl?: typeof fetch}} options
 */
export function createOpenAiCompatibleImageProvider({
  id,
  baseUrl,
  apiKey,
  model,
  size = '1024x1024',
  tier = 'premium',
  costPerImageUsd = 0.04,
  fetchImpl = globalThis.fetch,
} = {}) {
  const isLocalEndpoint = /localhost|127\.0\.0\.1/.test(baseUrl || '');
  const requiresKey = !isLocalEndpoint;

  return defineProvider({
    id,
    capabilities: CAPABILITIES,
    tier: isLocalEndpoint ? 'local' : tier,
    healthStatus: requiresKey && !apiKey ? 'unavailable' : 'healthy',
    estimateCostUsd: () => (isLocalEndpoint ? 0 : costPerImageUsd),
    estimateDurationMs: () => 6000,
    async execute(request) {
      if (requiresKey && !apiKey) throw new Error(`Provider "${id}" has no API key configured.`);
      const prompt = request.input.prompt || request.input.description || JSON.stringify(request.input);
      const response = await fetchImpl(`${baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ model, prompt, size, n: 1 }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`${id} API error ${response.status}: ${body}`);
      }
      const data = await response.json();
      const image = data.data?.[0] ?? {};
      return {
        output: { imageUrl: image.url ?? null, imageBase64: image.b64_json ?? null, provider: id, model },
        costUsd: isLocalEndpoint ? 0 : costPerImageUsd,
      };
    },
  });
}
