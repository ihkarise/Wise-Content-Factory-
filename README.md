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
npm test                           # 83 tests across every layer
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
Execution Layer       -> Agent Orchestrator + content Agents
Infrastructure Layer  -> OmniRoute, Provider Router, Cache, MCP Manager, Security Manager, ...
Provider Layer         -> pluggable AI provider adapters (mock, Anthropic, OpenAI-compatible)
Output Layer            -> Content Package (blog posts, captions, video/image/voice placeholders)
```

No Engine or Agent ever calls an AI provider directly — every AI request goes through
`OmniRoute` (`packages/infrastructure`), which caches, ranks providers by cost tier
(local → free → low-cost → premium), and fails over automatically.

## Repository structure

```
docs/architecture/     Every architecture spec (converted from the original .docx/.pdf sources)
packages/core/           Shared schemas: Intent Object, Execution Plan, Capability Request, ...
packages/infrastructure/  OmniRoute, Provider Router, Cache, Cost Optimizer, Retry, MCP Manager + client (NotebookLM), Security Manager
packages/providers/        AI provider adapters (mock/local, Anthropic, OpenAI-compatible)
packages/engines/           Conversation Engine, Intent Engine, Strategy Engine
packages/agents/             Agent Orchestrator + content Agents (research, script, image, video, voice, seo, qa, ...)
apps/web/                     GitHub Pages frontend — zero build step, ES modules + an import map
apps/gateway/                  Google Apps Script secure backend gateway
examples/                       Runnable demo + EXAMPLES.md acceptance-scenario integration tests
```

Every `packages/*` module is plain modern JavaScript (ES modules), zero external runtime
dependencies, tested with Node's built-in test runner — no bundler, no framework, matching the
"lowest practical operating cost" and "never introduce unnecessary complexity" rules in
[`CLAUDE.md`](CLAUDE.md).

## Running for real (with actual AI providers)

1. Deploy the gateway: see [`apps/gateway/README.md`](apps/gateway/README.md) (Google Apps
   Script, deploy config, required secrets).
2. Point the frontend at it: edit `apps/web/config.js`'s `GATEWAY_URL`.
3. Push to `main` — `.github/workflows/deploy-pages.yml` publishes the whole repo to GitHub Pages
   (no build step needed); the app is served from `/apps/web/`.

Until step 2 is done, the frontend runs in a fully offline, zero-cost demo mode using the mock
providers in `packages/providers` — nothing to configure, nothing that costs money.

## Testing

```bash
npm test
```

83 tests across `packages/core`, `packages/infrastructure`, `packages/providers`,
`packages/engines`, `packages/agents`, `apps/gateway` (via a Node `vm` harness that loads the
*actual* `.gs` files with mocked Google Apps Script globals — see
[`apps/gateway/test/gasHarness.mjs`](apps/gateway/test/gasHarness.mjs)), and `examples/` (full
pipeline runs of real scenarios from `docs/architecture/EXAMPLES.md`).

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
cost-tier routing and failover, a real MCP client layer with a NotebookLM integration (generic
stdio + Streamable HTTP JSON-RPC transports, tested against real spawned-process and HTTP MCP
servers — see `packages/infrastructure/src/mcp/README.md`), the secure gateway's
auth/session/secrets/job-queue design, and a working conversational frontend.

**What's still open:** real image/video/voice providers (currently a documented, zero-cost
placeholder — see `packages/providers/src/mockMediaProvider.js`), a durable datastore for Memory
(currently in-process/CacheService-only), and MCP integrations beyond NotebookLM (Filesystem,
GitHub, Google Drive) — all deliberately deferred rather than half-implemented, per `CLAUDE.md`'s
"no placeholder implementations unless explicitly documented as future work."

## License

Not yet chosen — this is a decision for the project owner, not assumed here. `package.json`
currently marks the project `UNLICENSED` (private) as a safe default until that decision is made.
