# AI Provider Adapters

## Purpose

Every real AI vendor integration in Wise Content Factory lives here, behind one common interface
(`defineProvider` in `providerInterface.js`), matching `CLAUDE.md`'s Provider Rules: "Every
provider must implement the same interface... No business logic should depend on provider APIs."
The Strategy Engine, Agent Orchestrator, and every Agent (`packages/agents`) only ever see a
`CapabilityRequest` going in and `{output, costUsd}` coming out — they never know or care whether
FLUX, HyperFrames, ElevenLabs, a browser API, or a local placeholder produced it.

## Architecture

```
Agent  --createCapabilityRequest({capability: 'generate_image', input})-->  OmniRoute
                                                                                  |
                                                     ProviderRouter ranks by cost tier
                                                     (local < browser < free < low_cost < premium)
                                                                                  |
                                                                   the ranked provider's execute()
```

Every file here exports one `create*Provider(options)` factory returning the same shape:
`{id, capabilities, tier, healthStatus, successRate, estimateCostUsd, estimateDurationMs, execute}`
(enforced by `defineProvider`, which throws immediately if a provider is missing a required
function — a fast, loud failure at registration time instead of a silent bug at request time).

| Capability | Providers, in priority order |
| --- | --- |
| `generate_text` / `summarize` / `translate` / `reason` / `analyze` | mock (local, free) → Anthropic, Gemini, or any OpenAI-compatible endpoint (GPT, DeepSeek, OpenRouter, local Ollama) |
| `generate_image` / `generate_thumbnail` | mock (local, free) → **FLUX** → OpenAI-compatible image endpoint → *(future local image models)* |
| `generate_video` | mock (local, free) → **HyperFrames** → **Veo** → *(future OpenAI-compatible / local video models)* |
| `generate_speech` | **Browser TTS** (`browser` tier, zero cost, browser-only) → **ElevenLabs** → *(future OpenAI-compatible / local voice models)* |

This ordering is enforced entirely by `tier` (`packages/infrastructure/src/costOptimizer.js`'s
`COST_TIERS = ['local', 'browser', 'free', 'low_cost', 'premium']`), not by any special-casing in
`ProviderRouter` or the Agents — register a new provider with the right tier and it slots into the
waterfall automatically, per `OMNIROUTE_INTEGRATION.md`'s Local-First Policy: "Cache → Local
models → Browser capabilities → Free providers → Low-cost providers → Premium providers."

Two shared internal helpers avoid duplicating logic across providers:
- `providerInterface.js` — the `defineProvider` contract every adapter uses.
- `asyncJobPolling.js` — `pollUntilComplete`, used by every submit-a-job-then-poll-for-completion
  video/image API (FLUX, HyperFrames, Veo). Adding the next async media provider should reuse this
  rather than reimplementing a poll loop.

## Configuration

No provider in this package ever reads `process.env` itself — every credential is injected by the
caller (constructor options), the same rule `anthropicProvider.js` documents: "the API key must be
injected by the caller... If no key is supplied, this provider registers itself as unavailable
rather than throwing." The caller is `apps/omniroute-server` (env-var-driven registration — see
its README's Configuration table for every `*_API_KEY` variable) for anything holding a real
secret, or `apps/web/app.js` for the browser-only Browser TTS provider (it holds no secret, so it
can run client-side).

```js
import { createFluxProvider, createElevenLabsProvider, createBrowserTtsProvider } from '@wcf/providers';

const flux = createFluxProvider({ apiKey: process.env.FLUX_API_KEY });
const elevenLabs = createElevenLabsProvider({ apiKey: process.env.ELEVENLABS_API_KEY });
const browserTts = createBrowserTtsProvider(); // healthStatus reflects whether SpeechSynthesis exists here
```

## Examples

See `packages/providers/test/mediaProviders.test.js` for a full working example of every media
provider's real request/response shape (submit+poll sequences for FLUX/HyperFrames/Veo included),
and `packages/providers/test/providers.test.js` for the text providers. `packages/agents/src/agents/
imageAgent.js`, `videoAgent.js`, and `voiceAgent.js` show the Agent-side call — all three just
request a capability and never reference a provider by name.

## Failure Modes

- **No API key configured**: every real provider reports `healthStatus: 'unavailable'` at
  construction time rather than throwing, so `ProviderRouter` silently skips it and falls through
  to the next tier (down to the always-available local mock providers) — generation never blocks.
- **API call fails (non-2xx, network error, malformed response)**: the provider throws a specific
  error naming the vendor and status code; `executeWithFailover`
  (`packages/infrastructure/src/retryManager.js`) retries, then fails over to the next-ranked
  provider for the same capability, and only surfaces a combined error if every provider fails.
- **Async job (FLUX/HyperFrames/Veo) never completes**: `pollUntilComplete` enforces a bounded
  number of poll attempts (all configurable per provider) and throws a clear timeout error rather
  than hanging a request indefinitely.
- **Async job reports a failure status mid-poll**: surfaced immediately (not after exhausting the
  poll budget) with the vendor's own error message where available.
- **Browser TTS requested outside a browser**: `healthStatus: 'unavailable'`, per above — this is
  the expected, designed-for case in `apps/omniroute-server` (Node), not an error condition.
- **A hung upstream connection**: every real provider's `fetch` call carries an
  `AbortSignal.timeout(...)` (Node's `fetch` has no default timeout of its own) — 30s for
  metadata/generation calls, longer (60s–120s) for calls that transfer real media bytes, so one
  stalled vendor can't tie up a request indefinitely.

## Future Extension Notes

- **Local image/video/voice models** (the "future local models" tier named in
  `docs/architecture/AI_INFRASTRUCTURE.md`) are a natural fit for `openAiCompatibleImageProvider.js`
  once a local server (e.g. an Automatic1111/ComfyUI OpenAI-compatible shim) is available, the same
  way `openAiCompatibleProvider.js` already covers local Ollama text models — no new adapter file
  needed, just a `baseUrl` pointed at `localhost`.
- **HyperFrames' exact API surface was not independently verifiable while writing
  `hyperFramesProvider.js`** — every endpoint path is a configurable option with a documented
  best-guess default. Confirm against HyperFrames' current API reference before relying on it in
  production; see the warning at the top of that file.
- **Browser TTS cannot currently produce a downloadable audio file** — it returns a "speak
  instruction" the frontend executes live (see `browserTtsProvider.js`). Capturing real audio
  bytes would need Web Audio + `MediaRecorder`, deferred as a distinct, non-trivial piece of work.
- **Cost estimates throughout this package are rough, for provider ranking only, not
  billing-accurate** (each file says so explicitly) — replace with real per-vendor pricing tables
  if OmniRoute's Cost Optimizer needs tighter accuracy.
