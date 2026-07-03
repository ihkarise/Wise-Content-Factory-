/**
 * Real voice-generation provider backed by the ElevenLabs Text-to-Speech API
 * (`POST /v1/text-to-speech/{voiceId}`, real audio bytes back). Second priority in the
 * voice-provider order given in docs/architecture/AI_INFRASTRUCTURE.md, used whenever the
 * zero-cost Browser TTS tier isn't available (server-side generation, or higher quality needed).
 *
 * Same conventions as every other provider: no API key -> healthStatus 'unavailable', apiKey
 * injected by the caller (this holds a real secret, so it is only ever registered server-side —
 * see apps/omniroute-server — never in the browser bundle), fetchImpl injectable for testing.
 */
import { defineProvider } from './providerInterface.js';

const CAPABILITIES = ['generate_speech'];
const API_BASE_URL = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // ElevenLabs' default public "Rachel" voice
const DEFAULT_MODEL = 'eleven_multilingual_v2';

// Rough public per-1k-character pricing for cost estimation only (not billing-accurate).
const COST_PER_1K_CHARS_USD = 0.18;

/**
 * @param {{apiKey?: string, voiceId?: string, model?: string, id?: string, tier?: string,
 *   fetchImpl?: typeof fetch}} options
 */
export function createElevenLabsProvider({
  apiKey,
  voiceId = DEFAULT_VOICE_ID,
  model = DEFAULT_MODEL,
  id = 'elevenlabs',
  tier = 'low_cost',
  fetchImpl = globalThis.fetch,
} = {}) {
  return defineProvider({
    id,
    capabilities: CAPABILITIES,
    tier,
    healthStatus: apiKey ? 'healthy' : 'unavailable',
    estimateCostUsd: (request) => estimateCost(request),
    estimateDurationMs: () => 3000,
    async execute(request) {
      if (!apiKey) throw new Error(`Provider "${id}" has no API key configured.`);
      const text = request.input.prompt || request.input.text || '';
      const response = await fetchImpl(`${API_BASE_URL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'xi-api-key': apiKey, accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: model }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`ElevenLabs API error ${response.status}: ${body}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
      return {
        output: { audioBase64, mimeType: 'audio/mpeg', provider: id, voiceId, model },
        costUsd: estimateCost(request),
      };
    },
  });
}

function estimateCost(request) {
  const text = request.input.prompt || request.input.text || '';
  return (text.length / 1000) * COST_PER_1K_CHARS_USD;
}
