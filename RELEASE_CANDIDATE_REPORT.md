# Wise Content Factory — Release Candidate Report

**Report date:** 2026-07-03
**Recommended version:** `v1.0.0-rc.1`
**Scope:** Production hardening pass across security, error handling, logging, configuration,
deployment, performance, startup reliability, dependency management, documentation, onboarding,
installation, backup/recovery, upgrade path, cross-platform compatibility, accessibility, and
CI/CD (GitHub Actions, GitHub Pages, Google Apps Script deployment).

This pass added **no new functionality** and changed **no public API** except where a fix
required it (see "Improvements Made" for the one addition: an exported `timingSafeEqualStrings`
helper). It reviewed and hardened the implementation completed across the prior six sessions
(NotebookLM MCP → OmniRoute → real AI providers → media generation → social publishing →
persistent memory).

---

## 1. Executive Summary

Wise Content Factory's implementation is architecturally complete against every layer defined in
`docs/architecture/ARCHITECTURE.md`, with real (not mocked) integrations for text/image/video/voice
AI generation, six social publishing platforms, and a five-backend persistent Memory subsystem —
all behind consistent, provider-independent interfaces, all covered by an automated test suite
that exercises real request/response shapes rather than internal mocks.

This RC1 pass found and fixed **two genuine production bugs** (a memory leak and a cache-poisoning
race condition class that appeared in three separate call sites), one **real security weakness**
(non-constant-time secret comparison, fixed in two places), several **reliability gaps** (no fetch
timeouts, no graceful shutdown), a handful of **duplicate-code** violations of the project's own
"never duplicate business logic" rule, and a small number of **accessibility** defects in the
reference frontend. All were fixed. None required an architecture change or a public API change.

The codebase is **not yet live** — it has no deployed OmniRoute server, no deployed Apps Script
gateway, and no configured provider credentials anywhere. Every fix and every test in this report
was verified against real request/response shapes and real local I/O (spawned processes, real
HTTP servers, real disk files), not against a live deployment, because none exists yet. Going live
is an infrastructure/credentials exercise, not a code readiness question — that gap is scoped
explicitly under "Remaining Risks" and the "Deployment Checklist."

**Bottom line:** the codebase is sound, tested, and hardened enough to serve as a Release
Candidate. It is not yet "Ready for Production" only because production readiness for *this*
system is inseparable from an actual deployment with real credentials and real traffic, which has
never happened. See Recommendation (§10).

---

## 2. Improvements Made

### Security

- **Fixed a non-constant-time secret comparison in two places**: `apps/gateway/Router.gs`'s owner
  passphrase check (`!==`) and `apps/omniroute-server/server.js`'s Bearer-token check (`===`) both
  now use constant-time comparison. `timingSafeEqualStrings` (previously a private helper inside
  `packages/infrastructure/src/securityManager.js`, used only for HMAC signature verification) was
  exported so the server could reuse it instead of duplicating the logic; the GAS-side `.gs` fix
  reuses the `timingSafeEqual_` helper that already existed there for the same reason. This is the
  one public API addition in this pass — an export, not a new module, and purely additive.
- Verified: no secrets in git history beyond `.example` files; `.env`/`.clasp.json` correctly
  gitignored; `npm audit` reports 0 vulnerabilities (0 external runtime dependencies exist in the
  first place); no hardcoded API keys/tokens found anywhere in source.
- Verified every provider (AI, publishing, memory) still follows the existing "no key ⇒
  `healthStatus: 'unavailable'`, never throws at construction" convention — confirmed, not changed.

### Reliability / Race Conditions

- **Fixed a cache-poisoning bug present in three separate call sites**: `localJsonProvider.js`'s
  disk-write queue and its store-load cache, and `googleSheetsProvider.js`'s row-index cache, all
  memoized a promise the first time they were called and never re-tried it — meaning a single
  *transient* failure (a momentary disk error, a momentary network blip) would permanently poison
  every future operation on that provider instance with the same stale error, even after the
  underlying problem resolved. Each of the three sites now clears its cached promise on failure so
  the next call gets a fresh attempt. Added a regression test for each of the two provider files
  that reproduces the exact failure sequence (fail once, verify the *next* call succeeds).
