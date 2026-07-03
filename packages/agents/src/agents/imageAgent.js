/**
 * Image Agent — produces the final image/carousel asset from an upstream prompt.
 */
import { createCapabilityRequest } from '@wcf/core';

export function createImageAgent() {
  return {
    name: 'image_agent',
    capabilities: ['image_generation'],
    async run(task, ctx) {
      const { intent, upstream } = ctx;
      const prompt = firstUpstreamValue(upstream, 'prompt') || intent.goal;
      const response = await ctx.omniroute.request(
        createCapabilityRequest({
          brandId: intent.brandId,
          capability: 'generate_image',
          input: { prompt },
        })
      );
      return {
        output: { image: response.output },
        costUsd: response.costUsd,
        asset: {
          type: intent.outputTypes[0] || 'image',
          platform: intent.platforms[0] || 'generic',
          content: response.output,
          metadata: { prompt },
          providerId: 'image_agent',
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
