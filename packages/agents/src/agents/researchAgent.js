/**
 * Research Agent — gathers grounding context before generation. Prefers a connected MCP
 * knowledge server (e.g. NotebookLM); never blocks generation if none is available, it just flags
 * the output as ungrounded. See docs/architecture/KNOWLEDGE_ENGINE.md.
 */
import { createCapabilityRequest } from '@wcf/core';

export function createResearchAgent() {
  return {
    name: 'research_agent',
    capabilities: ['research'],
    async run(task, ctx) {
      const { intent, mcpManager } = ctx;
      const query = intent.goal;
      if (mcpManager && mcpManager.getServersForCapability('knowledge_retrieval').length) {
        const notes = await mcpManager.callTool('knowledge_retrieval', 'search', { query });
        return { output: { notes, grounded: true }, costUsd: 0 };
      }
      const response = await ctx.omniroute.request(
        createCapabilityRequest({
          capability: 'reason',
          input: { question: query, context: 'No knowledge source is connected; reason from general context only.' },
        })
      );
      return { output: { notes: response.output, grounded: false }, costUsd: response.costUsd };
    },
  };
}