- **Added graceful shutdown to `apps/omniroute-server`**: `SIGTERM`/`SIGINT` now stop accepting new
  connections and let in-flight requests finish (with a 10s hard-exit fallback) instead of the
  process dying mid-request — matters for rolling deploys and container orchestrators.
- **Added timeouts to every outbound provider HTTP call** (`AbortSignal.timeout(...)`, ~15 files
  across `packages/providers`, `packages/publishing`, `packages/memory`): Node's `fetch` has no
  default timeout, so a stalled upstream vendor could previously tie up a request — and the
  connection behind it — indefinitely. Metadata/generation calls get 30s; calls that transfer real
  media bytes (video/image upload or download) get a longer, separate budget (60s–180s depending
  on expected payload size).

### Performance / Memory

- **Fixed an unbounded memory leak in `ObservabilityLog`**: `apps/omniroute-server` keeps one
  `OmniRoute` (and therefore one `ObservabilityLog`) instance alive for the server's entire
  lifetime; every request appended one event with no eviction, growing without bound for as long
  as the process ran. Now bounded to the most recent 1000 events (configurable), oldest dropped
  first.
- **Fixed an unbounded memory leak in `CacheEngine`'s in-memory store**: TTL only expired entries
  lazily on `get`, so keys that were `set` once and never revisited (realistic for a server serving
  many distinct prompts) accumulated forever. Now bounded to 5000 entries (configurable), oldest
  evicted first once the cap is hit.
- Both fixes are purely additive (new optional constructor options with defaults that preserve
  prior behavior at any scale this codebase's own test suite exercises); no existing behavior at
  normal scale changed.

### Duplicate Code (CLAUDE.md: "never duplicate business logic")

- Four memory providers (`recordStore.js`, `propertiesServiceProvider.js`,
  `googleDriveProvider.js`, `googleSheetsProvider.js`) each independently reimplemented the same
  "bump version, snapshot history, carry audit forward" logic inline in their `write()` methods.
  Factored into one shared `nextMemoryRecordVersion()` in `memoryRecord.js`; all four now call it.
- Three publishing providers (`xProvider.js`, `linkedinProvider.js`, `youtubeProvider.js`) each
  defined an identical `safeText(response)` helper. Factored into `packages/publishing/src/httpHelpers.js`.

### Accessibility

- The main prompt `<textarea>` had only a placeholder for identification (placeholders are not an
  accessible name) — added `aria-label="Describe what you want to create"`.
- The same textarea explicitly set `outline: none` with **no replacement focus style anywhere in
  the stylesheet** — a genuine WCAG 2.4.7 (Focus Visible) failure and a direct violation of this
  project's own Design Rule ("Support keyboard navigation"). Added a `:focus-within` ring on the
  input's container. Verified visually via a real headless-browser screenshot — see the session
  transcript.
- Added `autocomplete="current-password"` to the passphrase field (a minor UX/password-manager
  improvement, no behavior change).

### Error Handling / Weak Error Messages

- `apps/web/gatewayClient.js` didn't check `response.ok` before parsing JSON, and an unparseable
  response would surface a cryptic native `SyntaxError` to the user. Added an explicit
  `response.ok` check with an actionable message and a try/catch around JSON parsing with a clear
  fallback error.
- `apps/web/gatewayClient.js`'s `localStorage` calls (`getStoredSessionToken`/`storeSessionToken`/
  `clearSessionToken`) could throw in some browser configurations (storage disabled, certain
  private-browsing modes) and were unguarded. Wrapped in try/catch so a storage failure degrades to
  "not signed in" instead of crashing the caller.

### CI/CD, Deployment Automation

- `ci.yml`: switched `npm install` → `npm ci` (reproducible, lockfile-verified installs — the
  correct choice for CI); added `permissions: contents: read` (least-privilege default — this
  workflow only reads and tests, it never needs write access); added `cache: npm` to
  `actions/setup-node` (faster runs); added `timeout-minutes: 10` (a hung step no longer runs
  indefinitely); added an `npm audit --omit=dev` step (trivially clean today given zero runtime
  dependencies, but now a real gate against future dependency additions).
