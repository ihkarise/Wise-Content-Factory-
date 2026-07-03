/**
 * Agent Orchestrator — the operational brain of the Execution layer. Coordinates every Agent;
 * agents never talk to each other directly, all communication passes through here. See
 * docs/architecture/AGENT_ORCHESTRATOR.md.
 *
 * Failure recovery matches the documented chain: "If an agent fails: retry. If retry fails:
 * select a compatible fallback agent if available. If all recovery attempts fail: continue
 * remaining tasks... never terminate the entire project because one task failed."
 */

import { createContentPackage, createContentAsset } from '@wcf/core';

export class AgentOrchestrator {
  /**
   * @param {{omniroute: import('@wcf/infrastructure').OmniRoute, mcpManager?: import('@wcf/infrastructure').McpManager}} deps
   */
  constructor(deps) {
    if (!deps?.omniroute) throw new Error('AgentOrchestrator requires an OmniRoute instance — agents never call providers directly.');
    this.omniroute = deps.omniroute;
    this.mcpManager = deps.mcpManager ?? null;
    /** @type {Map<string, Array<{name: string, capabilities: string[], priority: number, run: Function}>>} */
    this.agentsByCapability = new Map();
  }

  /**
   * @param {{name: string, capabilities: string[], priority?: number, run: (task: import('@wcf/core').PlannedTask, ctx: Object) => Promise<{asset?: Object, output?: any, costUsd?: number}>}} agent
   */
  registerAgent(agent) {
    if (!agent?.name || typeof agent.run !== 'function') {
      throw new Error('Agent must have a name and a run(task, ctx) function');
    }
    for (const capability of agent.capabilities) {
      const list = this.agentsByCapability.get(capability) || [];
      list.push({ priority: 0, ...agent });
      list.sort((a, b) => b.priority - a.priority);
      this.agentsByCapability.set(capability, list);
    }
  }

  listAgentsForCapability(capability) {
    return this.agentsByCapability.get(capability) || [];
  }

  /**
   * @param {import('@wcf/core').ExecutionPlanObject} plan
   * @param {{intent: import('@wcf/core').IntentObject}} context
   */
  async runPlan(plan, context) {
    const byId = new Map(plan.tasks.map((t) => [t.id, t]));
    const status = new Map(plan.tasks.map((t) => [t.id, 'pending']));
    const results = new Map();
    const errors = new Map();
    // A campaign's Intent Object may have split into several related (per-output-type) Intent
    // Objects — each task is tagged with which one it actually belongs to (sourceIntentId), so an
    // Agent asks "what output type am I producing?" against the right intent instead of always
    // seeing the parent campaign intent's first output type.
    const intentsById = new Map(
      [context.intent, ...(context.intent.relatedIntents || [])].map((i) => [i.id, i])
    );

    for (const level of topologicalLevels(plan.tasks)) {
      await Promise.all(
        level.map(async (task) => {
          const blockedBy = task.dependsOn.filter((depId) => status.get(depId) !== 'completed');
          if (blockedBy.length) {
            status.set(task.id, 'skipped');
            errors.set(task.id, `Skipped because upstream task(s) did not complete: ${blockedBy.join(', ')}`);
            return;
          }
          const upstream = Object.fromEntries(task.dependsOn.map((depId) => [depId, results.get(depId)]));
          const taskIntent = (task.sourceIntentId && intentsById.get(task.sourceIntentId)) || context.intent;
          const outcome = await this._runTaskWithFallbackAgents(task, { ...context, intent: taskIntent, upstream, plan });
          if (outcome.ok) {
            status.set(task.id, 'completed');
            results.set(task.id, outcome.result);
          } else {
            status.set(task.id, 'failed');
            errors.set(task.id, outcome.error);
          }
        })
      );
    }

    const assets = [];
    for (const [taskId, result] of results) {
      if (result?.asset) assets.push(createContentAsset(result.asset));
    }
    const qaTask = plan.tasks.find((t) => t.agentCapability === 'quality_assurance');
    const qaResult = qaTask ? results.get(qaTask.id) : null;

    const contentPackage = createContentPackage({
      intentId: context.intent.id,
      executionPlanId: plan.id,
      brandId: plan.brandId,
      projectId: plan.projectId,
      assets,
      cost: { estimatedUsd: plan.estimatedCostUsd, actualUsd: sumActualCost(results) },
      qaStatus: qaResult ? (qaResult.output?.passed ? 'passed' : 'failed') : 'pending',
    });

    return {
      contentPackage,
      taskStatus: Object.fromEntries(status),
      taskResults: Object.fromEntries(results),
      taskErrors: Object.fromEntries(errors),
      completed: [...status.values()].filter((s) => s === 'completed').length,
      failed: [...status.values()].filter((s) => s === 'failed').length,
      skipped: [...status.values()].filter((s) => s === 'skipped').length,
      byIdForDebug: byId,
    };
  }

  async _runTaskWithFallbackAgents(task, ctx) {
    const candidates = this.listAgentsForCapability(task.agentCapability);
    if (!candidates.length) {
      return { ok: false, error: `No agent registered for capability "${task.agentCapability}"` };
    }
    let lastError;
    for (const agent of candidates) {
      try {
        const result = await agent.run(task, {
          omniroute: this.omniroute,
          mcpManager: this.mcpManager,
          ...ctx,
        });
        return { ok: true, result: { ...result, agentName: agent.name } };
      } catch (err) {
        lastError = err;
      }
    }
    return { ok: false, error: `All agent(s) for capability "${task.agentCapability}" failed: ${lastError?.message}` };
  }
}

/**
 * Groups tasks into levels where every task in a level has all of its dependencies satisfied by
 * an earlier level — tasks within a level have no dependency on each other and can run in
 * parallel, matching "maximize safe parallel execution" (AGENT_ORCHESTRATOR.md).
 * @param {import('@wcf/core').PlannedTask[]} tasks
 */
function topologicalLevels(tasks) {
  const remaining = new Map(tasks.map((t) => [t.id, t]));
  const done = new Set();
  const levels = [];
  while (remaining.size) {
    const level = [...remaining.values()].filter((t) => t.dependsOn.every((dep) => done.has(dep)));
    if (!level.length) {
      // Cycle or missing dependency — surface the remaining tasks as one final level rather than
      // looping forever; runPlan will mark them skipped since their deps never completed.
      levels.push([...remaining.values()]);
      break;
    }
    levels.push(level);
    for (const t of level) {
      remaining.delete(t.id);
      done.add(t.id);
    }
  }
  return levels;
}

function sumActualCost(results) {
  let total = 0;
  for (const result of results.values()) total += result?.costUsd || 0;
  return total;
}
