/**
 * Caption Agent — writes short social copy + hashtags from the upstream script, and is also the
 * final step for video pipelines (captioning the finished video).
 */
import { createCapabilityRequest } from '@wcf/core';

export function createCaptionAgent() {
  return {
    name: 'caption_agent',
    capabilities: ['caption_writing'],
    async run(task, ctx) {
      const { intent, upstream } = ctx;
      const script = firstUpstreamValue(upstream, 'script');
      const response = await ctx.omniroute.request(
        createCapabilityRequest({
          brandId: intent.brandId,
          capability: 'summarize',
          input: { text: script || intent.goal },
        })
      );
      const hashtags = buildHashtags(intent);
      const caption = `${response.output} ${hashtags.join(' ')}`.trim();
      const isFinalForThisIntent = intent.outputTypes[0] === 'caption';
      return {
        output: { caption },
        costUsd: response.costUsd,
        asset: isFinalForThisIntent || intent.outputTypes[0] === 'video'
          ? {
              type: isFinalForThisIntent ? 'caption' : 'video_caption',
              platform: intent.platforms[0] || 'instagram',
              content: caption,
              metadata: { hashtags },
              providerId: 'caption_agent',
            }
          : undefined,
      };
    },
  };
}

function firstUpstreamValue(upstream, key) {
  for (const result of Object.values(upstream || {})) {
    if (result?.output?.[key]) return result.output[key];
  }
  return null;
}

function buildHashtags(intent) {
  const base = intent.brandId ? [`#${intent.brandId.replace(/-/g, '')}`] : [];
  return [...base, '#WiseContentFactory'];
}
