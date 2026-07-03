import { BRANDS } from './config.js';
import { buildConversationContext, resolveIntent, planExecution } from '@wcf/engines';
// Imported from its own file rather than the @wcf/infrastructure barrel: the barrel also
// re-exports securityManager.js, which statically imports Node's `node:crypto` and is documented
// as Node/gateway-only tooling — browsers can't resolve that import at all. OmniRoute itself has
// no such dependency.
import { OmniRoute } from '@wcf/infrastructure/omniroute.js';
import { createMockTextProvider, createMockMediaProvider } from '@wcf/providers';
import { AgentOrchestrator, registerCoreAgents } from '@wcf/agents';
import { isGatewayConfigured, getStoredSessionToken, login } from './gatewayClient.js';
import { createGatewayProvider } from './gatewayProvider.js';

const els = {
  brandSelect: document.getElementById('brand-select'),
  qualitySelect: document.getElementById('quality-select'),
  status: document.getElementById('provider-status'),
  gatewayLogin: document.getElementById('gateway-login'),
  passphraseInput: document.getElementById('passphrase-input'),
  loginButton: document.getElementById('login-button'),
  loginHint: document.getElementById('login-hint'),
  thread: document.getElementById('thread'),
  form: document.getElementById('prompt-form'),
  promptInput: document.getElementById('prompt-input'),
  planPanel: document.getElementById('plan-panel'),
  packagePanel: document.getElementById('package-panel'),
};

const memory = {
  brandMemory: { brands: BRANDS, activeBrandId: null },
  projectMemory: {},
  conversationMemory: {},
};

let omniroute;
let orchestrator;

function buildOmniRoute() {
  const route = new OmniRoute();
  if (isGatewayConfigured()) {
    // Production configuration: real AI via the secure gateway. Media capabilities still fall
    // back to the free local placeholder until a real image/video/voice provider is wired into
    // apps/gateway/OmniRouteProxy.gs — see that file's comments.
    route.registerProvider(createGatewayProvider());
    route.registerProvider(createMockMediaProvider());
  } else {
    // No gateway configured: zero-cost, zero-setup local demo mode.
    route.registerProvider(createMockTextProvider());
    route.registerProvider(createMockMediaProvider());
  }
  return route;
}

function refreshProviders() {
  omniroute = buildOmniRoute();
  orchestrator = registerCoreAgents(new AgentOrchestrator({ omniroute }));
  updateStatus();
}

function updateStatus() {
  if (!isGatewayConfigured()) {
    els.status.textContent = 'Local demo mode — generating with free, offline mock providers ($0). Configure apps/web/config.js to connect a real gateway.';
    els.gatewayLogin.hidden = true;
    return;
  }
  const signedIn = Boolean(getStoredSessionToken());
  els.gatewayLogin.hidden = signedIn;
  els.status.textContent = signedIn
    ? 'Connected to the Wise Content Factory gateway.'
    : 'Gateway configured — sign in to generate with real AI providers.';
}

function populateBrandSelect() {
  const autoOption = document.createElement('option');
  autoOption.value = '';
  autoOption.textContent = 'Detect from message';
  els.brandSelect.appendChild(autoOption);
  for (const brand of BRANDS) {
    const option = document.createElement('option');
    option.value = brand.id;
    option.textContent = brand.name;
    els.brandSelect.appendChild(option);
  }
}

function appendMessage(text, kind) {
  const bubble = document.createElement('div');
  bubble.className = `message message--${kind}`;
  bubble.textContent = text;
  els.thread.appendChild(bubble);
  els.thread.scrollTop = els.thread.scrollHeight;
  return bubble;
}

function renderPlan(plan) {
  els.planPanel.innerHTML = '';
  const meta = document.createElement('p');
  meta.className = 'hint';
  meta.textContent = `Workflow: ${plan.workflow} · Estimated cost: $${plan.estimatedCostUsd.toFixed(4)} · Estimated time: ${(plan.estimatedDurationMs / 1000).toFixed(1)}s`;
  els.planPanel.appendChild(meta);
  for (const task of plan.tasks) {
    els.planPanel.appendChild(taskRow(task.id, task.agentCapability, 'pending'));
  }
}

