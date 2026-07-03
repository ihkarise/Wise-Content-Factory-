/**
 * Wraps gatewayClient as a standard ProviderAdapter (see @wcf/infrastructure/providerRouter.js),
 * so the rest of the app never knows whether output came from the local mock provider or a real
 * AI provider behind the gateway — same contract either way.
 */
import { requestCapability, isGatewayConfigured, getStoredSessionToken } from './gatewayClient.js';

const CAPABILITIES = [
  'generate_text',
  'summarize',
  'translate',
  'reason',
  'analyze',
  'generate_image',
  'generate_video',
  'generate_speech',
  'generate_thumbnail',
];

// ProviderRouter reads `healthStatus` as a plain (non-reactive) property, so this must be
// re-registered (see app.js's refreshProviders) any time login state changes, rather than
// relying on a live getter — registering the same id again simply replaces the stored entry.
export function createGatewayProvider() {
  return {
    id: 'gateway',
    capabilities: CAPABILITIES,
    tier: 'premium',
    healthStatus: isGatewayConfigured() && getStoredSessionToken() ? 'healthy' : 'unavailable',
    estimateCostUsd: () => 0.01,
    estimateDurationMs: () => 2500,
    async execute(request) {
      const result = await requestCapability(request);
      return { output: result.output, costUsd: result.costUsd ?? 0.01 };
    },
  };
}
