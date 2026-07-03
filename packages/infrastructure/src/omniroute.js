/**
 * OmniRoute — the default AI gateway and the single entry point every Engine and Agent must use
 * for AI capabilities. This is the concrete implementation of the rule repeated in nearly every
 * architecture document: "No Engine or Agent should communicate directly with any AI provider."
 *
 * Request lifecycle (see docs/architecture/AI_INFRASTRUCTURE.md, "AI Request Lifecycle" — "Agents
 * should never bypass this lifecycle"):
 *
 *   Capability Request -> Cache Lookup -> Provider Ranking (Cost Optimizer) -> Execution (Retry/Failover)
 *   -> Validation -> Caching -> Observability -> Return Result
 */

import { validateCapabilityRequest } from '@wcf/core';
import { CacheEngine } from './cacheEngine.js';
import { ProviderRouter } from './providerRouter.js';
import { executeWithFailover } from './retryManager.js';
import { buildEstimateReport } from './costOptimizer.js';
import { ObservabilityLog } from './observability.js';

export class OmniRoute {
  /**
   * @param {{cache?: CacheEngine, router?: ProviderRouter, observability?: ObservabilityLog}} [deps]
   */
  constructor(deps = {}) {
    this.cache = deps.cache || new CacheEngine();
    this.router = deps.router || new ProviderRouter();
    this.observability = deps.observability || new ObservabilityLog();
  }

  /** @param {import('./providerRouter.js').ProviderAdapter} provider */
  registerProvider(provider) {
    this.router.registerProvider(provider);
  }

  /**
   * @param {import('@wcf/core').CapabilityRequest} request
   * @returns {Promise<{output: any, costUsd: number, fromCache: boolean, providerId: string|null, durationMs: number}>}
   */
  async request(request) {
    const start = Date.now();
    const { valid, errors } = validateCapabilityRequest(request);
    if (!valid) throw new Error(`Invalid capability request: ${errors.join('; ')}`);

    if (request.allowCache) {
      const cached = this.cache.get(request);
      if (cached !== undefined) {
        this.observability.record({
          type: 'capability_request',
          capability: request.capability,
          fromCache: true,
          costUsd: 0,
          durationMs: Date.now() - start,
        });
        return { ...cached, fromCache: true, durationMs: Date.now() - start };
      }
    }

    const ranked = this.router.rankCandidates(request);
    if (!ranked.length) {
      throw new Error(`No provider registered for capability "${request.capability}".`);
    }
    const estimate = buildEstimateReport({ selected: ranked[0], fallback: ranked[1] });

    const failoverEvents = [];
    const { result, providerId } = await executeWithFailover(ranked, {
      onProviderFailover: (from, to, err) => failoverEvents.push({ from, to, error: err.message }),
    });

    const response = {
      output: result.output,
      costUsd: result.costUsd ?? estimate.estimatedCostUsd,
      providerId,
      fromCache: false,
    };

    if (request.allowCache) {
      this.cache.set(request, response);
    }

    this.observability.record({
      type: 'capability_request',
      capability: request.capability,
      fromCache: false,
      providerId,
      costUsd: response.costUsd,
      durationMs: Date.now() - start,
      estimate,
      failoverEvents,
    });

    return { ...response, durationMs: Date.now() - start };
  }
}
