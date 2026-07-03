/**
 * Video Agent — produces the video asset from the upstream storyboard.
 */
import { createCapabilityRequest } from '@wcf/core';

export function createVideoAgent() {
  return {
    name: 'video_agent',
    capabilities: ['video_generation'],
    async run(task, ctx) {
      const { intent, upstream } = ctx;
      const scenes = firstUpstreamValue(upstream, 'scenes') || [];
      const script = firstUpstreamValue(upstream, 'script');
      const response = await ctx.omniroute.request(
        createCapabilityRequest({
          brandId: intent.brandId,
          capability: 'generate_video',
          input: { prompt: script || intent.goal, scenes },
        })
      );
      return {
        output: { video: response.output, script },
        costUsd: response.costUsd,
        asset: {
          type: 'video',
          platform: intent.platforms[0] || 'generic',
          content: response.output,
          metadata: { sceneCount: scenes.length },
          providerId: 'video_agent',
        },
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
