/**
 * Minimal JSON-RPC 2.0 message helpers shared by every MCP transport (stdio, HTTP). Kept separate
 * from the transports so both speak exactly the same wire format. See
 * docs/architecture/MCP_ARCHITECTURE.md ("MCP Manager").
 */

let requestCounter = 0;

/** Monotonically increasing id, unique for the lifetime of the process. */
export function nextRequestId() {
  requestCounter += 1;
  return requestCounter;
}

/** @param {string} method @param {Object} [params] @param {number|string} [id] */
export function createRequest(method, params, id = nextRequestId()) {
  return { jsonrpc: '2.0', id, method, ...(params !== undefined ? { params } : {}) };
}

/** A notification carries no id and expects no response. */
export function createNotification(method, params) {
  return { jsonrpc: '2.0', method, ...(params !== undefined ? { params } : {}) };
}

export class JsonRpcError extends Error {
  constructor(error) {
    super(error?.message || 'JSON-RPC error');
    this.code = error?.code;
    this.data = error?.data;
  }
}

/** @param {{result?: any, error?: {code:number,message:string,data?:any}}} message */
export function resolveResult(message) {
  if (message?.error) throw new JsonRpcError(message.error);
  return message?.result;
}
