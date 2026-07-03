import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { StdioMcpClient, HttpMcpClient, createNotebookLmMcpServer, McpManager } from '../src/index.js';

// A minimal, real MCP server implemented over stdio, spawned as a separate Node process. Exercises
// the actual JSON-RPC/child-process wire protocol rather than mocking StdioMcpClient's internals.
const FAKE_STDIO_SERVER_SCRIPT = `
const readline = require('node:readline');
const rl = readline.createInterface({ input: process.stdin });
function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\\n');
}
rl.on('line', (line) => {
  if (!line.trim()) return;
  const msg = JSON.parse(line);
  if (msg.method === 'initialize') {
    respond(msg.id, { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'fake-notebooklm', version: '1.0' } });
  } else if (msg.method === 'tools/list') {
    respond(msg.id, { tools: [{ name: 'notebook_search', description: 'Search notebook sources' }, { name: 'ask_notebook', description: 'Ask a grounded question' }] });
  } else if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params;
    if (name === 'notebook_search') respond(msg.id, { content: [{ type: 'text', text: 'stdio result for ' + args.query }] });
    else if (name === 'ask_notebook') respond(msg.id, { content: [{ type: 'text', text: 'stdio answer for ' + args.query }] });
    else respond(msg.id, { isError: true, content: [{ type: 'text', text: 'unknown tool' }] });
  }
  // notifications (no id) are intentionally not responded to
});
`;

function startFakeHttpMcpServer() {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const msg = JSON.parse(body);
      res.setHeader('mcp-session-id', 'test-session-123');
      if (msg.method === 'initialize') {
        sendJson(res, { jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'fake-http-notebooklm', version: '1.0' } } });
      } else if (msg.method === 'notifications/initialized') {
        res.writeHead(202).end();
      } else if (msg.method === 'tools/list') {
        sendJson(res, { jsonrpc: '2.0', id: msg.id, result: { tools: [{ name: 'query_sources' }] } });
      } else if (msg.method === 'tools/call') {
        const { name, arguments: args } = msg.params;
        sendJson(res, { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: `http result for ${args.query}` }] } });
      } else {
        res.writeHead(400).end();
      }
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function sendJson(res, payload) {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

test('StdioMcpClient: real handshake + tools/list + tools/call over a spawned process', async () => {
  const client = new StdioMcpClient({ command: process.execPath, args: ['-e', FAKE_STDIO_SERVER_SCRIPT] });
  try {
    const tools = await client.listTools();
    assert.deepEqual(
      tools.map((t) => t.name),
      ['notebook_search', 'ask_notebook']
    );
    const result = await client.callTool('notebook_search', { query: 'migraine remedies' });
    assert.equal(result.content[0].text, 'stdio result for migraine remedies');
  } finally {
    await client.close();
  }
});

test('StdioMcpClient rejects pending requests when the process dies', async () => {
  const client = new StdioMcpClient({ command: process.execPath, args: ['-e', 'process.exit(1)'] });
  await assert.rejects(client.listTools(), /exited/);
});

test('HttpMcpClient: real handshake + tools/list + tools/call over HTTP', async () => {
  const server = await startFakeHttpMcpServer();
  try {
    const { port } = server.address();
    const client = new HttpMcpClient({ url: `http://127.0.0.1:${port}/mcp` });
    const tools = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name), ['query_sources']);
    const result = await client.callTool('query_sources', { query: 'pharmacy onboarding' });
    assert.equal(result.content[0].text, 'http result for pharmacy onboarding');
    assert.equal(client.sessionId, 'test-session-123');
  } finally {
    server.close();
  }
});

test('createNotebookLmMcpServer is unavailable (not thrown at construction) when unconfigured', async () => {
  const server = createNotebookLmMcpServer();
  assert.equal(server.healthStatus, 'unavailable');
  await assert.rejects(server.callTool('search', { query: 'x' }), /not configured/);
});

test('createNotebookLmMcpServer maps canonical tool names onto the real stdio server tool names', async () => {
  const server = createNotebookLmMcpServer({
    transport: 'stdio',
    command: process.execPath,
    args: ['-e', FAKE_STDIO_SERVER_SCRIPT],
  });
  assert.deepEqual(server.tools, ['search', 'ask']);
  try {
    const searchResult = await server.callTool('search', { query: 'migraine remedies' });
    assert.equal(searchResult, 'stdio result for migraine remedies');
    const askResult = await server.callTool('ask', { query: 'what dosage is safe?' });
    assert.equal(askResult, 'stdio answer for what dosage is safe?');
  } finally {
    await server.close();
  }
});

test('createNotebookLmMcpServer registers with McpManager and Agents can call it generically', async () => {
  const mcp = new McpManager();
  const notebookLm = createNotebookLmMcpServer({
    transport: 'stdio',
    command: process.execPath,
    args: ['-e', FAKE_STDIO_SERVER_SCRIPT],
  });
  mcp.registerServer(notebookLm);
  try {
    const result = await mcp.callTool('knowledge_retrieval', 'search', { query: 'PillFill pharmacy launch' });
    assert.equal(result, 'stdio result for PillFill pharmacy launch');
  } finally {
    await notebookLm.close();
  }
});

test('createNotebookLmMcpServer over HTTP works end to end through McpManager', async () => {
  const server = await startFakeHttpMcpServer();
  try {
    const { port } = server.address();
    const mcp = new McpManager();
    const notebookLm = createNotebookLmMcpServer({
      transport: 'http',
      url: `http://127.0.0.1:${port}/mcp`,
      toolAliases: { search: [/query/i] },
    });
    mcp.registerServer(notebookLm);
    const result = await mcp.callTool('knowledge_retrieval', 'search', { query: 'homeopathy blog ideas' });
    assert.equal(result, 'http result for homeopathy blog ideas');
  } finally {
    server.close();
  }
});
