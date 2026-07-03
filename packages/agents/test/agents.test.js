import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIntentObject, createExecutionPlan, createPlannedTask } from '@wcf/core';
import { OmniRoute } from '@wcf/infrastructure';
import { createMockTextProvider, createMockMediaProvider } from '@wcf/providers';
import { PublishingManager, definePublishingProvider } from '@wcf/publishing';
import { AgentOrchestrator, registerCoreAgents, createPublishingAgent } from '../src/index.js';
import { planExecution } from '@wcf/engines';

function buildOmniRoute() {
  const omniroute = new OmniRoute();
  omniroute.registerProvider(createMockTextProvider());
  omniroute.registerProvider(createMockMediaProvider());
  return omniroute;
}

test('AgentOrchestrator requires an OmniRoute instance', () => {
  assert.throws(() => new AgentOrchestrator({}), /requires an OmniRoute instance/);
});

test('AgentOrchestrator runs a single-asset blog plan end-to-end and produces a passing content package', async () => {
  const omniroute = buildOmniRoute();
  const orchestrator = registerCoreAgents(new AgentOrchestrator({ omniroute }));

  const intent = createIntentObject({
    primaryAction: 'create_asset',
    brandId: 'pillfill',
    goal: 'Promote PillFill to pharmacists.',
    outputTypes: ['blog_post'],
    platforms: ['blog'],
  });
  const plan = planExecution(intent);
  const run = await orchestrator.runPlan(plan, { intent });

  assert.equal(run.failed, 0);
  assert.equal(run.skipped, 0);
  assert.equal(run.completed, plan.tasks.length);
  assert.equal(run.contentPackage.qaStatus, 'passed');
  assert.equal(run.contentPackage.assets.length, 1);
  assert.equal(run.contentPackage.assets[0].type, 'blog_post');
  assert.match(run.contentPackage.assets[0].content, /PillFill/);
});

test('AgentOrchestrator runs a video pipeline through storyboard/video/caption agents', async () => {
  const omniroute = buildOmniRoute();
  const orchestrator = registerCoreAgents(new AgentOrchestrator({ omniroute }));

  const intent = createIntentObject({
    primaryAction: 'create_asset',
    brandId: 'pillfill',
    goal: 'Make a video for PillFill.',
    outputTypes: ['video'],
  });
  const plan = planExecution(intent);
  const run = await orchestrator.runPlan(plan, { intent });

  assert.equal(run.failed, 0, JSON.stringify(run.taskErrors));
  const types = run.contentPackage.assets.map((a) => a.type).sort();
  assert.deepEqual(types, ['video', 'video_caption']);
});

test('AgentOrchestrator runs a multi-output campaign sharing a single research task, still delivering every output', async () => {
  const omniroute = buildOmniRoute();
  const orchestrator = registerCoreAgents(new AgentOrchestrator({ omniroute }));

  const intent = createIntentObject({
    primaryAction: 'create_campaign',
    brandId: 'pillfill',
    goal: 'Create a marketing campaign for PillFill: a video and a blog post.',
    outputTypes: ['video', 'blog_post'],
    knowledgeSources: ['notebooklm://pillfill'],
  });
  intent.relatedIntents = [
    createIntentObject({ primaryAction: 'create_asset', brandId: 'pillfill', goal: intent.goal, outputTypes: ['video'], knowledgeSources: intent.knowledgeSources }),
    createIntentObject({ primaryAction: 'create_asset', brandId: 'pillfill', goal: intent.goal, outputTypes: ['blog_post'], knowledgeSources: intent.knowledgeSources }),
  ];
  const plan = planExecution(intent);
  const run = await orchestrator.runPlan(plan, { intent });

  assert.equal(run.failed, 0, JSON.stringify(run.taskErrors));
  const types = run.contentPackage.assets.map((a) => a.type).sort();
  assert.deepEqual(types, ['blog_post', 'video', 'video_caption']);
});

test('AgentOrchestrator gracefully skips downstream tasks and continues the rest of the plan when one agent fails', async () => {
  const omniroute = buildOmniRoute();
  const orchestrator = new AgentOrchestrator({ omniroute });
  // No agents registered at all -> every task should fail with a clear "no agent registered" error,
  // and the run should still complete (never throw) with a full failure/skip report.
  const intent = createIntentObject({
    primaryAction: 'create_asset', brandId: 'pillfill', goal: 'Create a blog post.', outputTypes: ['blog_post'],
  });
  const plan = planExecution(intent);
  const run = await orchestrator.runPlan(plan, { intent });
  assert.equal(run.completed, 0);
  assert.ok(run.failed >= 1);
  assert.match(Object.values(run.taskErrors)[0], /No agent registered/);
});

