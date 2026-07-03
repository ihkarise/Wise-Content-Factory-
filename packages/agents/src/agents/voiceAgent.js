/**
 * Voice Agent — produces the audio asset (podcast narration) from the upstream script.
 */
import { createCapabilityRequest } from '@wcf/core';

export function createVoiceAgent() {
  return {
    name: 'voice_agent',
    capabilities: ['voice_generation'],
    async run(task, ctx) {
      const { intent, upstream } = ctx;
      const script = firstUpstreamValue(upstream, 'script');
      const response = await ctx.omniroute.request(
        createCapabilityRequest({
          brandId: intent.brandId,
          capability: 'generate_speech',
          input: { prompt: script || intent.goal },
        })
      );
      return {
        output: { audio: response.output },
        costUsd: response.costUsd,
        asset: {
          type: 'podcast',
          platform: intent.platforms[0] || 'generic',
          content: response.output,
          metadata: {},
          providerId: 'voice_agent',
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
