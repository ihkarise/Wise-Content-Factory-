# MCP Client Layer (NotebookLM and beyond)

## Purpose

Implements the client side of the Model Context Protocol so Wise Content Factory can connect to
real MCP servers — starting with NotebookLM, the first source listed under "Knowledge" in
`docs/architecture/MCP_ARCHITECTURE.md`. Per `docs/architecture/BUILD_DIRECTIVE.md`, "NotebookLM
should be the preferred knowledge source when connected" but "generation should never block
because NotebookLM is unavailable" — both are enforced here.

## Architecture

Three layers, matching the "never hard-code MCP servers" and "never hard-code tool names" rules in
`MCP_ARCHITECTURE.md`:

```
StdioMcpClient / HttpMcpClient   <- generic MCP JSON-RPC 2.0 transports, know nothing about
      |                             NotebookLM or any other specific server
      v
createNotebookLmMcpServer(...)   <- discovers the connected server's real tools (tools/list) and
      |                             maps them onto WCF's canonical tool names ("search", "ask")
      v
McpManager.registerServer(...)   <- Agents call mcpManager.callTool('knowledge_retrieval',
                                     'search', {query}) and never see a real server's tool names
```

- `jsonRpc.js` — shared JSON-RPC 2.0 message helpers (both transports speak the same wire format).
- `stdioMcpClient.js` — spawns a local MCP server process and exchanges newline-delimited JSON-RPC
  messages over its stdin/stdout. The transport most MCP servers use for local/dev (e.g. one
  launched with `npx`).
- `httpMcpClient.js` — the Streamable HTTP transport: a single endpoint, POSTed JSON-RPC messages,
  JSON or `text/event-stream` responses, session continuity via the `Mcp-Session-Id` header. This
  is the transport a future Google Apps Script gateway (`apps/gateway/*.gs`) could also reach,
  since GAS has `UrlFetchApp` but no subprocess support — `stdioMcpClient.js` cannot run there.
- `notebookLmMcpServer.js` — the only NotebookLM-specific file, and even it contains no NotebookLM
  network logic. NotebookLM has no public API of its own; every NotebookLM MCP server (community
  today, possibly first-party later) is a normal MCP server, so this is a thin configuration +
  tool-alias layer over the two generic clients above.

Both clients connect lazily (`MCP_ARCHITECTURE.md`: "Lazy-load MCP servers... Load tools on
demand") — nothing is spawned or fetched until the first `listTools()`/`callTool()` call.

## Configuration

`packages/infrastructure` never reads environment variables itself (same rule the AI providers
follow — see `anthropicProvider.js`'s "the API key must be injected by the caller"). Whatever
composes the application (an example script, a future Node worker, `apps/gateway`) is responsible
for reading configuration and constructing the adapter:

```js
import { createNotebookLmMcpServer, McpManager } from '@wcf/infrastructure';

// Local dev: a NotebookLM MCP server run via npx (stdio transport)
const notebookLm = createNotebookLmMcpServer({
  transport: 'stdio',
  command: 'npx',
  args: ['-y', 'notebooklm-mcp-server'],
  env: { NOTEBOOKLM_AUTH_TOKEN: process.env.NOTEBOOKLM_AUTH_TOKEN },
});

// Hosted: a remote MCP server reachable over Streamable HTTP
const notebookLmHosted = createNotebookLmMcpServer({
  transport: 'http',
  url: process.env.NOTEBOOKLM_MCP_URL,
  headers: { authorization: `Bearer ${process.env.NOTEBOOKLM_MCP_TOKEN}` },
});

const mcpManager = new McpManager();
mcpManager.registerServer(notebookLm);
```

If neither `command` nor `url` is supplied, `createNotebookLmMcpServer()` still returns a valid
adapter — `healthStatus: 'unavailable'` — instead of throwing. Register it anyway; `McpManager`
and `researchAgent.js` already treat an unavailable knowledge server as "proceed ungrounded," never
as a fatal error.

Different community NotebookLM MCP servers name their tools differently (`notebook_search`,
`query_sources`, `ask_notebook`, ...). Override the default regex-based alias table with
`toolAliases` if a server's naming doesn't match the defaults:

```js
createNotebookLmMcpServer({
  transport: 'http',
  url: '...',
  toolAliases: { search: [/^lookup$/], ask: [/^chat$/] },
});
```

## Examples

See `packages/infrastructure/test/mcp.test.js` for full working examples of both transports,
including a real spawned-process MCP server and a real `node:http` MCP server — not mocks of this
module's internals. `packages/agents/src/agents/researchAgent.js` shows the Agent-side call:

```js
if (mcpManager.getServersForCapability('knowledge_retrieval').length) {
  const notes = await mcpManager.callTool('knowledge_retrieval', 'search', { query });
}
```

## Failure Modes

- **Not configured** (`command`/`url` omitted): `healthStatus: 'unavailable'`; `callTool` throws a
  descriptive error. `McpManager.getServersForCapability` already filters these out, and
  `researchAgent.js` falls back to ungrounded reasoning — generation never blocks.
- **Server process/endpoint unreachable or crashes mid-call**: pending requests reject with a
  clear error (`StdioMcpClient` rejects everything in flight when the child process exits;
  `HttpMcpClient` surfaces non-2xx responses and network errors). `McpManager.callTool` already
  tries the next registered server for the same capability before giving up.
- **Server exposes no tool matching a canonical alias** (`search`/`ask`): `callTool` throws
  naming the missing canonical tool, rather than silently calling the wrong thing.
- **Request hangs**: both transports enforce a 30s default timeout (`timeoutMs` option) so a dead
  connection can't hang a workflow indefinitely.

## Future Extension Notes

- Per-alias argument mapping (e.g. a server that expects `{question}` instead of `{query}`) is not
  implemented yet — add an optional `argsMap` function per alias in `toolAliases` if a real server
  needs it, rather than hard-coding NotebookLM-specific field names here.
- Knowledge results are not yet run through `CacheEngine` (`MCP_ARCHITECTURE.md`: "Cache Knowledge
  Results... The same information should never be requested repeatedly"). That belongs in the
  Knowledge Engine layer described in `docs/architecture/KNOWLEDGE_ENGINE.md`, which does not exist
  as a package yet — wrap `mcpManager.callTool` results in `CacheEngine` there when it's built.
  Wiring is deferred here rather than half-implemented (per `CLAUDE.md`: "no placeholder
  implementations").
- The same `StdioMcpClient`/`HttpMcpClient` pair is intentionally generic — the next MCP
  integration (Filesystem, GitHub, Google Drive, per `KNOWLEDGE_ENGINE.md`'s "Knowledge Sources")
  should reuse them rather than writing new transports.
