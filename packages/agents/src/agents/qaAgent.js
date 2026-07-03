/**
 * QA Agent — the final gate before export. Validates that every upstream deliverable actually has
 * content. "No asset should move to the next stage without passing its quality gate."
 * (docs/architecture/AGENT_ORCHESTRATOR.md)
 */
export function createQaAgent() {
  return {
    name: 'qa_agent',
    capabilities: ['quality_assurance'],
    async run(task, ctx) {
      const { upstream } = ctx;
      const issues = [];
      for (const [taskId, result] of Object.entries(upstream || {})) {
        const asset = result?.asset;
        if (asset && (!asset.content || (typeof asset.content === 'string' && !asset.content.trim()))) {
          issues.push(`Task ${taskId} produced an empty asset`);
        }
      }
      return { output: { passed: issues.length === 0, issues }, costUsd: 0 };
    },
  };
}
