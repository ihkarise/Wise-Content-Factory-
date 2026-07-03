/**
 * Generic MCP client over the Streamable HTTP transport — a single endpoint that accepts POSTed
 * JSON-RPC 2.0 messages and replies with either a JSON body or a `text/event-stream` body carrying
 * one JSON-RPC message. Used for remote/hosted MCP servers. Unlike the stdio transport, this one
 * only needs `fetch`, so it is the transport a future Google Apps Script gateway
 * (apps/gateway/*.gs, which has no subprocess support but does have `UrlFetchApp`) could reach
 * too. See docs/architecture/MCP_ARCHITECTURE.md ("Support local and remote MCP servers").
 *
 * Nothing in this file is NotebookLM-specific — any Streamable HTTP MCP server can use it. See
 * notebookLmMcpServer.js for the NotebookLM wiring built on top of this.
 */
import { createRequest, createNotification, resolveResult } from './jsonRpc.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const PROTOCOL_VERSION = '2025-06-18';

export class HttpMcpClient {
  /**
   * @param {{url: string, headers?: Record<string,string>, fetchImpl?: typeof fetch,
   *   timeoutMs?: number, clientInfo?: {name: string, version: string}}} options
   */
  constructor({ url, headers = {}, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, clientInfo } = {}) {
    if (!url) throw new Error('HttpMcpClient requires a "url".');
    this.url = url;
    this.headers = headers;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.clientInfo = clientInfo || { name: 'wise-content-factory', version: '0.1.0' };
    this.sessionId = null;
    this.serverInfo = null;
    this.connectPromise = null;
  }

  connect() {
    if (!this.connectPromise) this.connectPromise = this._connect();
    return this.connectPromise;
  }

  async _connect() {
    const initResult = await this._request(
      createRequest('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: this.clientInfo,
      })
    );
    await this._request(createNotification('notifications/initialized'), { expectResponse: false });
    this.serverInfo = initResult?.serverInfo ?? null;
    return initResult;
  }

  async _request(message, { expectResponse = true } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          ...(this.sessionId ? { 'mcp-session-id': this.sessionId } : {}),
          ...this.headers,
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });
      const sessionId = response.headers?.get?.('mcp-session-id');
      if (sessionId) this.sessionId = sessionId;
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`MCP HTTP transport error ${response.status}: ${body}`);
      }
      if (!expectResponse) return undefined;
      const contentType = response.headers?.get?.('content-type') || '';
      const payload = contentType.includes('text/event-stream')
        ? await parseSseJsonRpc(response)
        : await response.json();
      return resolveResult(payload);
    } finally {
      clearTimeout(timer);
    }
  }

  async listTools() {
    await this.connect();
    const result = await this._request(createRequest('tools/list'));
    return result?.tools ?? [];
  }

  /** @param {string} name @param {Object} [args] */
  async callTool(name, args = {}) {
    await this.connect();
    return this._request(createRequest('tools/call', { name, arguments: args }));
  }

  async close() {
    this.connectPromise = null;
    this.sessionId = null;
  }
}

async function parseSseJsonRpc(response) {
  const text = await response.text();
  for (const line of text.split('\n')) {
    if (line.startsWith('data:')) {
      const data = line.slice(5).trim();
      if (data) return JSON.parse(data);
    }
  }
  throw new Error('MCP HTTP transport: SSE response contained no data payload.');
}
