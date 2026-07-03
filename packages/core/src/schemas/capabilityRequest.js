/**
 * Capability Request schema — the only object Agents/Engines are allowed to hand to AI Infrastructure.
 * Callers request a capability ("generate_text"), never a specific provider ("call Claude").
 * See docs/architecture/AI_INFRASTRUCTURE.md and docs/architecture/OMNIROUTE_INTEGRATION.md.
 *
 * @typedef {'generate_text'|'generate_image'|'generate_video'|'generate_speech'|'summarize'|
 *           'translate'|'reason'|'analyze'|'search_knowledge'|'create_storyboard'|'generate_thumbnail'}
 *          Capability
 *
 * @typedef {Object} CapabilityRequest
 * @property {string} id
 * @property {Capability} capability
 * @property {Object} input
 * @property {string|null} brandId
 * @property {string|null} projectId
 * @property {string} qualityLevel
 * @property {number|null} maxCostUsd
 * @property {string|null} preferredProvider
 * @property {boolean} allowCache
 */

let counter = 0;
function nextId(prefix) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export const CAPABILITIES = [
  'generate_text',
  'generate_image',
  'generate_video',
  'generate_speech',
  'summarize',
  'translate',
  'reason',
  'analyze',
  'search_knowledge',
  'create_storyboard',
  'generate_thumbnail',
];

/**
 * @param {Partial<CapabilityRequest>} fields
 * @returns {CapabilityRequest}
 */
export function createCapabilityRequest(fields = {}) {
  return {
    id: fields.id || nextId('cap'),
    capability: fields.capability || 'generate_text',
    input: fields.input || {},
    brandId: fields.brandId ?? null,
    projectId: fields.projectId ?? null,
    qualityLevel: fields.qualityLevel || 'balanced',
    maxCostUsd: fields.maxCostUsd ?? null,
    preferredProvider: fields.preferredProvider ?? null,
    allowCache: fields.allowCache ?? true,
  };
}

/**
 * @param {CapabilityRequest} request
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateCapabilityRequest(request) {
  const errors = [];
  if (!request || typeof request !== 'object') return { valid: false, errors: ['Capability request is required'] };
  if (!CAPABILITIES.includes(request.capability)) {
    errors.push(`capability must be one of: ${CAPABILITIES.join(', ')}`);
  }
  if (!request.input || typeof request.input !== 'object') errors.push('input is required');
  return { valid: errors.length === 0, errors };
}
