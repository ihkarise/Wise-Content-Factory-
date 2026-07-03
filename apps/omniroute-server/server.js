#!/usr/bin/env node
/**
 * Deployable OmniRoute Gateway — the hosted service that `apps/gateway/OmniRouteProxy.gs`
 * (`callOmniRouteHttp_`) talks to when `OMNIROUTE_ENDPOINT` is configured. Wraps the OmniRoute
 * reference implementation in `packages/infrastructure/src/omniroute.js` with real provider
 * registration, request validation, and shared-secret authentication, so the "hosted OmniRoute
 * instance" referenced there and in `docs/architecture/OMNIROUTE_INTEGRATION.md` actually exists
 * and is runnable (`node apps/omniroute-server/server.js`).
 *
 * Zero runtime dependencies, matching every other package in this repo — plain `node:http`, no
 * framework. See `apps/omniroute-server/README.md` for configuration and deployment notes.
 */
import { createServer } from 'node:http';
import { OmniRoute, redact } from '../../packages/infrastructure/src/index.js';
import { validateCapabilityRequest } from '../../packages/core/src/index.js';
import {
  createMockTextProvider,
  createMockMediaProvider,
  createAnthropicProvider,
  createOpenAiCompatibleProvider,
  createGeminiProvider,
} from '../../packages/providers/src/index.js';

const MAX_BODY_BYTES = 1_000_000; // 1MB — a capability request body is small text/JSON, never a media upload

/**
 * Registers every provider this deployment has credentials for, plus the always-available local
 * mock providers so the service never has zero registered providers for a capability (see
 * OMNIROUTE_INTEGRATION.md's "Local-First Policy": cache -> local -> free -> low-cost -> premium).
 * @param {OmniRoute} omniroute
 * @param {NodeJS.ProcessEnv} env
 * @returns {string[]} ids of every provider actually registered
 */
export function registerProvidersFromEnv(omniroute, env = process.env) {
  const registered = [];

  const registerAndTrack = (provider) => {
    omniroute.registerProvider(provider);
    registered.push(provider.id);
  };

  registerAndTrack(createMockTextProvider());
  registerAndTrack(createMockMediaProvider());

  if (env.ANTHROPIC_API_KEY) {
    registerAndTrack(
      createAnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL })
    );
  }
  if (env.GEMINI_API_KEY) {
    registerAndTrack(createGeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL }));
  }
  if (env.OPENAI_API_KEY) {
    registerAndTrack(
      createOpenAiCompatibleProvider({
        id: 'openai',
        baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL || 'gpt-4o-mini',
        tier: 'premium',
      })
    );
  }
  if (env.DEEPSEEK_API_KEY) {
    registerAndTrack(
      createOpenAiCompatibleProvider({
        id: 'deepseek',
        baseUrl: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
        apiKey: env.DEEPSEEK_API_KEY,
        model: env.DEEPSEEK_MODEL || 'deepseek-chat',
        tier: 'low_cost',
      })
    );
  }
  if (env.OLLAMA_BASE_URL) {
    registerAndTrack(
      createOpenAiCompatibleProvider({
        id: 'ollama',
        baseUrl: env.OLLAMA_BASE_URL,
        model: env.OLLAMA_MODEL || 'llama3',
        tier: 'local',
      })
    );
  }

  return registered;
}

/** @param {import('node:http').IncomingMessage} req */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let received = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        // Reject once but keep draining the socket instead of destroying it — an abrupt
        // destroy() while the client is still writing surfaces as a raw connection-reset
        // error on the client rather than a clean 413 response.
        if (!tooLarge) {
          tooLarge = true;
          reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        }
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return;
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Request body must be valid JSON'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

function isAuthorized(req, apiKey) {
  if (!apiKey) return true; // no shared secret configured — dev mode, see README "Configuration"
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token === apiKey;
}

/**
 * @param {{omniroute: OmniRoute, apiKey?: string, registeredProviderIds: string[]}} deps
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function createRequestHandler({ omniroute, apiKey, registeredProviderIds }) {
  return async function handleRequest(req, res) {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        return sendJson(res, 200, { status: 'ok', providers: registeredProviderIds });
      }
      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed. POST a Capability Request.' });
      }
      if (!isAuthorized(req, apiKey)) {
        return sendJson(res, 401, { error: 'Unauthorized' });
      }

      const capabilityRequest = await readJsonBody(req);
      const { valid, errors } = validateCapabilityRequest(capabilityRequest);
      if (!valid) {
        return sendJson(res, 400, { error: `Invalid capability request: ${errors.join('; ')}` });
      }

      const result = await omniroute.request(capabilityRequest);
      return sendJson(res, 200, result);
    } catch (err) {
      if (err.statusCode) return sendJson(res, err.statusCode, { error: err.message });
      console.error('OmniRoute server error:', redact({ message: err.message }));
      return sendJson(res, 502, { error: err.message || 'Upstream provider failure' });
    }
  };
}

/**
 * @param {{env?: NodeJS.ProcessEnv, omniroute?: OmniRoute}} [options]
 * @returns {import('node:http').Server}
 */
export function createOmniRouteServer({ env = process.env, omniroute = new OmniRoute() } = {}) {
  const registeredProviderIds = registerProvidersFromEnv(omniroute, env);
  const handler = createRequestHandler({ omniroute, apiKey: env.OMNIROUTE_API_KEY, registeredProviderIds });
  return createServer((req, res) => {
    handler(req, res).catch((err) => {
      console.error('Unhandled OmniRoute server error:', err);
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error' });
    });
  });
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  if (!process.env.OMNIROUTE_API_KEY) {
    console.warn(
      'OMNIROUTE_API_KEY is not set — this server will accept unauthenticated requests. ' +
        'Set it before exposing this service beyond local development.'
    );
  }
  const server = createOmniRouteServer({});
  const port = Number(process.env.PORT) || 8787;
  server.listen(port, () => {
    console.log(`OmniRoute gateway listening on :${port}`);
  });
}
