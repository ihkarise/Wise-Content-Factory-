/**
 * Execution Plan Object schema — the output of the Strategy Engine and the input to the Agent Orchestrator.
 * See docs/architecture/STRATEGY_ENGINE.md.
 *
 * @typedef {Object} PlannedTask
 * @property {string} id
 * @property {string} agentCapability   Capability requested, e.g. "generate_script" — never a specific agent name.
 * @property {string[]} dependsOn       Task ids that must complete first.
 * @property {number} priority
 * @property {number} estimatedCostUsd
 * @property {number} estimatedDurationMs
 * @property {string|null} sourceIntentId  Which Intent Object (parent or split related-intent) this task belongs to.
 *
 * @typedef {Object} ExecutionPlanObject
 * @property {string} id
 * @property {string} intentId
 * @property {string|null} brandId
 * @property {string|null} projectId
 * @property {string} workflow          e.g. "marketing_campaign", "blog_package", "video_only"
 * @property {string} qualityLevel
 * @property {PlannedTask[]} tasks
 * @property {string[]} requiredMcp
 * @property {string[]} exportFormats
 * @property {number} estimatedCostUsd
 * @property {number} estimatedDurationMs
 * @property {string|null} fallbackWorkflow
 */

let counter = 0;
function nextId(prefix) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

/**
 * @param {Partial<ExecutionPlanObject>} fields
 * @returns {ExecutionPlanObject}
 */
export function createExecutionPlan(fields = {}) {
  const tasks = fields.tasks || [];
  return {
    id: fields.id || nextId('plan'),
    intentId: fields.intentId || '',
    brandId: fields.brandId ?? null,
    projectId: fields.projectId ?? null,
    workflow: fields.workflow || 'single_asset',
    qualityLevel: fields.qualityLevel || 'balanced',
    tasks,
    requiredMcp: fields.requiredMcp || [],
    exportFormats: fields.exportFormats || [],
    estimatedCostUsd: fields.estimatedCostUsd ?? sumCost(tasks),
    estimatedDurationMs: fields.estimatedDurationMs ?? sumDuration(tasks),
    fallbackWorkflow: fields.fallbackWorkflow ?? null,
  };
}

/**
 * @param {Partial<PlannedTask>} fields
 * @returns {PlannedTask}
 */
export function createPlannedTask(fields = {}) {
  return {
    id: fields.id || nextId('task'),
    agentCapability: fields.agentCapability || '',
    dependsOn: fields.dependsOn || [],
    priority: fields.priority ?? 0,
    estimatedCostUsd: fields.estimatedCostUsd ?? 0,
    estimatedDurationMs: fields.estimatedDurationMs ?? 0,
    // Which Intent Object (parent or a split related-intent) this task actually belongs to —
    // required so a campaign with multiple output types routes each task to the right agent
    // context instead of every task seeing only the parent intent's first output type.
    sourceIntentId: fields.sourceIntentId ?? null,
  };
}

function sumCost(tasks) {
  return tasks.reduce((sum, t) => sum + (t.estimatedCostUsd || 0), 0);
}

function sumDuration(tasks) {
  // Tasks with no dependency on each other can run in parallel; duration is the length
  // of the longest dependency chain, not the sum of every task.
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map();
  function longestPath(taskId) {
    if (memo.has(taskId)) return memo.get(taskId);
    const task = byId.get(taskId);
    if (!task) return 0;
    const upstream = task.dependsOn.map(longestPath);
    const value = (task.estimatedDurationMs || 0) + (upstream.length ? Math.max(...upstream) : 0);
    memo.set(taskId, value);
    return value;
  }
  const ends = tasks.map((t) => longestPath(t.id));
  return ends.length ? Math.max(...ends) : 0;
}

/**
 * @param {ExecutionPlanObject} plan
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateExecutionPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') return { valid: false, errors: ['Execution plan is required'] };
  if (!plan.intentId) errors.push('intentId is required');
  if (!Array.isArray(plan.tasks)) errors.push('tasks must be an array');
  const ids = new Set(plan.tasks.map((t) => t.id));
  for (const task of plan.tasks) {
    for (const dep of task.dependsOn) {
      if (!ids.has(dep)) errors.push(`task ${task.id} depends on unknown task ${dep}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
