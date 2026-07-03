/**
 * Prompt Agent — turns a script (or the raw goal, if there is no script yet) into a concrete
 * generation prompt for the Image/Video Agents.
 */
import { createCapabilityRequest } from '@wcf/core';

export function createPromptAgent() {
  return {
    name: 'prompt_agent',
    capabilities: ['prompt_writing'],
    async run(task, ctx) {
      const { intent, upstream } = ctx;
      const script = firstUpstreamValue(upstream, 'script');
      const response = await ctx.omniroute.request(
        createCapabilityRequest({
          brandId: intent.brandId,
          capability: 'generate_text',
          input: {
            prompt: `Write a single, vivid visual generation prompt (no more than 40 words) for: ${script || intent.goal}`,
          },
        })
      );
      return { output: { prompt: response.output, script }, costUsd: response.costUsd };
    },
  };
}

function firstUpstreamValue(upstream, key) {
  for (const result of Object.values(upstream || {})) {
    if (result?.output?.[key]) return result.output[key];
  }
  return null;
}
