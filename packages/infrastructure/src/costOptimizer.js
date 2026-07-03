/**
 * Cost Optimizer — enforces the platform-wide priority order defined in every architecture
 * document (PRODUCT.md, ARCHITECTURE.md, AI_INFRASTRUCTURE.md, OMNIROUTE_INTEGRATION.md, CLAUDE.md):
 *
 *   Cache -> Local models -> Browser capability -> Free providers -> Low-cost providers -> Premium providers
 *
 * This module never talks to providers directly — it only ranks/estimates.
 */

export const COST_TIERS = ['local', 'browser', 'free', 'low_cost', 'premium'];

/**
 * @param {string} tier
 * @returns {number} Lower is preferred.
 */
export function tierRank(tier) {
  const index = COST_TIERS.indexOf(tier);
  return index === -1 ? COST_TIERS.length : index;
}

/**
 * Sort providers so the cheapest acceptable tier is tried first, then by lowest estimated cost
 * within a tier, then by highest historical success rate.
 * @param {Array<{tier: string, estimateUsd: number, successRate?: number}>} candidates
 */
export function rankProviders(candidates) {
  return [...candidates].sort((a, b) => {
    const tierDiff = tierRank(a.tier) - tierRank(b.tier);
    if (tierDiff !== 0) return tierDiff;
    const costDiff = (a.estimateUsd ?? 0) - (b.estimateUsd ?? 0);
    if (costDiff !== 0) return costDiff;
    return (b.successRate ?? 1) - (a.successRate ?? 1);
  });
}

/**
 * @param {{maxCostUsd?: number|null}} request
 * @param {{estimateUsd: number}} candidate
 */
export function withinBudget(request, candidate) {
  if (request.maxCostUsd == null) return true;
  return candidate.estimateUsd <= request.maxCostUsd;
}

/**
 * Rough duration+cost estimate report attached to every routed request for observability,
 * matching "every AI request should include: estimated cost, estimated duration, selected
 * provider, fallback provider, reason for selection" (ARCHITECTURE.md, "Cost Optimization").
 */
export function buildEstimateReport({ selected, fallback, reason }) {
  return {
    selectedProviderId: selected?.id ?? null,
    estimatedCostUsd: selected?.estimateUsd ?? 0,
    estimatedDurationMs: selected?.estimateDurationMs ?? 0,
    fallbackProviderId: fallback?.id ?? null,
    reason: reason || 'lowest-cost-tier-within-budget',
  };
}
