/**
 * Storyboard Agent — breaks the script into ordered scenes for the Video Agent.
 */
import { createCapabilityRequest } from '@wcf/core';

export function createStoryboardAgent() {
  return {
    name: 'storyboard_agent',
    capabilities: ['storyboarding'],
    async run(task, ctx) {
      const { upstream } = ctx;
      const script = firstUpstreamValue(upstream, 'script');
      const response = await ctx.omniroute.request(
        createCapabilityRequest({
          capability: 'create_storyboard',
          input: { script: script || '' },
        })
      );
      return { output: { scenes: response.output.scenes, script }, costUsd: response.costUsd };
    },
  };
}

function firstUpstreamValue(upstream, key) {
  for (const result of Object.values(upstream || {})) {
    if (result?.output?.[key]) return result.output[key];
  }
  return null;
}
