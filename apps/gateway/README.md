# Wise Content Factory — Google Apps Script Secure Gateway

Implements the backend half of the deployment target chosen in the Architecture Review Report
(Contradiction #1): `Browser -> GitHub Pages (static) -> this Apps Script Gateway -> OmniRoute -> AI Providers`.
See `docs/architecture/SECURITY_ARCHITECTURE.md` and `docs/architecture/BUILD_DIRECTIVE.md`.

## Why these files aren't ES modules

The rest of this repository (`packages/*`) is plain modern JavaScript using `import`/`export`.
Google Apps Script's V8 runtime does **not** support `import`/`export` across `.gs` files — every
file in an Apps Script project is concatenated into one shared global scope. So this directory
deliberately does **not** import `packages/*` directly; it re-implements the small amount of logic
it actually needs (session signing, redaction, rate limiting) in plain global functions. If you
change the token format in `packages/infrastructure/src/securityManager.js`, update `Auth.gs` to
match. The two are independent implementations for independent runtimes (Node vs. GAS's
`Utilities` service) — `test/gateway.test.mjs` exercises `Auth.gs`'s own round-trip, it does not
cross-verify tokens between the two implementations.

## Deployment configuration (read this before deploying)

The Architecture Review Report's Security Review flagged that GAS Web App deployment settings
materially change the security model, and that the original docs never specified them. This
project pins:

- **Execute as: `USER_DEPLOYING`** (the developer's identity) — *not* `USER_ACCESSING`. This is a
  deliberate choice for a v1 single-owner/small-team product (see PRODUCT.md's actual primary
  user): every request runs with the deploying developer's Google account permissions, so any
  Drive/Sheets access inside the script works uniformly for anonymous frontend visitors, without
  requiring every visitor to have a Google account. **This means the deployer's Google account is
  the blast radius if the gateway is compromised** — do not grant it more Drive/Sheets/Workspace
  access than this script actually needs.
- **Access: `ANYONE_ANONYMOUS`** — the GitHub Pages frontend is a public static site with no
  Google sign-in step, matching PRODUCT.md's "simple, one-click" UX principle. Authentication is
  instead handled by this gateway's own signed-session-token scheme (`Auth.gs`), not Google
  Identity.

If your deployment needs stronger isolation (e.g. multiple untrusted tenants), switch to
`USER_ACCESSING` and require Google sign-in in the frontend instead — that is a real architectural
change, not a config tweak, so treat it as a deliberate decision, not a default.

## Known limitations (see the Architecture Review Report, Security Review)

- **Script Properties is not a secrets vault.** `Secrets.gs` adds an application-level encryption
  layer on top of `PropertiesService` so a leaked properties export isn't immediately usable, but
  this is defense-in-depth, not a substitute for a real secrets manager. Rotate the encryption
  passphrase itself out of band (e.g. as an environment variable in your deploy tooling), never
  commit it.
- **6-minute execution ceiling.** `JobQueue.gs` implements the enqueue-and-poll pattern recommended
  in the Security Review specifically so no single request ever needs to run a full generation
  synchronously inside one Apps Script invocation.
- **Rate limiting uses `CacheService` counters**, which are not atomic under concurrent invocations
  — acceptable for a single-owner v1 deployment, called out explicitly rather than presented as a
  hardened production rate limiter. Move this to OmniRoute if/when real multi-tenant traffic
  arrives.

## Local development / testing

These files can't run standalone in Node (they rely on GAS globals like `PropertiesService`,
`CacheService`, `UrlFetchApp`, `Utilities`, `ContentService`). `test/gateway.test.mjs` loads each
`.gs` file's source into a Node `vm` context with those globals mocked, so the actual logic is unit
tested without needing `clasp` or a live deployment.

## Deploying

1. Install `clasp` (`npm i -g @google/clasp`) and `clasp login`.
2. Copy `.clasp.json.example` to `.clasp.json` and fill in your Script ID (`.clasp.json` is
   git-ignored — never commit it, it can contain project identifiers).
3. `clasp push` from this directory, then `clasp deploy`.
4. Set required Script Properties (`clasp open` → Project Settings → Script Properties, or
   `PropertiesService.getScriptProperties().setProperties({...})` from the Apps Script editor):
   - `SESSION_SIGNING_SECRET` — random 32+ byte string, used to sign session tokens.
   - `SECRET_ENCRYPTION_PASSPHRASE` — random 32+ byte string, used by `Secrets.gs`.
   - `OMNIROUTE_ENDPOINT` / `OMNIROUTE_API_KEY` (or individual provider keys, if calling providers
     directly instead of through a hosted OmniRoute — see `OmniRouteProxy.gs`).
5. Point the GitHub Pages frontend (`apps/web/config.js`) at the deployed Web App URL.
