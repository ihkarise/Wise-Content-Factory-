/**
 * Every provider must implement the same interface, matching docs/architecture/AI_INFRASTRUCTURE.md
 * ("Provider Categories" / "Plugin Integration") and docs/architecture/ARCHITECTURE.md ("Provider Rules":
 * "Every provider must implement the same interface... No business logic should depend on provider APIs.").
 *
 * This factory just fills defaults and fails fast if a required function is missing — it is not a
 * class hierarchy, so any object shape can be adapted into a provider with zero coupling.
 */

const REQUIRED_FUNCTIONS = ['estimateCostUsd', 'estimateDurationMs', 'execute'];

/**
 * @param {Partial<import('@wcf/infrastructure').ProviderAdapter>} fields
 * @returns {import('@wcf/infrastructure').ProviderAdapter}
 */
export function defineProvider(fields) {
  for (const fn of REQUIRED_FUNCTIONS) {
    if (typeof fields[fn] !== 'function') {
      throw new Error(`Provider "${fields.id ?? '(unnamed)'}" is missing required function "${fn}"`);
    }
  }
  return {
    id: fields.id,
    capabilities: fields.capabilities || [],
    tier: fields.tier || 'premium',
    healthStatus: fields.healthStatus ?? 'healthy',
    successRate: fields.successRate ?? 1,
    estimateCostUsd: fields.estimateCostUsd,
    estimateDurationMs: fields.estimateDurationMs,
    execute: fields.execute,
  };
}
