/**
 * Generic MCP client over the stdio transport — speaks JSON-RPC 2.0, one message per line, to a
 * locally spawned MCP server process. This is the transport most local/dev MCP servers use
 * (including community NotebookLM MCP servers launched via `npx`). See
 * docs/architecture/MCP_ARCHITECTURE.md ("Support local and remote MCP servers").
 *
 * Nothing in this file is NotebookLM-specific — any stdio MCP server can use it. See
 * notebookLmMcpServer.js for the NotebookLM wiring built on top of this.
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createRequest, createNotification, nextRequestId, resolveResult } from './jsonRpc.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const PROTOCOL_VERSION = '2025-06-18';

export class StdioMcpClient {
  /**
   * @param {{command: string, args?: string[], env?: Record<string,string>, cwd?: string,
   *   spawnImpl?: Function, timeoutMs?: number, clientInfo?: {name: string, version: string}}} options
   */
  constructor({ command, args = [], env, cwd, spawnImpl = spawn, timeoutMs = DEFAULT_TIMEOUT_MS, clientInfo } = {}) {
    if (!command) throw new Error('StdioMcpClient requires a "command" to spawn.');
    this.command = command;
    this.args = args;
    this.env = env;
    this.cwd = cwd;
    this.spawnImpl = spawnImpl;
    this.timeoutMs = timeoutMs;
    this.clientInfo = clientInfo || { name: 'wise-content-factory', version: '0.1.0' };
    this.child = null;
    this.pending = new Map();
    this.serverInfo = null;
    this.connectPromise = null;
  }

  connect() {
    if (!this.connectPromise) this.connectPromise = this._connect();
    return this.connectPromise;
  }

  async _connect() {
    this.child = this.spawnImpl(this.command, this.args, {
      cwd: this.cwd,
      env: this.env ? { ...process.env, ...this.env } : process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.on('error', (err) => this._rejectAllPending(err));
    this.child.on('exit', (code) => {
      this._rejectAllPending(new Error(`MCP server process "${this.command}" exited (code ${code}).`));
      this.connectPromise = null;
    });
    createInterface({ input: this.child.stdout }).on('line', (line) => this._handleLine(line));
    this.child.stderr?.resume(); // drain stderr so the server never blocks on a full pipe

    const initResult = await this._request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: this.clientInfo,
    });
    this._send(createNotification('notifications/initialized'));
    this.serverInfo = initResult?.serverInfo ?? null;
    return initResult;
  }

  _handleLine(line) {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return; // ignore non-JSON-RPC noise a server might print to stdout
    }
    if (message.id === undefined || message.id === null) return; // server-initiated notification
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    try {
      pending.resolve(resolveResult(message));
    } catch (err) {
      pending.reject(err);
    }
  }

  _send(message) {
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  _request(method, params) {
    const id = nextRequestId();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request "${method}" timed out after ${this.timeoutMs}ms.`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this._send(createRequest(method, params, id));
    });
  }

  _rejectAllPending(err) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(err);
    }
    this.pending.clear();
  }

  async listTools() {
    await this.connect();
    const result = await this._request('tools/list');
    return result?.tools ?? [];
  }

  /** @param {string} name @param {Object} [args] */
  async callTool(name, args = {}) {
    await this.connect();
    return this._request('tools/call', { name, arguments: args });
  }

  async close() {
    if (this.child && !this.child.killed) this.child.kill();
    this.child = null;
    this.connectPromise = null;
  }
}