- `deploy-pages.yml`: added `timeout-minutes: 10` to the deploy job for the same reason.
- Added `.nvmrc` (pinned to Node 20, matching CI) so local development can't silently drift onto an
  incompatible Node version.

### Documentation / Versioning

- Bumped root `package.json` version to `1.0.0-rc.1` (from `0.1.0`) to reflect this pass.
- Updated the root `README.md` status banner, test counts (171, up from 165 at the start of this
  pass), and Failure-Modes sections in `apps/omniroute-server/README.md` and
  `packages/providers/README.md` to describe the new timeout/shutdown behavior.

### Verification

Every fix above was verified, not just written:
- Full automated suite: **171/171 passing** (was 165 at the start of this pass; +6 net new tests
  covering the fixes above, after accounting for tests already added mid-pass).
- `npm run example` (the offline end-to-end pipeline demo): still produces correct output.
- `apps/web` demo mode: re-verified in a real headless Chromium session — no console errors, full
  pipeline still completes, focus ring renders correctly, `aria-label` present in the DOM.
- `apps/omniroute-server`: started as a real process, `curl`-tested `/health`, sent a real
  capability request end-to-end, then sent `SIGTERM` and confirmed the port stopped accepting
  connections immediately after in-flight work completed.
- `npm ci` and `npm audit --omit=dev` both run clean locally (matching the new CI steps).

---

## 3. Remaining Risks

Ranked roughly by what would actually hurt in production:

1. **Never deployed.** No OmniRoute server, no Apps Script gateway, and no GitHub Pages deployment
   has ever run with real traffic or real credentials. All correctness evidence is from tests
   against real protocol shapes (real HTTP servers, real spawned processes, real disk I/O), not
   from a live system under load. First real deployment should be treated as a first production
   rollout, not a formality.
2. **HyperFrames' exact API surface was never independently verified** (documented in
   `hyperFramesProvider.js` and `packages/providers/README.md` since it was written) — every
   endpoint path is configurable specifically because of this uncertainty. Confirm against
   HyperFrames' current API reference before routing real traffic through it.
3. **No load/performance testing has been done.** The new timeout values (30s/60s/120s/180s) and
   cache/log bounds (5000 entries / 1000 events) are reasoned defaults, not tuned against
   measured production traffic patterns.
4. **`apps/gateway`'s known, pre-existing limitations remain** (documented there already, not
   newly discovered): `CacheService`-based rate limiting is not atomic under concurrent requests;
   auth is single-owner-passphrase, not per-user; `PropertiesService` is not a real secrets vault
   (mitigated by application-level encryption, not eliminated). All are explicitly scoped as
   acceptable for a v1 single-owner/small-team deployment in `SECURITY_ARCHITECTURE.md` and
   `apps/gateway/README.md` — re-evaluate before scaling past that.
5. **In-memory/local-JSON Memory providers are single-process only** — fine for dev/CLI use
   (their documented purpose), not safe as a production store if the platform ever runs multiple
   instances.
6. **Google Sheets Memory provider has no true row deletion** (soft-delete only, by design — see
   its file header) — acceptable, but means a Sheet will accumulate soft-deleted rows over time
   with no built-in reclamation.
7. **No monitoring/alerting/APM.** `ObservabilityLog` is an in-memory ring buffer with no export to
   a real log/metrics sink. Fine for the current scale and explicitly documented as "swap for a
   real sink in production," but there is currently no visibility into a live deployment beyond
   whatever `console.log`/`console.error` output the host process captures.
8. **No SAST/CodeQL scanning in CI** — reasonable today given zero external runtime dependencies
   and a small, fully-reviewed codebase, but worth adding before the codebase grows.

## 4. Known Limitations

These are scope boundaries, not defects — each is already documented at its point of origin and
is repeated here only for a single consolidated view:

- `search_knowledge` capability is not bridged into OmniRoute's unified request path — Agents call
  `mcpManager` directly for knowledge retrieval instead (`apps/omniroute-server/README.md`).
