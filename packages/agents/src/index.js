export * from './agentOrchestrator.js';
export * from './agents/index.js';

import { AgentOrchestrator } from './agentOrchestrator.js';
import {
  createResearchAgent,
  createScriptAgent,
  createStoryboardAgent,
  createPromptAgent,
  createImageAgent,
  createVideoAgent,
  createVoiceAgent,
  createCaptionAgent,
  createSeoAgent,
  createQaAgent,
  createPublishingAgent,
} from './agents/index.js';

/**
 * Convenience helper: registers every core content agent on an orchestrator. Individual agents
 * remain independently registerable/replaceable — this is sugar, not a requirement.
 * @param {AgentOrchestrator} orchestrator
 */
export function registerCoreAgents(orchestrator) {
  [
    createResearchAgent(),
    createScriptAgent(),
    createStoryboardAgent(),
    createPromptAgent(),
    createImageAgent(),
    createVideoAgent(),
    createVoiceAgent(),
    createCaptionAgent(),
    createSeoAgent(),
    createQaAgent(),
    createPublishingAgent(),
  ].forEach((agent) => orchestrator.registerAgent(agent));
  return orchestrator;
}
