/**
 * Integration tests exercising real scenarios from docs/architecture/EXAMPLES.md end-to-end
 * through the full pipeline: Conversation Engine -> Intent Engine -> Strategy Engine ->
 * Agent Orchestrator -> Content Package. EXAMPLES.md frames these as acceptance criteria, not
 * demonstrations — "If the software cannot complete these examples successfully, the feature
 * should not be considered complete."
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConversationContext, resolveIntent, planExecution } from '@wcf/engines';
import { OmniRoute, McpManager } from '@wcf/infrastructure';
import { createMockTextProvider, createMockMediaProvider } from '@wcf/providers';
import { AgentOrchestrator, registerCoreAgents } from '@wcf/agents';

const BRAND_MEMORY = {
  brands: [
    { id: 'wise-homeopathy', name: 'Wise Homeopathy' },
    { id: 'wiseaitechs', name: 'WiseAitechs' },
    { id: 'pillfill', name: 'PillFill' },
  ],
};

function buildOrchestrator({ mcpManager } = {}) {
  const omniroute = new OmniRoute();
  omniroute.registerProvider(createMockTextProvider());
  omniroute.registerProvider(createMockMediaProvider());
  return registerCoreAgents(new AgentOrchestrator({ omniroute, mcpManager }));
}

// EXAMPLES.md, Example 1: "PillFill Product Advertisement" — "Promote PillFill for pharmacy owners."
test('Example 1 — PillFill product advertisement produces a passing content package', async () => {
  const context = buildConversationContext({ message: 'Promote PillFill for pharmacy owners.', brandMemory: BRAND_MEMORY });
  assert.equal(context.brandId, 'pillfill');

  const intent = resolveIntent(context);
  assert.equal(intent.missingRequiredFields.length, 0, 'brand/goal/action/outputTypes should all resolve without asking the user anything');

  const plan = planExecution(intent);
  const orchestrator = buildOrchestrator();
  const run = await orchestrator.runPlan(plan, { intent });

  assert.equal(run.failed, 0, JSON.stringify(run.taskErrors));
  assert.equal(run.contentPackage.qaStatus, 'passed');
  assert.ok(run.contentPackage.assets.length >= 1);
});

// EXAMPLES.md, Example 2: "Wise Homeopathy Educational Campaign" — "Explain allergic rhinitis for
// patients," grounded via a NotebookLM knowledge source. Success criteria: "Grounded in provided
// knowledge" — verified here by asserting the Research Agent actually used the connected MCP
// server rather than falling back to ungrounded reasoning.
test('Example 2 — Wise Homeopathy educational campaign grounds its research through the connected knowledge MCP server', async () => {
  const mcpManager = new McpManager();
  let queried = null;
  mcpManager.registerServer({
    name: 'notebooklm',
    capabilities: ['knowledge_retrieval'],
    tools: ['search'],
    callTool: async (tool, args) => {
      queried = args.query;
      return 'Allergic rhinitis is an inflammatory condition triggered by allergens such as pollen and dust.';
    },
  });

  // The message itself doesn't name a brand, so this only resolves without a clarification
  // question because the user is already working inside the Wise Homeopathy project (an active
  // brand from memory) — matching CONVERSATION_ENGINE.md's "never re-ask for information already
  // available in memory."
  const context = buildConversationContext({
    message: 'Explain allergic rhinitis for patients.',
    brandMemory: { ...BRAND_MEMORY, activeBrandId: 'wise-homeopathy' },
    knowledgeSources: ['notebooklm://wise-homeopathy-clinical-notes'],
  });
  assert.equal(context.brandId, 'wise-homeopathy');

  const intent = resolveIntent(context);
  assert.equal(intent.primaryAction, 'explain');

  const plan = planExecution(intent);
  assert.ok(plan.tasks.some((t) => t.agentCapability === 'research'), 'an educational request must include a research task');

  const orchestrator = buildOrchestrator({ mcpManager });
  const run = await orchestrator.runPlan(plan, { intent });

  assert.equal(run.failed, 0, JSON.stringify(run.taskErrors));
  assert.equal(run.contentPackage.qaStatus, 'passed');
  assert.ok(queried, 'the Research Agent should have queried the connected knowledge MCP server');
  assert.match(queried, /allergic rhinitis/i);
});

// EXAMPLES.md's own "Acceptance Tests" checklist item: "Multiple brands remain isolated."
test('Brand isolation — the same message routed to two different brands never leaks state between them', async () => {
  const orchestrator = buildOrchestrator();

  const pillfillContext = buildConversationContext({ message: 'Create a blog post.', brandMemory: { ...BRAND_MEMORY, activeBrandId: 'pillfill' } });
  const pillfillIntent = resolveIntent(pillfillContext);
  const pillfillRun = await orchestrator.runPlan(planExecution(pillfillIntent), { intent: pillfillIntent });

  const homeopathyContext = buildConversationContext({ message: 'Create a blog post.', brandMemory: { ...BRAND_MEMORY, activeBrandId: 'wise-homeopathy' } });
  const homeopathyIntent = resolveIntent(homeopathyContext);
  const homeopathyRun = await orchestrator.runPlan(planExecution(homeopathyIntent), { intent: homeopathyIntent });

  assert.equal(pillfillRun.contentPackage.brandId, 'pillfill');
  assert.equal(homeopathyRun.contentPackage.brandId, 'wise-homeopathy');
  assert.notEqual(pillfillRun.contentPackage.id, homeopathyRun.contentPackage.id);
});
