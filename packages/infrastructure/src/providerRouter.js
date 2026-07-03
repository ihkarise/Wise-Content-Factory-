/**
 * Provider Router — chooses the best provider for a capability. Providers are registered as
 * plugins (never hard-coded); adding a new provider requires only calling `registerProvider`,
 * matching "Providers should behave like plugins" (AI_INFRASTRUCTURE.md, "Plugin Integration").
 *
 * @typedef {Object} ProviderAdapter
 * @property {string} id
 * @property {string[]} capabilities         Capability names this provider fulfils.
 * @property {'local'|'browser'|'free'|'low_cost'|'premium'} tier
 * @property {(request: import('@wcf/core').CapabilityRequest) => number} estimateCostUsd
 * @property {(request: import('@wcf/core').CapabilityRequest) => number} estimateDurationMs
 * @property {(request: import('@wcf/core').CapabilityRequest) => Promise<{output: any, costUsd?: number}>} execute
 * @property {number} [successRate]          0-1, defaults to 1 (Provider Health Monitor input).
 * @property {'healthy'|'degraded'|'unavailable'} [healthStatus]
 */

import { rankProviders, withinBudget } from './costOptimizer.js';

export class ProviderRouter {
  constructor() {
    /** @type {Map<string, ProviderAdapter>} */
    this.providers = new Map();
  }

  /** @param {ProviderAdapter} provider */
  registerProvider(provider) {
    if (!provider?.id) throw new Error('Provider must have an id');
    this.providers.set(provider.id, { healthStatus: 'healthy', successRate: 1, ...provider });
  }

  unregisterProvider(providerId) {
    this.providers.delete(providerId);
  }

  listProviders() {
    return [...this.providers.values()];
  }

  /**
   * @param {import('@wcf/core').CapabilityRequest} request
   * @returns {Array<{id: string, tier: string, estimateUsd: number, estimateDurationMs: number, successRate: number, execute: () => Promise<any>}>}
   */
  rankCandidates(request) {
    const candidates = [...this.providers.values()]
      .filter((p) => p.capabilities.includes(request.capability))
      .filter((p) => p.healthStatus !== 'unavailable')
      .filter((p) => !request.preferredProvider || p.id === request.preferredProvider)
      .map((p) => ({
        id: p.id,
        tier: p.tier,
        estimateUsd: p.estimateCostUsd(request),
        estimateDurationMs: p.estimateDurationMs(request),
        successRate: p.successRate ?? 1,
        execute: () => p.execute(request),
      }))
      .filter((c) => withinBudget(request, c));

    return rankProviders(candidates);
  }
}
