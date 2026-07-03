/**
 * NotebookLM MCP integration. Per docs/architecture/BUILD_DIRECTIVE.md ("NotebookLM should be the
 * preferred knowledge source when connected... Never block generation because NotebookLM is
 * unavailable") and docs/architecture/KNOWLEDGE_ENGINE.md ("NotebookLM is optional").
 *
 * NotebookLM has no public API of its own — every NotebookLM MCP server (community or future
 * first-party) is a normal MCP server reachable over stdio or Streamable HTTP. So this file
 * contains zero NotebookLM network logic: it is a thin configuration layer over the generic
 * StdioMcpClient / HttpMcpClient. It runs the MCP handshake, discovers whatever tools the
 * connected server actually exposes, and maps them onto Wise Content Factory's canonical
 * knowledge_retrieval tool names ("search", "ask") so Agents (see packages/agents/src/agents/
 * researchAgent.js) never need to know the underlying server's real tool names — matching
 * MCP_ARCHITECTURE.md's "Never hard-code tool names" rule.
 *
 * The returned object implements McpManager's McpServerAdapter shape (see mcpManager.js) and is
 * meant to be passed straight to `mcpManager.registerServer(...)`.
 */
import { StdioMcpClient } from './stdioMcpClient.js';
import { HttpMcpClient } from './httpMcpClient.js';

const CAPABILITIES = ['knowledge_retrieval', 'document_search'];

// Canonical WCF tool name -> patterns tried, in order, against the real tool names reported by
// whatever NotebookLM MCP server is connected. First match wins. Override via `toolAliases` for a
// server with unusual tool names.
const DEFAULT_TOOL_ALIASES = {
  search: [/search/i, /find/i, /retrieve/i],
  ask: [/^ask/i, /question/i, /chat/i, /query/i],
};

/**
 * @param {{
 *   name?: string,
 *   transport?: 'stdio'|'http',
 *   command?: string, args?: string[], env?: Record<string,string>, cwd?: string,
 *   url?: string, headers?: Record<string,string>,
 *   toolAliases?: Record<string, RegExp[]>,
 *   spawnImpl?: Function, fetchImpl?: typeof fetch,
 * }} [options]
 * @returns {import('../mcpManager.js').McpServerAdapter & {close: () => Promise<void>}}
 */
export function createNotebookLmMcpServer({
  name = 'notebooklm',
  transport = 'stdio',
  command,
  args = [],
  env,
  cwd,
  url,
  headers,
  toolAliases = DEFAULT_TOOL_ALIASES,
  spawnImpl,
  fetchImpl,
} = {}) {
  const configured = transport === 'http' ? Boolean(url) : Boolean(command);
  if (!configured) {
    return {
      name,
      capabilities: CAPABILITIES,
      tools: [],
      healthStatus: 'unavailable',
      async callTool() {
        throw new Error(
          `MCP server "${name}" is not configured (pass a "command" for stdio or a "url" for http). ` +
            'Research should fall back to ungrounded generation rather than block on this — see KNOWLEDGE_ENGINE.md.'
        );
      },
      async close() {},
    };
  }

  const client =
    transport === 'http'
      ? new HttpMcpClient({ url, headers, fetchImpl })
      : new StdioMcpClient({ command, args, env, cwd, spawnImpl });

  // Resolved lazily (MCP_ARCHITECTURE.md: "Lazy-load MCP servers... Load tools on demand") and
  // memoized as a promise so concurrent calls share one discovery round-trip. A failed discovery
  // is not cached, so the next call gets a fresh retry per "Failure Recovery: Retry."
  let aliasResolution = null;
  function resolveAliases() {
    if (!aliasResolution) {
      aliasResolution = client
        .listTools()
        .then((tools) => {
          const realNames = tools.map((t) => t.name);
          const map = new Map();
          for (const [alias, patterns] of Object.entries(toolAliases)) {
            const match = realNames.find((realName) => patterns.some((pattern) => pattern.test(realName)));
            if (match) map.set(alias, match);
          }
          return map;
        })
        .catch((err) => {
          aliasResolution = null;
          throw err;
        });
    }
    return aliasResolution;
  }

  return {
    name,
    capabilities: CAPABILITIES,
    // Canonical alias names, not the underlying server's real tool names — this is the whole
    // point of the alias layer, callers never need to know what the connected server calls them.
    tools: Object.keys(toolAliases),
    healthStatus: 'healthy',
    /**
     * @param {string} toolName one of `tools` above
     * @param {Object} args
     */
    async callTool(toolName, args = {}) {
      const aliases = await resolveAliases();
      const realName = aliases.get(toolName);
      if (!realName) {
        throw new Error(
          `NotebookLM MCP server "${name}" does not expose a tool matching canonical name "${toolName}".`
        );
      }
      const result = await client.callTool(realName, args);
      return extractText(result);
    },
    async close() {
      await client.close();
    },
  };
}

/** MCP tool results are `{content: [{type, text}], isError}`; flatten to plain text for Agents. */
function extractText(result) {
  if (!result || typeof result !== 'object') return result;
  if (result.isError) {
    const message = Array.isArray(result.content) ? result.content.map((b) => b.text ?? '').join('\n') : 'unknown error';
    throw new Error(`NotebookLM MCP tool call failed: ${message}`);
  }
  if (Array.isArray(result.content)) {
    return result.content.map((block) => block.text ?? '').join('\n').trim();
  }
  return result;
}