- Publishing is not wired into the Strategy Engine's automatic plan generation — the Publishing
  Agent exists and works but must be invoked explicitly (`packages/publishing/README.md`).
- `MemoryManager` is not wired into `apps/web` — Drive/Sheets backends need a server-side
  credential the browser must never hold (`packages/memory/README.md`).
- LinkedIn video upload and X multi-media upload beyond a single image are not implemented
  (documented, deferred as distinct chunked-upload protocols).
- No local image/video/voice model adapters yet (the "future local models" tier named in
  `AI_INFRASTRUCTURE.md`) — the OpenAI-compatible adapters are a natural fit once such a service
  exists locally.
- No license has been chosen (`package.json` remains `UNLICENSED`) — a deliberate open business
  decision noted in the README, not an oversight.
- Semantic/vector search (`semanticSearch` on Memory providers, analytics retrieval on Publishing
  providers) are documented future-ready stubs that throw "not implemented."

## 5. Deployment Checklist

- [ ] Choose and set a license (currently `UNLICENSED`).
- [ ] Deploy `apps/omniroute-server` (`npm run omniroute:serve` or any Node host) with real
      provider credentials as environment variables; confirm `/health` reports the expected
      provider list.
- [ ] Set `OMNIROUTE_API_KEY` on the OmniRoute server **before** exposing it beyond localhost (it
      runs unauthenticated otherwise, by design, for local dev).
- [ ] Deploy `apps/gateway` via `clasp` (see `apps/gateway/README.md`); set
      `SESSION_SIGNING_SECRET`, `SECRET_ENCRYPTION_PASSPHRASE`, `OWNER_PASSPHRASE` (encrypted via
      `Secrets.gs`), and `OMNIROUTE_ENDPOINT`/`OMNIROUTE_API_KEY` pointing at the deployed server.
- [ ] Confirm the Apps Script Web App deployment settings match `apps/gateway/README.md`'s
      documented choice (`Execute as: USER_DEPLOYING`, `Access: ANYONE_ANONYMOUS`) — these
      materially change the security model if changed.
- [ ] Point `apps/web/config.js`'s `GATEWAY_URL` at the deployed Web App URL.
- [ ] Push to `main`; confirm `deploy-pages.yml` runs the CI test gate and then deploys
      successfully to GitHub Pages.
- [ ] Smoke-test the live deployment end to end: log in, submit a real prompt, confirm a real
      (non-mock) asset is produced and (if publishing credentials are configured) actually
      publishes.
- [ ] Register real Memory providers (Drive/Sheets/PropertiesService) server-side if persistent
      memory is needed for this deployment; confirm with a real write/read round-trip.
- [ ] Rotate `SECRET_ENCRYPTION_PASSPHRASE` and `OMNIROUTE_API_KEY` out of band from source control
      (they are deploy-time secrets, never committed).

## 6. Security Checklist

- [x] No secrets committed to git (verified: only `.example` files tracked; `.env`/`.clasp.json`
      gitignored).
- [x] `npm audit` clean (0 vulnerabilities — 0 external runtime dependencies).
- [x] All secret/token/passphrase comparisons are constant-time (`timingSafeEqualStrings` /
      `timingSafeEqual_`) — fixed in this pass in both places that weren't.
- [x] Every provider redacts secret-like keys before logging (`redact`/`redact_`, both
      independently implemented and tested for Node and GAS runtimes).
- [x] Browser never holds a provider API key — only a short-lived signed session token
      (`docs/architecture/SECURITY_ARCHITECTURE.md`'s core invariant; unchanged and re-verified in
      this pass).
- [x] Input validation on every network boundary: `validateCapabilityRequest` on OmniRoute
      requests, JSON body size cap (1MB) on the OmniRoute server, session/permission checks on
      every non-login gateway action.
- [x] Rate limiting present on the gateway (documented non-atomic limitation, acceptable at
      current scale, not newly introduced).
- [ ] **Not yet done**: a live deployment to actually penetration-test. Everything above is
      verified by code review and unit/integration tests against real protocol shapes, not by
      testing a running production system.
