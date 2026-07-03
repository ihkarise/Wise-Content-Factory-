/**
 * Intent Engine — resolves a Conversation Context into one or more structured Intent Objects.
 * See docs/architecture/INTENT_ENGINE.md. Entry point of the Decision layer.
 */

import { createIntentObject, INTENT_REQUIRED_FIELDS } from '@wcf/core';

const OUTPUT_TYPE_KEYWORDS = {
  video: /\bvideo\b|\breel\b|\bshort[- ]form\b/i,
  blog_post: /\bblog\b|\barticle\b/i,
  image: /\bimage\b|\bthumbnail\b|\bgraphic\b/i,
  carousel: /\bcarousel\b/i,
  email: /\bemail\b|\bnewsletter\b/i,
  podcast: /\bpodcast\b/i,
  presentation: /\bpresentation\b|\bslides?\b/i,
  caption: /\bcaption\b|\bsocial post\b/i,
};

/**
 * @param {import('./conversationEngine.js').ConversationContext} context
 * @returns {import('@wcf/core').IntentObject}
 */
export function resolveIntent(context) {
  const message = context.rawMessage;
  const outputTypes = detectOutputTypes(message);
  const primaryAction = detectPrimaryAction(message, outputTypes);

  const confidence = {
    brandId: context.brandId ? 0.9 : 0.2,
    goal: 1,
    outputTypes: outputTypes.length ? 0.8 : 0.3,
    primaryAction: 0.85,
  };

  const intent = createIntentObject({
    primaryAction,
    brandId: context.brandId,
    projectId: context.projectId,
    goal: message,
    audience: context.audience,
    outputTypes: outputTypes.length ? outputTypes : defaultOutputTypesFor(primaryAction),
    platforms: context.platforms,
    knowledgeSources: context.knowledgeSources,
    confidence,
  });

  intent.relatedIntents = splitCompoundIntent(intent);
  return intent;
}

function detectOutputTypes(message) {
  return Object.entries(OUTPUT_TYPE_KEYWORDS)
    .filter(([, pattern]) => pattern.test(message))
    .map(([type]) => type);
}

/**
 * When the message names no explicit output type, fall back to a sensible default deliverable so
 * the Strategy Engine always has something to plan — an "explain" or "create_asset" request
 * without a stated format still needs to produce *something*. A bare question needs no content
 * pipeline at all, so it gets no default.
 */
function defaultOutputTypesFor(primaryAction) {
  switch (primaryAction) {
    case 'create_asset':
    case 'explain':
    case 'repurpose':
      return ['blog_post'];
    case 'create_campaign':
      return ['blog_post', 'caption'];
    default:
      return [];
  }
}

function detectPrimaryAction(message, outputTypes) {
  if (/turn (this|it) into|repurpose|convert (this|it)/i.test(message)) return 'repurpose';
  if (/^\s*(explain|what is|what are|describe)\b/i.test(message)) return 'explain';
  if (outputTypes.length === 0 && /\?\s*$/.test(message.trim())) return 'answer_question';
  if (outputTypes.length > 1 || /\bcampaign\b/i.test(message)) return 'create_campaign';
  return 'create_asset';
}

/**
 * A compound request ("make a video and a blog post") should never silently drop a requested
 * output. When more than one output type is detected under a create_campaign action, split into
 * one related Intent Object per output type so the Strategy Engine can plan (and cost) each
 * deliverable explicitly, while the parent Intent Object still represents the whole campaign.
 * @param {import('@wcf/core').IntentObject} intent
 */
function splitCompoundIntent(intent) {
  if (intent.primaryAction !== 'create_campaign' || intent.outputTypes.length <= 1) return [];
  return intent.outputTypes.map((outputType) =>
    createIntentObject({
      primaryAction: 'create_asset',
      brandId: intent.brandId,
      projectId: intent.projectId,
      goal: intent.goal,
      audience: intent.audience,
      outputTypes: [outputType],
      platforms: intent.platforms,
      knowledgeSources: intent.knowledgeSources,
      confidence: intent.confidence,
    })
  );
}

export const INTENT_ENGINE_REQUIRED_FIELDS = INTENT_REQUIRED_FIELDS;
