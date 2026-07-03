# Wise Content Factory (WCF)

An AI Content Operating System — turn one idea into a complete, multi-platform marketing
campaign. See [`docs/architecture/PRODUCT.md`](docs/architecture/PRODUCT.md) for the full vision.

> **Status:** early implementation. The text-generation pipeline (Conversation → Intent →
> Strategy → Agent Orchestrator → Content Package) works end to end, offline and for free, using
> local mock providers. Real AI providers, real media generation, and a live gateway deployment
> are wired up and tested but need actual credentials/deployment to go live — see
> [Architecture Review Report](#architecture-review--roadmap) below.

## Try it in 30 seconds (no setup, no API keys)

```bash
npm install
npm run example                    # runs Example 1 from docs/architecture/EXAMPLES.md end to end
npm test                           # 139 tests across every layer
python3 -m http.server 8080        # from the repo root
# open http://localhost:8080/apps/web/  — a working conversational UI, $0 cost
```

## Architecture

Every subsystem follows [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)'s
six-layer model. **Read the docs in the order given in [`CLAUDE.md`](CLAUDE.md) before changing
anything** — it is the master development guide for this repository.

```
Conversation Layer   -> Conversation Engine, Intent Engine
Decision Layer       -> Strategy Engine
Execution Layer       -> Agent Orchestrator + content Agents + Publishing Manager
Infrastructure Layer  -> OmniRoute, Provider Router, Cache, MCP Manager, Security Manager, ...
Provider Layer         -> pluggable AI provider adapters (text, image, video, voice — see packages/providers/README.md)
                          + publishing adapters (Instagram, Facebook, YouTube, LinkedIn, X, Threads
                          — see packages/publishing/README.md)
Output Layer            -> Content Package (blog posts, captions, video/image/voice, publish receipts)
```

No Engine or Agent ever calls an AI provider directly — every AI request goes through
`OmniRoute` (`packages/infrastructure`), which caches, ranks providers by cost tier
(local → free → low-cost → premium), and fails over automatically.

## Repository structure

```
docs/architecture/     Every architecture spec (converted from the original .docx/.pdf sources)
packages/core/           Shared schemas: Intent Object, Execution Plan, Capability Request, ...
packages/infrastructure/  OmniRoute, Provider Router, Cache, Cost Optimizer, Retry, MCP Manager + client (NotebookLM), Security Manager
packages/providers/        AI provider adapters — text, image (FLUX), video (HyperFrames/Veo), voice (Browser TTS/ElevenLabs)
packages/engines/           Conversation Engine, Intent Engine, Strategy Engine
packages/agents/             Agent Orchestrator + content Agents (research, script, image, video, voice, seo, qa, publishing, ...)
packages/publishing/          Social publishing adapters — Instagram, Facebook, YouTube, LinkedIn, X, Threads
apps/web/                     GitHub Pages frontend — zero build step, ES modules + an import map
apps/gateway/                  Google Apps Script secure backend gateway
apps/omniroute-server/          Deployable OmniRoute HTTP gateway (real provider routing/failover)
examples/                       Runnable demo + EXAMPLES.md acceptance-scenario integration tests
```

Every `packages/*` module is plain modern JavaScript (ES modules), zero external runtime
dependencies, tested with Node's built-in test runner — no bundler, no framework, matching the
"lowest practical operating cost" and "never introduce unnecessary complexity" rules in
[`CLAUDE.md`](CLAUDE.md).

## Running for real (with actual AI providers)

1. Deploy the OmniRoute gateway server: see
   [`apps/omniroute-server/README.md`](apps/omniroute-server/README.md) (`npm run omniroute:serve`
   locally, or deploy it anywhere that runs Node — it's a plain `node:http` server, no framework).
2. Deploy the secure Apps Script gateway: see [`apps/gateway/README.md`](apps/gateway/README.md),
   pointing its `OMNIROUTE_ENDPOINT` / `OMNIROUTE_API_KEY` Script Properties at step 1.
3. Point the frontend at it: edit `apps/web/config.js`'s `GATEWAY_URL`.
4. Push to `main` — `.github/workflows/deploy-pages.yml` publishes the whole repo to GitHub Pages
   (no build step needed); the app is served from `/apps/web/`.

Until step 3 is done, the frontend runs in a fully offline, zero-cost demo mode using the mock
providers in `packages/providers` — nothing to configure, nothing that costs money.

## Testing

```bash
npm test
```

139 tests across `packages/core`, `packages/infrastructure`, `packages/providers`,
`packages/publishing`, `packages/engines`, `packages/agents`, `apps/gateway` (via a Node `vm`
harness that loads the *actual* `.gs` files with mocked Google Apps Script globals — see
[`apps/gateway/test/gasHarness.mjs`](apps/gateway/test/gasHarness.mjs)), `apps/omniroute-server`
(against a real listening `http.Server`), and `examples/` (full pipeline runs of real scenarios
from `docs/architecture/EXAMPLES.md`).

## Architecture Review & Roadmap

This repository started as documentation only. Before any code was written, every architecture
document was read, cross-referenced, and reviewed for contradictions, gaps, security weaknesses,
scalability bottlenecks, and cost risks — see the review that was produced and approved before
implementation began. Notable findings already addressed in this codebase:

- `INTENT_ENGINE.md` was referenced everywhere but never written — added at
  `docs/architecture/INTENT_ENGINE.md`.
- `KNOWLEDGE_ENGINE.md` and `CONTENT_FACTORY.md` existed under misleading filenames
  (`Wise Content Factory (WCF).pdf`, `Wise Content Factory Specification (2).docx`) — recovered
  and renamed.
- The docs disagreed on the deployment target (Windows desktop vs. GitHub Pages + Google Apps
  Script) — this build follows the GitHub Pages + Apps Script gateway target.
- `SECURITY_ARCHITECTURE.md` was missing from the mandatory reading order despite claiming
  precedence on security decisions — added back to `CLAUDE.md`'s and `BUILD_DIRECTIVE.md`'s
  reading order.
- Google Apps Script's real limitations (6-minute execution ceiling, `PropertiesService` not
  being a secrets vault, no atomic rate limiting) are handled explicitly, not glossed over — see
  `apps/gateway/README.md`.

**What's genuinely done:** the full text-content pipeline, provider abstraction with automatic
cost-tier routing and failover across real text providers (Anthropic, Gemini, and any
OpenAI-compatible endpoint — GPT, DeepSeek, OpenRouter, local Ollama models) *and* real media
providers (images: FLUX, OpenAI-compatible; video: HyperFrames, Veo; voice: Browser TTS,
ElevenLabs — see `packages/providers/README.md`), real social publishing adapters for Instagram,
Facebook, YouTube, LinkedIn, X, and Threads behind one common interface with a registerable
Publishing Agent (`packages/publishing/README.md`), a deployable OmniRoute gateway server that
registers real providers from environment variables (`apps/omniroute-server` — see its README), a
real MCP client layer with a NotebookLM integration (generic stdio + Streamable HTTP JSON-RPC
transports, tested against real spawned-process and HTTP MCP servers — see
`packages/infrastructure/src/mcp/README.md`), the secure gateway's auth/session/secrets/job-queue
design, and a working conversational frontend.

**What's still open:** wiring an automatic `'publishing'` task into the Strategy Engine's
generated plans (today the Publishing Agent exists and works but must be invoked explicitly — see
`packages/publishing/README.md`'s Architecture section for why that's a deliberate, separate
decision), a durable datastore for Memory (currently in-process/CacheService-only), bridging the
`search_knowledge` capability to the MCP Manager inside OmniRoute itself (today Agents call
`mcpManager` directly instead — see `apps/omniroute-server/README.md`'s Future Extension Notes),
local image/video/voice models, and MCP integrations beyond NotebookLM (Filesystem, GitHub, Google
Drive) — all deliberately deferred rather than
half-implemented, per `CLAUDE.md`'s
"no placeholder implementations unless explicitly documented as future work."

## License

Not yet chosen — this is a decision for the project owner, not assumed here. `package.json`
currently marks the project `UNLICENSED` (private) as a safe default until that decision is made.
