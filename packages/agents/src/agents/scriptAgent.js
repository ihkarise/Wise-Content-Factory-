/**
 * Script Agent — writes the core copy every downstream asset (blog post, caption, storyboard,
 * voiceover) is built from.
 */
import { createCapabilityRequest } from '@wcf/core';

export function createScriptAgent() {
  return {
    name: 'script_agent',
    capabilities: ['script_writing'],
    async run(task, ctx) {
      const { intent, upstream } = ctx;
      const researchNotes = firstUpstreamOutput(upstream)?.notes;
      const response = await ctx.omniroute.request(
        createCapabilityRequest({
          brandId: intent.brandId,
          capability: 'generate_text',
          input: {
            prompt: intent.goal,
            audience: intent.audience,
            tone: 'professional, warm',
            context: researchNotes,
          },
          qualityLevel: intent.constraints.qualityLevel,
        })
      );
      return {
        output: { script: response.output },
        costUsd: response.costUsd,
      };
    },
  };
}

function firstUpstreamOutput(upstream) {
  const values = Object.values(upstream || {});
  return values[0]?.output;
}
