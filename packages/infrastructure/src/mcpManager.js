/**
 * MCP Manager — the single gateway between Wise Content Factory and every MCP server. Agents and
 * Engines never talk to an MCP server directly; they call `mcpManager.callTool(...)`.
 * See docs/architecture/MCP_ARCHITECTURE.md.
 *
 * Development rule enforced here: "Never hard-code MCP servers. Always request capabilities
 * instead of specific servers." Callers pass a capability (e.g. "knowledge_retrieval"); the
 * Manager picks a registered, healthy server that offers it. Servers register themselves, and
 * removing a server never requires an application code change.
 *
 * @typedef {Object} McpServerAdapter
 * @property {string} name
 * @property {string[]} capabilities
 * @property {string[]} tools
 * @property {(toolName: string, args: Object) => Promise<any>} callTool
 * @property {'healthy'|'degraded'|'unavailable'} [healthStatus]
 */

export class McpManager {
  constructor() {
    /** @type {Map<string, McpServerAdapter>} */
    this.servers = new Map();
  }

  /** @param {McpServerAdapter} server */
  registerServer(server) {
    if (!server?.name) throw new Error('MCP server must have a name');
    this.servers.set(server.name, { healthStatus: 'healthy', ...server });
  }

  unregisterServer(name) {
    this.servers.delete(name);
  }

  listServers() {
    return [...this.servers.values()];
  }

  /** @param {string} capability */
  getServersForCapability(capability) {
    return [...this.servers.values()].filter(
      (s) => s.capabilities.includes(capability) && s.healthStatus !== 'unavailable'
    );
  }

  /**
   * Call a tool on the best available server for the requested capability. Never throws the
   * whole workflow away if one server is unavailable — tries every candidate in order.
   * @param {string} capability
   * @param {string} toolName
   * @param {Object} args
   */
  async callTool(capability, toolName, args = {}) {
    const candidates = this.getServersForCapability(capability);
    if (!candidates.length) {
      throw new Error(`No healthy MCP server registered for capability "${capability}".`);
    }
    let lastError;
    for (const server of candidates) {
      if (!server.tools.includes(toolName)) continue;
      try {
        return await server.callTool(toolName, args);
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(
      `All MCP servers for capability "${capability}" failed to run tool "${toolName}". Last error: ${lastError?.message ?? 'no server exposed that tool'}`
    );
  }
}
