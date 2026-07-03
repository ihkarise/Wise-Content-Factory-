/**
 * Strategy Engine — the master planner. Turns an Intent Object into an Execution Plan Object for
 * the Agent Orchestrator. "The Strategy Engine does not generate content. It does not call AI
 * models." (docs/architecture/STRATEGY_ENGINE.md) — every estimate below is a static planning
 * heuristic, not a live provider quote; live pricing is the Infrastructure layer's concern.
 */

import { createExecutionPlan, createPlannedTask } from '@wcf/core';

// agentCapability names here are planning-level capabilities (what kind of Agent is needed),
// distinct from the AI Infrastructure's CapabilityRequest.capability enum — an Agent internally
// translates one of these into one or more OmniRoute capability requests. See packages/agents.
const OUTPUT_TYPE_PIPELINES = {
  blog_post: ['script_writing', 'seo_optimization', 'quality_assurance'],
  caption: ['script_writing', 'caption_writing', 'quality_assurance'],
  email: ['script_writing', 'quality_assurance'],
  image: ['prompt_writing', 'image_generation', 'quality_assurance'],
  video: ['script_writing', 'storyboarding', 'video_generation', 'caption_writing', 'quality_assurance'],
  carousel: ['script_writing', 'prompt_writing', 'image_generation', 'quality_assurance'],
  podcast: ['script_writing', 'voice_generation', 'quality_assurance'],
  presentation: ['script_writing', 'storyboarding', 'quality_assurance'],
};

// Rough planning-level cost/duration per capability step (USD / ms). Not billing-accurate —
// real cost comes from the Infrastructure layer's Cost Optimizer once tasks actually execute.
const COST_USD = {
  research: 0.01, script_writing: 0.02, seo_optimization: 0.01, caption_writing: 0.005,
  prompt_writing: 0.005, image_generation: 0.04, video_generation: 0.5, voice_generation: 0.1,
  storyboarding: 0.01, quality_assurance: 0.005,
};
const DURATION_MS = {
  research: 4000, script_writing: 3000, seo_optimization: 1500, caption_writing: 1000,
  prompt_writing: 1000, image_generation: 8000, video_generation: 30000, voice_generation: 6000,
  storyboarding: 2000, quality_assurance: 1500,
};

const REQUIRES_KNOWLEDGE_MCP = ['research'];

/**
 * @param {import('@wcf/core').IntentObject} intent
 * @returns {import('@wcf/core').ExecutionPlanObject}
 */
export function planExecution(intent) {
  const leaves = intent.relatedIntents.length ? intent.relatedIntents : [intent];
  const needsResearch = leaves.some((leaf) => shouldResearch(leaf));

  const tasks = [];
  let researchTaskId = null;
  if (needsResearch) {
    // Shared across every leaf, so it belongs to no single leaf intent (sourceIntentId stays null
    // and Agents fall back to the parent intent — research doesn't need a specific output type).
    const researchTask = buildTask('research', [], null);
    tasks.push(researchTask);
    researchTaskId = researchTask.id;
  }

  const qaTaskIds = [];
  for (const leaf of leaves) {
    for (const outputType of leaf.outputTypes) {
      const pipeline = OUTPUT_TYPE_PIPELINES[outputType] || OUTPUT_TYPE_PIPELINES.blog_post;
      let previousId = researchTaskId ? researchTaskId : null;
      for (const capability of pipeline) {
        const task = buildTask(capability, previousId ? [previousId] : [], leaf.id);
        tasks.push(task);
        previousId = task.id;
        if (capability === 'quality_assurance') qaTaskIds.push(task.id);
      }
    }
  }

  return createExecutionPlan({
    intentId: intent.id,
    brandId: intent.brandId,
    projectId: intent.projectId,
    workflow: workflowNameFor(intent),
    qualityLevel: intent.constraints.qualityLevel,
    tasks,
    requiredMcp: needsResearch ? ['notebooklm', 'filesystem'] : [],
    exportFormats: leaves.flatMap((l) => l.outputTypes),
    fallbackWorkflow: 'single_asset',
  });
}

function shouldResearch(intent) {
  return intent.primaryAction === 'explain' || intent.knowledgeSources.length > 0;
}

let counter = 0;
function buildTask(agentCapability, dependsOn, sourceIntentId) {
  counter += 1;
  return createPlannedTask({
    id: `${agentCapability}_${counter}`,
    agentCapability,
    dependsOn,
    priority: dependsOn.length === 0 ? 10 : 5,
    estimatedCostUsd: COST_USD[agentCapability] ?? 0.01,
    estimatedDurationMs: DURATION_MS[agentCapability] ?? 2000,
    sourceIntentId,
  });
}

function workflowNameFor(intent) {
  if (intent.primaryAction === 'create_campaign') return 'marketing_campaign';
  if (intent.primaryAction === 'explain') return 'educational_campaign';
  if (intent.primaryAction === 'repurpose') return 'repurposing';
  if (intent.primaryAction === 'answer_question') return 'research_summary';
  return 'single_asset';
}

export const STRATEGY_OUTPUT_TYPE_PIPELINES = OUTPUT_TYPE_PIPELINES;
export const STRATEGY_MCP_CAPABILITIES = REQUIRES_KNOWLEDGE_MCP;
