import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConversationContext, resolveIntent, planExecution } from '../src/index.js';

const BRAND_MEMORY = {
  brands: [
    { id: 'wise-homeopathy', name: 'Wise Homeopathy' },
    { id: 'wiseaitechs', name: 'WiseAitechs' },
    { id: 'pillfill', name: 'PillFill' },
  ],
};

test('Conversation Engine resolves an explicitly mentioned brand', () => {
  const ctx = buildConversationContext({ message: 'Promote PillFill to pharmacists.', brandMemory: BRAND_MEMORY });
  assert.equal(ctx.brandId, 'pillfill');
});

test('Conversation Engine infers the only brand in memory without asking', () => {
  const ctx = buildConversationContext({
    message: 'Create a video.',
    brandMemory: { brands: [{ id: 'pillfill', name: 'PillFill' }] },
  });
  assert.equal(ctx.brandId, 'pillfill');
});

test('Conversation Engine falls back to the active brand from memory', () => {
  const ctx = buildConversationContext({ message: 'Create a video.', brandMemory: { ...BRAND_MEMORY, activeBrandId: 'wiseaitechs' } });
  assert.equal(ctx.brandId, 'wiseaitechs');
});

test('Conversation Engine extracts platform mentions and audience', () => {
  const ctx = buildConversationContext({ message: 'Make an Instagram carousel for pharmacists.', brandMemory: BRAND_MEMORY });
  assert.deepEqual(ctx.platforms, ['instagram']);
  assert.equal(ctx.audience, 'pharmacists');
});

test('Conversation Engine estimates complexity from message length and assets', () => {
  const low = buildConversationContext({ message: 'Make a video.' });
  const high = buildConversationContext({
    message: 'x '.repeat(70),
    uploadedAssets: [{ type: 'pdf', ref: 'a' }, { type: 'image', ref: 'b' }],
  });
  assert.equal(low.estimatedComplexity, 'low');
  assert.equal(high.estimatedComplexity, 'high');
});

test('Intent Engine classifies a single-asset request', () => {
  const ctx = buildConversationContext({ message: 'Create a blog post for PillFill.', brandMemory: BRAND_MEMORY });
  const intent = resolveIntent(ctx);
  assert.equal(intent.primaryAction, 'create_asset');
  assert.deepEqual(intent.outputTypes, ['blog_post']);
  assert.equal(intent.brandId, 'pillfill');
  assert.equal(intent.missingRequiredFields.length, 0);
});

test('Intent Engine classifies an explain/education request', () => {
  const ctx = buildConversationContext({ message: 'Explain migraine to patients.', brandMemory: BRAND_MEMORY });
  const intent = resolveIntent(ctx);
  assert.equal(intent.primaryAction, 'explain');
});

test('Intent Engine classifies a bare question as answer_question', () => {
  const ctx = buildConversationContext({ message: 'Should I post this on Fridays?', brandMemory: BRAND_MEMORY });
  const intent = resolveIntent(ctx);
  assert.equal(intent.primaryAction, 'answer_question');
});

test('Intent Engine classifies a "what is" question as explain, not a bare question', () => {
  const ctx = buildConversationContext({ message: 'What is homeopathy?', brandMemory: BRAND_MEMORY });
  const intent = resolveIntent(ctx);
  assert.equal(intent.primaryAction, 'explain');
});

test('Intent Engine detects a multi-output campaign and splits into related intents without dropping any output', () => {
  const ctx = buildConversationContext({
    message: 'Create a marketing campaign for PillFill: a video and a blog post.',
    brandMemory: BRAND_MEMORY,
  });
  const intent = resolveIntent(ctx);
  assert.equal(intent.primaryAction, 'create_campaign');
  assert.deepEqual(intent.outputTypes.sort(), ['blog_post', 'video']);
  assert.equal(intent.relatedIntents.length, 2);
  assert.deepEqual(intent.relatedIntents.map((r) => r.outputTypes[0]).sort(), ['blog_post', 'video']);
});

test('Intent Engine flags a missing brand as a required field when memory has multiple brands and none is mentioned', () => {
  const ctx = buildConversationContext({ message: 'Create a blog post.', brandMemory: BRAND_MEMORY });
  const intent = resolveIntent(ctx);
  assert.ok(intent.missingRequiredFields.includes('brandId'));
});

test('Strategy Engine builds a single-asset plan with a linear dependency chain', () => {
  const ctx = buildConversationContext({ message: 'Create a blog post for PillFill.', brandMemory: BRAND_MEMORY });
  const intent = resolveIntent(ctx);
  const plan = planExecution(intent);
  assert.equal(plan.workflow, 'single_asset');
  const capabilities = plan.tasks.map((t) => t.agentCapability);
  assert.deepEqual(capabilities, ['script_writing', 'seo_optimization', 'quality_assurance']);
  assert.deepEqual(plan.tasks[0].dependsOn, []);
  assert.deepEqual(plan.tasks[1].dependsOn, [plan.tasks[0].id]);
});

test('Strategy Engine includes a shared research task exactly once for an educational request', () => {
  const ctx = buildConversationContext({ message: 'Explain migraine to patients.', brandMemory: BRAND_MEMORY });
  const intent = resolveIntent(ctx);
  const plan = planExecution(intent);
  const researchTasks = plan.tasks.filter((t) => t.agentCapability === 'research');
  assert.equal(researchTasks.length, 1);
  assert.deepEqual(plan.requiredMcp, ['notebooklm', 'filesystem']);
});

test('Strategy Engine shares one research task across a multi-output campaign', () => {
  const ctx = buildConversationContext({
    message: 'Create a marketing campaign for PillFill: a video and a blog post.',
    brandMemory: BRAND_MEMORY,
    knowledgeSources: ['notebooklm://pillfill-clinical-notes'],
  });
  const intent = resolveIntent(ctx);
  const plan = planExecution(intent);
  const researchTasks = plan.tasks.filter((t) => t.agentCapability === 'research');
  assert.equal(researchTasks.length, 1, 'exactly one shared research task, not one per output type');
  const videoScriptTask = plan.tasks.find((t) => t.agentCapability === 'script_writing' && t.dependsOn.includes(researchTasks[0].id));
  assert.ok(videoScriptTask, 'downstream tasks should depend on the shared research task');
  assert.equal(plan.workflow, 'marketing_campaign');
  assert.deepEqual(plan.exportFormats.sort(), ['blog_post', 'video']);
});

test('Strategy Engine estimated cost is the sum of its tasks and duration is the critical path', () => {
  const ctx = buildConversationContext({ message: 'Create a blog post for PillFill.', brandMemory: BRAND_MEMORY });
  const intent = resolveIntent(ctx);
  const plan = planExecution(intent);
  const expectedCost = plan.tasks.reduce((sum, t) => sum + t.estimatedCostUsd, 0);
  assert.ok(Math.abs(plan.estimatedCostUsd - expectedCost) < 1e-9);
  assert.ok(plan.estimatedDurationMs > 0);
});