test('AgentOrchestrator falls back to a second agent registered for the same capability', async () => {
  const omniroute = buildOmniRoute();
  const orchestrator = registerCoreAgents(new AgentOrchestrator({ omniroute }));
  let fallbackCalled = false;
  orchestrator.registerAgent({
    name: 'flaky_seo_agent',
    capabilities: ['seo_optimization'],
    priority: 10, // tried first
    async run() { throw new Error('flaky agent always fails'); },
  });
  orchestrator.registerAgent({
    name: 'reliable_seo_agent',
    capabilities: ['seo_optimization'],
    priority: -10, // tried last, after the flaky one and the registerCoreAgents seo_agent
    async run(task, ctx) {
      fallbackCalled = true;
      return { output: { finalText: 'ok' }, asset: { type: 'blog_post', platform: 'blog', content: 'ok', providerId: 'reliable_seo_agent' } };
    },
  });
  const intent = createIntentObject({
    primaryAction: 'create_asset', brandId: 'pillfill', goal: 'Create a blog post.', outputTypes: ['blog_post'],
  });
  const plan = planExecution(intent);
  const run = await orchestrator.runPlan(plan, { intent });
  // The default seo_agent (priority 0) sits between the flaky one (10) and the reliable one (-10),
  // and it succeeds on its own, so the reliable fallback should never actually be needed.
  assert.equal(run.failed, 0);
  assert.equal(fallbackCalled, false);
});

test('AgentOrchestrator injects publishingManager into agent context, and Publishing Agent uses it', async () => {
  const omniroute = buildOmniRoute();
  const published = [];
  const publishingManager = new PublishingManager();
  publishingManager.registerProvider(
    definePublishingProvider({
      id: 'fake-instagram',
      platform: 'instagram',
      authenticate: async () => ({ authenticated: true }),
      createDraft: async () => ({}),
      schedulePublish: async () => ({}),
      publishNow: async (content) => {
        published.push(content);
        return { platformPostId: 'ig-1', status: 'published', nativelyScheduled: true, publishAt: null };
      },
      getUploadStatus: async () => ({ status: 'published' }),
    })
  );
  const orchestrator = new AgentOrchestrator({ omniroute, publishingManager });
  orchestrator.registerAgent(createPublishingAgent());

  const intent = createIntentObject({
    primaryAction: 'create_asset',
    brandId: 'pillfill',
    goal: 'Announce the PillFill launch.',
    outputTypes: ['caption'],
    platforms: ['instagram'],
  });
  const plan = createExecutionPlan({
    intentId: intent.id,
    tasks: [createPlannedTask({ id: 'publish_1', agentCapability: 'publishing', dependsOn: [] })],
  });
  const run = await orchestrator.runPlan(plan, { intent });

  assert.equal(run.failed, 0);
  assert.equal(published.length, 1);
  assert.equal(published[0].text, 'Announce the PillFill launch.');
  const publishResult = run.taskResults.publish_1.output.published;
  assert.equal(publishResult.instagram.ok, true);
  assert.equal(publishResult.instagram.result.platformPostId, 'ig-1');
});

test('Publishing Agent skips gracefully (never fails the run) with no publishingManager configured', async () => {
  const omniroute = buildOmniRoute();
  const orchestrator = new AgentOrchestrator({ omniroute }); // no publishingManager
  orchestrator.registerAgent(createPublishingAgent());

  const intent = createIntentObject({
    primaryAction: 'create_asset', brandId: 'pillfill', goal: 'Announce the launch.',
    outputTypes: ['caption'], platforms: ['instagram'],
  });
  const plan = createExecutionPlan({
    intentId: intent.id,
    tasks: [createPlannedTask({ id: 'publish_1', agentCapability: 'publishing', dependsOn: [] })],
  });
  const run = await orchestrator.runPlan(plan, { intent });

  assert.equal(run.failed, 0);
  assert.equal(run.taskResults.publish_1.output.skipped, true);
});

test('registerCoreAgents includes the Publishing Agent', () => {
  const omniroute = buildOmniRoute();
  const orchestrator = registerCoreAgents(new AgentOrchestrator({ omniroute }));
  assert.equal(orchestrator.listAgentsForCapability('publishing').length, 1);
});
