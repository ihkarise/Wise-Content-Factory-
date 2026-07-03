/**
 * Intent Object schema — the output of the Intent Engine and the input to the Strategy Engine.
 * See docs/architecture/INTENT_ENGINE.md.
 *
 * @typedef {'create_campaign'|'create_asset'|'explain'|'repurpose'|'answer_question'} PrimaryAction
 *
 * @typedef {Object} IntentObject
 * @property {string} id
 * @property {PrimaryAction} primaryAction
 * @property {string|null} brandId
 * @property {string|null} projectId
 * @property {string} goal
 * @property {string|null} audience
 * @property {string[]} outputTypes
 * @property {string[]} platforms
 * @property {string[]} knowledgeSources
 * @property {{budget: (string|null), deadline: (string|null), qualityLevel: string}} constraints
 * @property {Object<string, number>} confidence  Per-field confidence score 0-1.
 * @property {number} overallConfidence
 * @property {string[]} missingRequiredFields
 * @property {IntentObject[]} relatedIntents  Populated when a compound request is split.
 */

const REQUIRED_FIELDS = ['primaryAction', 'brandId', 'goal', 'outputTypes'];
const QUALITY_LEVELS = ['economy', 'balanced', 'professional', 'premium', 'enterprise'];

let counter = 0;
function nextId(prefix) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

/**
 * @param {Partial<IntentObject>} fields
 * @returns {IntentObject}
 */
export function createIntentObject(fields = {}) {
  const intent = {
    id: fields.id || nextId('intent'),
    primaryAction: fields.primaryAction || 'create_asset',
    brandId: fields.brandId ?? null,
    projectId: fields.projectId ?? null,
    goal: fields.goal || '',
    audience: fields.audience ?? null,
    outputTypes: fields.outputTypes || [],
    platforms: fields.platforms || [],
    knowledgeSources: fields.knowledgeSources || [],
    constraints: {
      budget: fields.constraints?.budget ?? null,
      deadline: fields.constraints?.deadline ?? null,
      qualityLevel: fields.constraints?.qualityLevel || 'balanced',
    },
    confidence: fields.confidence || {},
    overallConfidence: fields.overallConfidence ?? 0,
    missingRequiredFields: fields.missingRequiredFields || [],
    relatedIntents: fields.relatedIntents || [],
  };
  intent.missingRequiredFields = computeMissingRequiredFields(intent);
  intent.overallConfidence = computeOverallConfidence(intent);
  return intent;
}

function computeMissingRequiredFields(intent) {
  return REQUIRED_FIELDS.filter((field) => {
    const value = intent[field];
    if (Array.isArray(value)) return value.length === 0;
    return value === null || value === undefined || value === '';
  });
}

function computeOverallConfidence(intent) {
  const scores = Object.values(intent.confidence);
  if (scores.length === 0) return intent.missingRequiredFields.length === 0 ? 1 : 0;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/**
 * @param {IntentObject} intent
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateIntentObject(intent) {
  const errors = [];
  if (!intent || typeof intent !== 'object') return { valid: false, errors: ['Intent object is required'] };
  if (!intent.id) errors.push('id is required');
  if (!intent.goal) errors.push('goal is required');
  if (!Array.isArray(intent.outputTypes)) errors.push('outputTypes must be an array');
  if (intent.constraints && !QUALITY_LEVELS.includes(intent.constraints.qualityLevel)) {
    errors.push(`constraints.qualityLevel must be one of: ${QUALITY_LEVELS.join(', ')}`);
  }
  return { valid: errors.length === 0, errors };
}

export const INTENT_REQUIRED_FIELDS = REQUIRED_FIELDS;
export const INTENT_QUALITY_LEVELS = QUALITY_LEVELS;
