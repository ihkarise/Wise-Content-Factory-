# Persistent Memory

## Purpose

Implements the Memory subsystem described in `docs/architecture/PLATFORM_ARCHITECTURE.md`
("Memory Architecture": "Memory exists independently from AI providers... Memory should survive
application restarts") and `CLAUDE.md`'s Memory Rules ("Memory exists at Global, Brand, Project,
Conversation, Generation Cache. Never duplicate stored knowledge. Always reuse existing memory.").
Before this package, `apps/web/app.js` held `brandMemory`/`projectMemory`/`conversationMemory` as
plain in-process objects that vanished on page reload — real, but not persistent. This package is
the durable storage layer underneath that same shape.

## Architecture

```
Engines/Agents (e.g. buildConversationContext({ brandMemory, projectMemory, conversationMemory }))
        ^
        | memoryManager.read('brand', brandId).data  — same plain-object shape as before,
        |                                               just sourced from a real backend now
MemoryManager  --routes by collection-->  one MemoryProvider per collection (or a shared default)
        |
        +-- in-memory / local-JSON   (dev, offline)
        +-- PropertiesService        (global config only — apps/gateway/Memory.gs is the real
        |                             GAS-runtime implementation; the Node adapter here is for
        |                             tests and any Node-side tooling)
        +-- Google Drive             (documents/assets)
        +-- Google Sheets            (structured Brand/Project/Campaign metadata)
```

Every provider implements `defineMemoryProvider`'s interface (`memoryProviderInterface.js`) —
`read/write/update/delete/search/list/semanticSearch` — the same "every provider implements the
same interface" rule `packages/providers` and `packages/publishing` already follow.
`MemoryManager` (`memoryManager.js`) is a collection-keyed registry, mirroring `PublishingManager`:
"store Assets in Drive, Brand/Project/Campaign in Sheets, Global config in PropertiesService" is a
deliberate per-collection choice, not a cost-ranked fallback chain like `ProviderRouter`. Register
one provider with no `collections` option and it becomes the fallback for anything unassigned.

**Records, not raw values.** Every read/write returns a `MemoryRecord`
(`memoryRecord.js`) — `{collection, key, data, tags, relationships, metadata, version,
previousVersions, audit}` — regardless of backend. `applyMemoryUpdate` (shared by every adapter's
`update()`) is the one place versioning/history logic lives, so it behaves identically whether the
record came from a Map, a JSON file, a Drive document, or a Sheets row.

**Collection shape conventions**, not enforced schemas. `collections.js` exports
`MEMORY_COLLECTIONS` and optional `create*MemoryData` factories (`createBrandMemoryData`,
`createProjectMemoryData`, `createCampaignMemoryData`, `createConversationMemoryData`) that fill in
the fields listed in the brief (Brand Identity/Voice/Style/..., Project's uploaded/generated
assets, Campaign's prompt/strategy/cost, Conversation's context/preferences/workflow state) — the
same convenience role `packages/core/src/schemas/*.js`'s `create*` factories play elsewhere.
`MemoryManager` never inspects `data`'s shape; using these factories is optional.

**Caching.** `MemoryManager` optionally wraps `read()` in any `CacheStore`-shaped store (the exact
`{get,set,has,delete}` contract `packages/infrastructure`'s `createInMemoryCacheStore` already
implements — reused, not duplicated), invalidated automatically on `write`/`update`/`delete` for
that key. This satisfies "Support caching. Avoid duplicate storage. Optimize reads." without a
second caching implementation.

## Configuration

No provider reads `process.env` or acquires its own credentials — same rule every AI/publishing
provider in this repo follows.

```js
import { MemoryManager } from '@wcf/memory';
import {
  createInMemoryMemoryProvider,
  createGoogleDriveMemoryProvider,
  createGoogleSheetsMemoryProvider,
} from '@wcf/memory';
import { createInMemoryCacheStore } from '@wcf/infrastructure';

const memoryManager = new MemoryManager({ cacheStore: createInMemoryCacheStore() });
memoryManager.registerProvider(
  createGoogleSheetsMemoryProvider({ spreadsheetId: '...', accessToken: '...' }),
  { collections: ['brand', 'project', 'campaign'] }
);
memoryManager.registerProvider(
  createGoogleDriveMemoryProvider({ accessToken: '...', folderId: '...' }),
  { collections: ['asset'] }
);
memoryManager.registerProvider(createInMemoryMemoryProvider()); // default: conversation, promptLibrary, templateLibrary, knowledgeCache
```

| Provider | Required options | Scope |
| --- | --- | --- |
| `createInMemoryMemoryProvider` | none | dev/testing, no persistence |
| `createLocalJsonMemoryProvider` | `filePath` | offline dev, single-process |
| `createPropertiesServiceMemoryProvider` | a GAS runtime, or an injected `propertiesService` | **global config only** — small values, low volume |
| `createGoogleDriveMemoryProvider` | `accessToken`, `folderId` | documents/assets |
| `createGoogleSheetsMemoryProvider` | `accessToken`, `spreadsheetId` | structured metadata |

For the live Apps Script gateway, `apps/gateway/Memory.gs` is the real PropertiesService
implementation (GAS can't `import` this package — see that file's header comment); it exposes
`memoryRead_`/`memoryWrite_`/`memoryUpdate_`/`memoryDelete_`/`memoryList_`/`memorySearch_` as
plain global functions, tested via `apps/gateway/test/gasHarness.mjs`.

## Examples

See `packages/memory/test/memory.test.js` (record shape, manager routing/caching, in-memory and
real-disk local-JSON persistence, `create*MemoryData` factories) and
`packages/memory/test/memoryProviders.test.js` (PropertiesService/Drive/Sheets against real
request/response shapes with injectable fetch — not mocks of this package's own internals).

```js
await memoryManager.write('brand', 'pillfill', createBrandMemoryData({ identity: 'PillFill', voice: 'friendly' }));
const brand = await memoryManager.read('brand', 'pillfill');
// Drop straight into the existing Conversation Engine — no changes needed there:
buildConversationContext({ message, brandMemory: { brands: [...], activeBrandId: brand?.key } });
```

## Failure Modes

- **No provider registered for a collection (and no default)**: `MemoryManager.getProvider` throws
  immediately, naming the collection — never a silent no-op that loses data.
- **Provider not configured** (missing credentials): `healthStatus: 'unavailable'`;
  `MemoryManager` throws before attempting the call, same pattern as every AI/publishing provider.
- **`update()` on a key that was never `write()`-ed**: every adapter throws a clear "no record"
  error rather than creating a partial record from just the patch.
- **Google Sheets has no true row deletion**: `delete()` is a soft delete (a `deleted` column),
  documented in `providers/googleSheetsProvider.js` — real row deletion via `batchUpdate`
  `deleteDimension` would shift every subsequent cached row index, trading a contained,
  well-understood limitation for a much more fragile one.
- **Local JSON provider is single-process**: concurrent writes from the *same* process are
  serialized (a promise chain, not a lock file); concurrent writes from two separate processes
  pointed at the same file can race. Fine for local dev/CLI use, not for multi-instance deployment
  — use Drive/Sheets/a real database there.
- **PropertiesService size limits**: ~9KB per property, ~500KB total — this adapter is explicitly
  scoped to `global` config only; using it for Brand/Project/Asset-scale data will hit those limits.
- **`search`/`list` read every candidate record into memory to filter** (`matchesQuery` runs
  client-side against whatever the backend returns) — correct and simple at this platform's actual
  scale, not a query planner. Semantic/full-text search at scale is the documented next step below.

## Future Extension Notes

- **`semanticSearch`** is stubbed to throw "not implemented" everywhere (matches `getAnalytics` in
  `packages/publishing`) — a real implementation would embed `data` and query against a vector
  index; natural to add once `packages/infrastructure`'s OmniRoute exposes an embeddings
  capability.
- **Additional backends** (SQLite, PostgreSQL, Supabase, Firestore) only need to implement
  `defineMemoryProvider`'s six required functions — nothing in `MemoryManager`, the Engines, or the
  Agents needs to change, which is the entire point of this interface.
- **Wiring `MemoryManager` into `apps/web`** to replace its current static in-process
  `brandMemory`/`projectMemory`/`conversationMemory` objects is a natural next step, but requires a
  server-side credential source (Drive/Sheets need an access token the browser must never hold —
  see `docs/architecture/SECURITY_ARCHITECTURE.md`), so it belongs behind `apps/gateway` or
  `apps/omniroute-server`, not wired directly into the static frontend. Deferred here to keep this
  PR focused on the storage layer itself.
- **Relationship-based queries** (e.g. "all campaigns for this project") currently require a
  `search` with a matching `relationships` value checked via a custom `textContains`/tag
  convention — a first-class `relationships` query operator would be a small, backward-compatible
  addition to `MemoryQuery` if usage patterns call for it.
