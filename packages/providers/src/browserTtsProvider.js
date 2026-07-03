/**
 * Zero-cost voice provider using the browser's built-in SpeechSynthesis API. First priority in
 * the voice-provider order (docs/architecture/AI_INFRASTRUCTURE.md: "Voice Models: Browser TTS,
 * ElevenLabs, Google, Microsoft") — always free wherever a browser runs this code, matching
 * OMNIROUTE_INTEGRATION.md's "Local-First Policy" (cache -> local -> *browser* -> free ->
 * low-cost -> premium): this is the one provider that belongs in the dedicated `browser` cost
 * tier already defined in packages/infrastructure/src/costOptimizer.js.
 *
 * SpeechSynthesis only exists in a browser context (apps/web), never in Node — this provider is
 * therefore healthStatus: 'unavailable' everywhere except a real browser tab, so the Provider
 * Router (and apps/omniroute-server, which runs in Node) automatically skip it and the platform
 * falls through to the next voice tier (ElevenLabs). The Strategy Engine/Agent Orchestrator never
 * need to know why — this is exactly the health-status-driven routing every other provider uses.
 *
 * SpeechSynthesis produces live audio output, not a downloadable file — there is no standard
 * browser API to capture synthesized speech to a blob without extra machinery (routing through
 * Web Audio + MediaRecorder, which is inconsistent across browsers). So `execute` returns a
 * structured "speak instruction" the frontend renders by calling `speechSynthesis.speak(...)`
 * directly, the same way mockMediaProvider.js returns a structured placeholder instead of a real
 * asset. Callers that need an actual audio file should prefer ElevenLabs.
 */
import { defineProvider } from './providerInterface.js';

const CAPABILITIES = ['generate_speech'];

function detectSpeechSynthesis(speechSynthesisImpl) {
  if (speechSynthesisImpl) return speechSynthesisImpl;
  return typeof globalThis !== 'undefined' ? globalThis.speechSynthesis : undefined;
}

/**
 * @param {{id?: string, tier?: string, voice?: string, rate?: number, pitch?: number,
 *   speechSynthesisImpl?: {speak: Function}}} options
 */
export function createBrowserTtsProvider({
  id = 'browser-tts',
  tier = 'browser',
  voice,
  rate = 1,
  pitch = 1,
  speechSynthesisImpl,
} = {}) {
  const speechSynthesisApi = detectSpeechSynthesis(speechSynthesisImpl);
  return defineProvider({
    id,
    capabilities: CAPABILITIES,
    tier,
    healthStatus: speechSynthesisApi ? 'healthy' : 'unavailable',
    estimateCostUsd: () => 0,
    estimateDurationMs: () => 0,
    async execute(request) {
      if (!speechSynthesisApi) {
        throw new Error(`Provider "${id}" requires a browser SpeechSynthesis API, which is not available here.`);
      }
      const text = request.input.prompt || request.input.text || '';
      return {
        output: { mode: 'browser-speech-synthesis', text, voice: voice ?? null, rate, pitch },
        costUsd: 0,
      };
    },
  });
}
