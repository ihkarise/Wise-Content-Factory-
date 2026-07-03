/**
 * Agent Registry Entry schema — how an Agent self-registers with the Agent Orchestrator.
 * See docs/architecture/AGENT_ORCHESTRATOR.md.
 *
 * @typedef {Object} AgentRegistryEntry
 * @property {string} name
 * @property {string[]} capabilities        Capability names this agent fulfills (see capabilityRequest.js).
 * @property {string[]} consumes            Input types this agent accepts.
 * @property {string[]} produces            Output types this agent produces.
 * @property {string[]} dependencies        Other capability names this agent's tasks typically depend on.
 * @property {number} averageDurationMs
 * @property {number} averageCostUsd
 * @property {number} priority
 * @property {string} healthStatus          "healthy" | "degraded" | "unavailable"
 */

/**
 * @param {Partial<AgentRegistryEntry>} fields
 * @returns {AgentRegistryEntry}
 */
export function createAgentRegistryEntry(fields = {}) {
  return {
    name: fields.name || 'unnamed_agent',
    capabilities: fields.capabilities || [],
    consumes: fields.consumes || [],
    produces: fields.produces || [],
    dependencies: fields.dependencies || [],
    averageDurationMs: fields.averageDurationMs ?? 0,
    averageCostUsd: fields.averageCostUsd ?? 0,
    priority: fields.priority ?? 0,
    healthStatus: fields.healthStatus || 'healthy',
  };
}