- [ ] **Not yet done**: dependency/SAST scanning beyond `npm audit` (see Remaining Risks §8).

## 7. Performance Checklist

- [x] No unbounded in-memory growth in any long-running process path — `ObservabilityLog` and
      `CacheEngine`'s in-memory store are both now bounded (fixed in this pass).
- [x] No outbound HTTP call can hang a request indefinitely — every provider fetch now carries a
      timeout (fixed in this pass).
- [x] Cost-tier routing (cache → local → browser → free → low-cost → premium) verified still
      correct via the existing `ProviderRouter`/`rankProviders` test coverage — unchanged, re-run
      and confirmed passing.
- [x] Cache-hit path verified to skip provider execution entirely (existing `OmniRoute` test,
      re-confirmed).
- [x] Local-JSON Memory provider writes are serialized (no interleaved/corrupted writes from
      concurrent operations within one process) and now also resilient to a single transient
      failure (fixed in this pass).
- [ ] **Not yet done**: real load testing / concurrency testing under production-like traffic.
- [ ] **Not yet done**: profiling for CPU/latency hotspots under real usage — no bottleneck is
      known or suspected today at the codebase's current scale, but none has been measured either.

## 8. Production Readiness Score

**7.5 / 10**

| Dimension | Score | Rationale |
| --- | --- | --- |
| Architecture & code quality | 9/10 | Consistent interfaces across every layer, zero external runtime dependencies, no dead code found, duplicate logic found and eliminated this pass. |
| Test coverage | 8/10 | 171 tests, all against real protocol shapes/real I/O, not internal mocks. No load/concurrency/E2E-in-CI coverage. |
| Security | 8/10 | Sound design (session tokens, redaction, encryption-at-rest for secrets, constant-time comparisons now fixed), but never battle-tested against a live deployment or external review. |
| Reliability | 7/10 | Memory leaks and cache-poisoning bugs found and fixed this pass; graceful shutdown and timeouts added; but no production traffic history exists to validate any of it under real conditions. |
| Documentation | 9/10 | Every package has Purpose/Architecture/Configuration/Examples/Failure Modes/Future Extension Notes; root README is current and accurate. |
| Deployment readiness | 5/10 | Deployment path is fully documented and automatable, but has never actually been exercised end to end against live infrastructure. |
| Operational maturity | 4/10 | No monitoring/alerting/APM, no SAST scanning, no load testing — appropriate gaps to close *after* choosing a real deployment target, not before. |

## 9. Recommended Version Number

**`v1.0.0-rc.1`**

Rationale: the architecture and feature set are complete and stable against the approved
specification (no functionality added or changed in this pass, only hardening); the interfaces are
public-API-stable enough to commit to a `1.0.0` line; the `-rc.1` suffix is honest about the one
gap that matters most — this has never run against live infrastructure. Move to `v1.0.0` once the
Deployment Checklist (§5) is completed against a real environment and the smoke test passes there.

## 10. Recommendation

**Ready for Release Candidate.**

Not yet "Ready for Production" — not because of any known defect, but because "production ready"
is not a property source code can fully earn on its own for a system whose entire value
proposition is calling out to a dozen external vendor APIs and a real Google Apps Script
deployment. That claim can only be substantiated by actually deploying and exercising it, which
has not yet happened.

Not merely "Ready for Beta" either — a beta connotes known rough edges expected to surface under
real usage. This pass specifically hunted for and closed the classes of rough edges a beta would
otherwise surface (leaks, race conditions, timing attacks, timeouts, accessibility, duplicate
logic) rather than deferring them to be found live.

**Suggested next step**: work through the Deployment Checklist (§5) against a real (even if
small-scale/single-owner) environment, run the smoke test end to end with real provider
credentials, then re-evaluate for `v1.0.0`.

---

*Per the operating instructions for this pass: no new functionality was added, no architecture was
redesigned, and the only public API change was a strictly additive export
(`timingSafeEqualStrings`) required to fix a real security weakness without duplicating code.
Stopping here for approval before any new feature development begins.*
