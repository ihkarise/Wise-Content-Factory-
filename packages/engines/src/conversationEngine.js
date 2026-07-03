/**
 * Conversation Engine — the front door of Wise Content Factory. Understands the user; never
 * generates content. See docs/architecture/CONVERSATION_ENGINE.md.
 *
 * v1 implementation is deliberately rule-based (fast, deterministic, zero-cost, fully testable
 * offline) rather than model-assisted. The extension point to route ambiguous classification
 * through OmniRoute's "analyze" capability is noted inline — swap it in without touching anything
 * downstream, since callers only ever see the returned Conversation Context shape.
 *
 * @typedef {Object} ConversationContext
 * @property {string} rawMessage
 * @property {string|null} brandId
 * @property {string|null} projectId
 * @property {string} goal
 * @property {string|null} audience
 * @property {string[]} platforms
 * @property {Array<{type: string, ref: string}>} uploadedAssets
 * @property {string[]} knowledgeSources
 * @property {Object} memorySnapshot
 * @property {'low'|'medium'|'high'} estimatedComplexity
 */

const PLATFORM_KEYWORDS = {
  instagram: /instagram|\bIG\b/i,
  linkedin: /linkedin/i,
  facebook: /facebook/i,
  youtube: /youtube/i,
  tiktok: /tiktok/i,
  email: /\bemail\b|newsletter/i,
  blog: /\bblog\b/i,
  website: /\bwebsite\b|landing page/i,
};

/**
 * @param {{
 *   message: string,
 *   brandMemory?: {brands?: Array<{id: string, name: string}>, activeBrandId?: string},
 *   projectMemory?: {activeProjectId?: string},
 *   conversationMemory?: Object,
 *   uploadedAssets?: Array<{type: string, ref: string}>,
 *   knowledgeSources?: string[],
 * }} params
 * @returns {ConversationContext}
 */
export function buildConversationContext(params) {
  const {
    message,
    brandMemory = {},
    projectMemory = {},
    conversationMemory = {},
    uploadedAssets = [],
    knowledgeSources = [],
  } = params;

  return {
    rawMessage: message,
    brandId: resolveBrandId(message, brandMemory),
    projectId: projectMemory.activeProjectId ?? null,
    goal: message.trim(),
    audience: extractAudience(message),
    platforms: extractPlatforms(message),
    uploadedAssets,
    knowledgeSources,
    memorySnapshot: { brandMemory, projectMemory, conversationMemory },
    estimatedComplexity: estimateComplexity(message, uploadedAssets),
  };
}

function resolveBrandId(message, brandMemory) {
  const brands = brandMemory.brands || [];
  const mentioned = brands.find((b) => new RegExp(escapeRegExp(b.name), 'i').test(message));
  if (mentioned) return mentioned.id;
  // Never re-ask for information already available in memory: if the user has exactly one
  // brand, or an active brand from a previous turn, infer it rather than asking again.
  if (brands.length === 1) return brands[0].id;
  return brandMemory.activeBrandId ?? null;
}

function extractAudience(message) {
  const match = message.match(/for ([a-zA-Z][a-zA-Z\s]{2,30}?)(?:\.|,|$)/i);
  return match ? match[1].trim() : null;
}

function extractPlatforms(message) {
  return Object.entries(PLATFORM_KEYWORDS)
    .filter(([, pattern]) => pattern.test(message))
    .map(([platform]) => platform);
}

function estimateComplexity(message, uploadedAssets) {
  const wordCount = message.split(/\s+/).filter(Boolean).length;
  if (uploadedAssets.length > 1 || wordCount > 60) return 'high';
  if (uploadedAssets.length === 1 || wordCount > 20) return 'medium';
  return 'low';
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