function updateTaskStatus(taskId, status) {
  const row = els.planPanel.querySelector(`[data-task-id="${taskId}"]`);
  if (!row) return;
  const badge = row.querySelector('.task-status');
  badge.className = `task-status task-status--${status}`;
  badge.textContent = status;
}

function taskRow(taskId, label, status) {
  const row = document.createElement('div');
  row.className = 'task-row';
  row.dataset.taskId = taskId;
  const name = document.createElement('span');
  name.textContent = label.replace(/_/g, ' ');
  const badge = document.createElement('span');
  badge.className = `task-status task-status--${status}`;
  badge.textContent = status;
  row.append(name, badge);
  return row;
}

function renderContentPackage(contentPackage) {
  els.packagePanel.innerHTML = '';
  const meta = document.createElement('p');
  meta.className = 'hint';
  meta.textContent = `QA status: ${contentPackage.qaStatus} · Actual cost: $${contentPackage.cost.actualUsd.toFixed(4)}`;
  els.packagePanel.appendChild(meta);
  if (!contentPackage.assets.length) {
    els.packagePanel.appendChild(Object.assign(document.createElement('p'), { className: 'hint', textContent: 'No deliverable assets were produced.' }));
    return;
  }
  for (const asset of contentPackage.assets) {
    const card = document.createElement('div');
    card.className = 'asset-card';
    const type = document.createElement('div');
    type.className = 'asset-card__type';
    type.textContent = `${asset.type} · ${asset.platform}`;
    const content = document.createElement('div');
    content.className = 'asset-card__content';
    content.textContent = typeof asset.content === 'string' ? asset.content : JSON.stringify(asset.content, null, 2);
    card.append(type, content);
    els.packagePanel.appendChild(card);
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const message = els.promptInput.value.trim();
  if (!message) return;

  els.promptInput.value = '';
  appendMessage(message, 'user');
  memory.brandMemory.activeBrandId = els.brandSelect.value || memory.brandMemory.activeBrandId;

  const context = buildConversationContext({
    message,
    brandMemory: memory.brandMemory,
    projectMemory: memory.projectMemory,
    conversationMemory: memory.conversationMemory,
  });
  const intent = resolveIntent(context);
  intent.constraints.qualityLevel = els.qualitySelect.value;

  if (intent.missingRequiredFields.includes('brandId')) {
    appendMessage('Which brand is this for? Pick one from the sidebar and send your message again.', 'system');
    return;
  }

  memory.conversationMemory.lastGoal = intent.goal;
  setFormEnabled(false);
  appendMessage('Planning your request…', 'system');

  try {
    const plan = planExecution(intent);
    renderPlan(plan);

    const run = await orchestrator.runPlan(plan, { intent });
    for (const [taskId, status] of Object.entries(run.taskStatus)) updateTaskStatus(taskId, status);
    renderContentPackage(run.contentPackage);

    const summary = `Done — ${run.completed} task(s) completed` +
      (run.failed ? `, ${run.failed} failed` : '') +
      (run.skipped ? `, ${run.skipped} skipped` : '') +
      `. ${run.contentPackage.assets.length} asset(s) produced (QA: ${run.contentPackage.qaStatus}).`;
    appendMessage(summary, 'system');
  } catch (err) {
    appendMessage(`Something went wrong: ${err.message}`, 'error');
  } finally {
    setFormEnabled(true);
  }
}

function setFormEnabled(enabled) {
  els.promptInput.disabled = !enabled;
  els.form.querySelector('button[type="submit"]').disabled = !enabled;
}

async function handleLogin() {
  els.loginHint.textContent = '';
  const passphrase = els.passphraseInput.value;
  if (!passphrase) return;
  try {
    await login(passphrase);
    els.passphraseInput.value = '';
    refreshProviders();
    appendMessage('Signed in to the gateway.', 'system');
  } catch (err) {
    els.loginHint.textContent = err.message;
  }
}

populateBrandSelect();
refreshProviders();
els.form.addEventListener('submit', handleSubmit);
els.loginButton?.addEventListener('click', handleLogin);
