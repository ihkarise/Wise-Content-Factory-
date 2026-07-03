# Social Publishing Adapters

## Purpose

Implements the "Publishing" agent group and Publishing Factory described in
`docs/architecture/AGENT_ORCHESTRATOR.md` and `docs/architecture/CONTENT_FACTORY.md` — actually
posting finished content to Instagram, Facebook, YouTube, LinkedIn, X, and Threads, not just
formatting it for them. Every platform sits behind one common interface
(`definePublishingProvider` in `publishingProviderInterface.js`), the same "every provider
implements the same interface" rule `packages/providers` already follows for AI vendors — the
Publishing Agent (`packages/agents/src/agents/publishingAgent.js`) never contains
platform-specific logic.

## Architecture

```
Agent Orchestrator  --publishingManager injected into every Agent's ctx, like mcpManager-->
        |
  Publishing Agent  --intent.platforms.forEach-->  PublishingManager.publishToMany(...)
        |                                                    |
        |                                     one PublishingProvider per platform, keyed by
        |                                     provider.platform ("instagram", "facebook", ...)
        v
  publish_receipt asset (per-platform ok/error map) added to the Content Package
```

`PublishingManager` (mirrors `McpManager`) is a registry keyed by platform name, not a
cost-ranked pool like `ProviderRouter` — "publish to Instagram" only ever means the Instagram
provider, there's no interchangeable substitute. `publishToMany` fans a single piece of content
out to several platforms in parallel and never lets one platform's failure abort the others
(`Promise.allSettled`-style), matching the platform-wide "never terminate an entire workflow
because one provider is unavailable" rule.

Two Meta-family helpers are shared across Facebook/Instagram/Threads
(`metaGraphHelpers.js`, since all three speak the same Graph API query-string convention) instead
of being duplicated three times.

**Not wired into automatic campaign planning yet.** The Strategy Engine
(`packages/engines/src/strategyEngine.js`) does not currently emit a `'publishing'` task in
generated execution plans — this PR ships the adapters, the manager, and a registerable
Publishing Agent, but deciding *when* a campaign should auto-publish (which platforms, budget,
approval gating) is a distinct Decision-layer design question left for a deliberate follow-up
rather than folded in here. Until then, construct a plan with a `'publishing'`
`PlannedTask` explicitly (see `packages/agents/test/agents.test.js`) or call
`PublishingManager` directly.

## Configuration

Like every AI provider, no publishing provider reads `process.env` or performs OAuth itself —
credentials (already-issued access tokens/page IDs) are injected by the caller. Acquiring those
tokens (the OAuth authorization-code exchange) is a distinct concern for a future browser/gateway
flow, not something any adapter here does.

```js
import { PublishingManager, createInstagramProvider, createFacebookProvider } from '@wcf/publishing';

const publishingManager = new PublishingManager();
publishingManager.registerProvider(createFacebookProvider({ pageId: '...', accessToken: '...' }));
publishingManager.registerProvider(createInstagramProvider({ igUserId: '...', accessToken: '...' }));

const orchestrator = new AgentOrchestrator({ omniroute, publishingManager });
```

Each provider's required options:

| Provider | Required options |
| --- | --- |
| `createFacebookProvider` | `pageId`, `accessToken` |
| `createInstagramProvider` | `igUserId`, `accessToken` |
| `createThreadsProvider` | `threadsUserId`, `accessToken` |
| `createYoutubeProvider` | `accessToken` |
| `createLinkedinProvider` | `accessToken`, `authorUrn` (`urn:li:person:...` or `urn:li:organization:...`) |
| `createXProvider` | `accessToken` |

Missing options -> `healthStatus: 'unavailable'`, matching every AI provider's convention.

## Examples

See `packages/publishing/test/publishing.test.js` for a full working example of every provider's
real request/response shape, and `packages/agents/test/agents.test.js` (search "Publishing Agent")
for the Agent Orchestrator integration.

```js
const content = { text: 'New PillFill launch!', mediaType: 'image', mediaUrls: ['https://cdn/x.png'] };
const results = await publishingManager.publishToMany(['facebook', 'instagram'], 'publishNow', content);
// { facebook: { ok: true, result: {...} }, instagram: { ok: true, result: {...} } }
```

## Failure Modes

- **No credentials configured**: `healthStatus: 'unavailable'`; `PublishingManager.getProvider`
  throws a clear error rather than silently no-opping, so a caller always knows a platform wasn't
  actually published to.
- **Platform API call fails**: the provider throws with the platform's own error message where
  available; `publishToMany` isolates the failure to that one platform's entry in its result map.
- **`schedulePublish` on a platform with no native scheduling API** (Instagram, Threads, LinkedIn,
  X — only Facebook and YouTube support it natively): the result's `nativelyScheduled: false` and
  a `note` explain that the caller must invoke `publishNow` again at the right time via its own
  job scheduler (e.g. `apps/gateway/JobQueue.gs`'s time-driven-trigger pattern). **Always check
  `nativelyScheduled`** — assuming every platform in this package can natively schedule is the one
  mistake this interface is deliberately designed to prevent silently.
- **LinkedIn/X `createDraft`**: neither platform's public API has a server-side draft concept for
  organic posts, so these never call the API at all — `platformPostId: null` signals nothing was
  created anywhere yet.

## Future Extension Notes

- **Analytics retrieval** (`getAnalytics`) is stubbed to throw "not implemented" on every provider
  — each platform's insights/analytics endpoints (Graph API `/insights`, YouTube Analytics API,
  LinkedIn/X analytics) are real but were out of scope for this pass; add them behind the same
  `getAnalytics(platformPostId)` signature per provider when needed.
- **LinkedIn video and X media beyond simple image upload** are not implemented (LinkedIn video is
  a separate chunked-upload protocol; X media beyond a single image would need the v1.1 chunked
  `INIT`/`APPEND`/`FINALIZE` upload commands) — both are real, documented, larger pieces of work
  deferred rather than half-implemented.
- **Exposing `PublishingManager` over HTTP** (mirroring `apps/omniroute-server`) so `apps/gateway`
  can trigger publishing without holding platform credentials itself is a natural next step once
  there's a real OAuth token-acquisition flow to feed it.
- **Wiring a `'publishing'` task into `packages/engines/src/strategyEngine.js`'s generated plans**
  — see "Architecture" above for why that's deliberately not done in this pass.
