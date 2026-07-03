import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createIntentObject,
  validateIntentObject,
  createExecutionPlan,
  createPlannedTask,
  validateExecutionPlan,
  createCapabilityRequest,
  validateCapabilityRequest,
  createContentPackage,
  createContentAsset,
  createSession,
  sessionHasPermission,
  isSessionExpired,
  createAgentRegistryEntry,
} from '../src/index.js';

test('createIntentObject fills defaults and flags missing required fields', () => {
  const intent = createIntentObject({ goal: 'Promote PillFill to pharmacists' });
  assert.equal(intent.goal, 'Promote PillFill to pharmacists');
  assert.ok(intent.missingRequiredFields.includes('brandId'));
  assert.ok(intent.missingRequiredFields.includes('outputTypes'));
  assert.equal(validateIntentObject(intent).valid, true);
});

test('createIntentObject computes overall confidence from field confidences', () => {
  const intent = createIntentObject({
    goal: 'Explain migraine',
    brandId: 'wise-homeopathy',
    primaryAction: 'explain',
    outputTypes: ['blog_post'],
    confidence: { brandId: 1, goal: 0.8 },
  });
  assert.equal(intent.overallConfidence, 0.9);
});

test('validateIntentObject rejects bad quality level', () => {
  const intent = createIntentObject({ goal: 'x', constraints: { qualityLevel: 'ultra' } });
  const result = validateIntentObject(intent);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(), /qualityLevel/);
});

test('createExecutionPlan computes cost as sum and duration as critical path', () => {
  const t1 = createPlannedTask({ id: 't1', agentCapability: 'research', estimatedCostUsd: 0.01, estimatedDurationMs: 1000 });
  const t2 = createPlannedTask({ id: 't2', agentCapability: 'script', dependsOn: ['t1'], estimatedCostUsd: 0.02, estimatedDurationMs: 2000 });
  const t3 = createPlannedTask({ id: 't3', agentCapability: 'seo', estimatedCostUsd: 0.005, estimatedDurationMs: 500 });
  const plan = createExecutionPlan({ intentId: 'intent_1', tasks: [t1, t2, t3] });
  assert.ok(Math.abs(plan.estimatedCostUsd - 0.035) < 1e-9);
  // t3 runs in parallel with t1->t2 chain; critical path = t1 + t2 = 3000ms, not the 3500ms sum of all.
  assert.equal(plan.estimatedDurationMs, 3000);
  assert.equal(validateExecutionPlan(plan).valid, true);
});

test('validateExecutionPlan rejects a task depending on an unknown task', () => {
  const t1 = createPlannedTask({ id: 't1', dependsOn: ['ghost'] });
  const plan = createExecutionPlan({ intentId: 'intent_1', tasks: [t1] });
  const result = validateExecutionPlan(plan);
  assert.equal(result.valid, false);
});

test('capability request validates known capabilities only', () => {
  const good = createCapabilityRequest({ capability: 'generate_text', input: { prompt: 'hi' } });
  assert.equal(validateCapabilityRequest(good).valid, true);
  const bad = createCapabilityRequest({ capability: 'call_claude_directly', input: {} });
  assert.equal(validateCapabilityRequest(bad).valid, false);
});

test('content package aggregates assets', () => {
  const asset = createContentAsset({ type: 'caption', platform: 'instagram', content: 'Hello world' });
  const pkg = createContentPackage({ intentId: 'i1', executionPlanId: 'p1', assets: [asset] });
  assert.equal(pkg.assets.length, 1);
  assert.equal(pkg.qaStatus, 'pending');
});

test('session permission scope defaults by role and expiry works', () => {
  const session = createSession({ sessionId: 's1', userId: 'u1', role: 'content_creator', createdAt: 1000, expiresAt: 2000 });
  assert.equal(sessionHasPermission(session, 'campaign:write'), true);
  assert.equal(sessionHasPermission(session, 'config:write'), false);
  assert.equal(isSessionExpired(session, 1500), false);
  assert.equal(isSessionExpired(session, 2500), true);
});

test('owner role has wildcard permission', () => {
  const session = createSession({ sessionId: 's2', userId: 'u2', role: 'owner' });
  assert.equal(sessionHasPermission(session, 'anything:at-all'), true);
});

test('agent registry entry defaults', () => {
  const entry = createAgentRegistryEntry({ name: 'script_agent', capabilities: ['generate_text'] });
  assert.equal(entry.name, 'script_agent');
  assert.equal(entry.healthStatus, 'healthy');
});
