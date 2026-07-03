/**
 * Runnable demo of the full pipeline, entirely offline and free (mock providers). Run with:
 *   npm run example
 * This is EXAMPLES.md's Example 1 ("PillFill Product Advertisement") end to end.
 */
import { buildConversationContext, resolveIntent, planExecution } from '@wcf/engines';
import { OmniRoute } from '@wcf/infrastructure';
import { createMockTextProvider, createMockMediaProvider } from '@wcf/providers';
import { AgentOrchestrator, registerCoreAgents } from '@wcf/agents';

const BRAND_MEMORY = {
  brands: [
    { id: 'wise-homeopathy', name: 'Wise Homeopathy' },
    { id: 'wiseaitechs', name: 'WiseAitechs' },
    { id: 'pillfill', name: 'PillFill' },
  ],
};

async function main() {
  const message = process.argv[2] || 'Promote PillFill for pharmacy owners.';
  console.log(`\nUser: "${message}"\n`);

  const context = buildConversationContext({ message, brandMemory: BRAND_MEMORY });
  console.log('Conversation Context:', { brandId: context.brandId, platforms: context.platforms, complexity: context.estimatedComplexity });

  const intent = resolveIntent(context);
  console.log('\nIntent:', { primaryAction: intent.primaryAction, outputTypes: intent.outputTypes, missingRequiredFields: intent.missingRequiredFields });

  if (intent.missingRequiredFields.length) {
    console.log('\nStopping — the platform would ask the user to clarify:', intent.missingRequiredFields.join(', '));
    return;
  }

  const plan = planExecution(intent);
  console.log(`\nExecution Plan (workflow: ${plan.workflow}, est. cost: $${plan.estimatedCostUsd.toFixed(4)}, est. time: ${plan.estimatedDurationMs}ms):`);
  for (const task of plan.tasks) console.log(`  - ${task.agentCapability} (depends on: ${task.dependsOn.join(', ') || 'none'})`);

  const omniroute = new OmniRoute();
  omniroute.registerProvider(createMockTextProvider());
  omniroute.registerProvider(createMockMediaProvider());
  const orchestrator = registerCoreAgents(new AgentOrchestrator({ omniroute }));

  const run = await orchestrator.runPlan(plan, { intent });
  console.log(`\nRun result: ${run.completed} completed, ${run.failed} failed, ${run.skipped} skipped.`);
  console.log(`Content Package (QA: ${run.contentPackage.qaStatus}, actual cost: $${run.contentPackage.cost.actualUsd.toFixed(4)}):\n`);
  for (const asset of run.contentPackage.assets) {
    console.log(`--- ${asset.type} (${asset.platform}) ---`);
    console.log(typeof asset.content === 'string' ? asset.content : JSON.stringify(asset.content, null, 2));
    console.log();
  }
}

main().catch((err) => {
  console.error('Example failed:', err);
  process.exitCode = 1;
});
