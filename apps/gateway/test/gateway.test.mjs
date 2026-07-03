import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGateway } from './gasHarness.mjs';

const BASE_PROPERTIES = {
  SESSION_SIGNING_SECRET: 'test-signing-secret',
  SECRET_ENCRYPTION_PASSPHRASE: 'test-encryption-passphrase',
};

test('session token round-trips and rejects tampering', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  const token = gw.issueSession_('user-1', 'owner');
  const session = gw.verifySessionToken_(token, BASE_PROPERTIES.SESSION_SIGNING_SECRET);
  assert.equal(session.userId, 'user-1');
  assert.equal(session.role, 'owner');

  const tampered = token.slice(0, -2) + 'zz';
  assert.throws(() => gw.verifySessionToken_(tampered, BASE_PROPERTIES.SESSION_SIGNING_SECRET), /Invalid session token/);
});

test('requireSession_ rejects an expired session', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  const session = gw.createSession_({ userId: 'u1', role: 'owner', createdAt: 0, expiresAt: 1 });
  const token = gw.signSessionToken_(session, BASE_PROPERTIES.SESSION_SIGNING_SECRET);
  assert.throws(() => gw.requireSession_(token), /Session expired/);
});

test('requireSession_ enforces the role permission matrix', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  const token = gw.issueSession_('viewer-1', 'viewer');
  assert.doesNotThrow(() => gw.requireSession_(token, 'campaign:read'));
  assert.throws(() => gw.requireSession_(token, 'campaign:write'), /lacks permission/);
});

test('encryptSecretValue_/decryptSecretValue_ round-trips and detects tampering', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  const encrypted = gw.encryptSecretValue_('sk-super-secret-key', BASE_PROPERTIES.SECRET_ENCRYPTION_PASSPHRASE);
  assert.equal(gw.decryptSecretValue_(encrypted, BASE_PROPERTIES.SECRET_ENCRYPTION_PASSPHRASE), 'sk-super-secret-key');

  // Flip a character in the middle of the ciphertext segment (not the last char, whose trailing
  // bits can be base64 padding slack that doesn't actually change the decoded bytes).
  const parts = encrypted.split('.');
  const midpoint = Math.floor(parts[1].length / 2);
  const flippedChar = parts[1][midpoint] === 'A' ? 'B' : 'A';
  const tamperedCiphertext = parts[1].slice(0, midpoint) + flippedChar + parts[1].slice(midpoint + 1);
  const tampered = [parts[0], tamperedCiphertext, parts[2]].join('.');
  assert.throws(() => gw.decryptSecretValue_(tampered, BASE_PROPERTIES.SECRET_ENCRYPTION_PASSPHRASE), /integrity check/);
});

test('setEncryptedScriptSecret_/getDecryptedScriptSecret_ store and retrieve through PropertiesService', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  gw.setEncryptedScriptSecret_('ANTHROPIC_API_KEY', 'sk-anthropic-xyz');
  assert.notEqual(gw.__properties.ANTHROPIC_API_KEY, 'sk-anthropic-xyz', 'must not be stored as plaintext');
  assert.equal(gw.getDecryptedScriptSecret_('ANTHROPIC_API_KEY'), 'sk-anthropic-xyz');
});

test('enforceRateLimit_ allows requests under the limit and blocks over it', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  gw.RATE_LIMIT_MAX_REQUESTS = 3;
  for (let i = 0; i < 3; i += 1) assert.doesNotThrow(() => gw.enforceRateLimit_('user-x'));
  assert.throws(() => gw.enforceRateLimit_('user-x'), /Rate limit exceeded/);
});

test('job queue: enqueue -> run -> completed status is retrievable', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  const jobId = gw.enqueueJob_('capability_request', { hello: 'world' });
  assert.equal(gw.getJobStatus_(jobId).status, 'queued');
  gw.runJob_(jobId, (payload) => ({ echoed: payload.hello }));
  const status = gw.getJobStatus_(jobId);
  assert.equal(status.status, 'completed');
  // status.result was constructed inside the vm sandbox realm, so compare fields rather than
  // using deepEqual against a main-realm object literal (different realms => different
  // Object.prototype identity, which trips strict structural comparisons).
  assert.equal(status.result.echoed, 'world');
});

test('job queue: a throwing work function marks the job failed without crashing the caller', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  const jobId = gw.enqueueJob_('capability_request', {});
  gw.runJob_(jobId, () => { throw new Error('boom'); });
  const status = gw.getJobStatus_(jobId);
  assert.equal(status.status, 'failed');
  assert.equal(status.error, 'boom');
});

test('dispatch_: login issues a session only with the correct owner passphrase', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  gw.setEncryptedScriptSecret_('OWNER_PASSPHRASE', 'correct-horse-battery-staple');

  assert.throws(() => gw.dispatch_({ action: 'login', passphrase: 'wrong' }), /Invalid credentials/);

  const result = gw.dispatch_({ action: 'login', userId: 'dr-libin', passphrase: 'correct-horse-battery-staple' });
  assert.ok(result.sessionToken);
  const session = gw.verifySessionToken_(result.sessionToken, BASE_PROPERTIES.SESSION_SIGNING_SECRET);
  assert.equal(session.userId, 'dr-libin');
  assert.equal(session.role, 'owner');
});

test('dispatch_: capability_request runs end-to-end through the Anthropic fallback and returns a job result', () => {
  const gw = loadGateway({
    scriptProperties: BASE_PROPERTIES,
    fetchImpl: (url) => {
      assert.equal(url, 'https://api.anthropic.com/v1/messages');
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ content: [{ text: 'Hello from the gateway' }] }),
      };
    },
  });
  gw.setEncryptedScriptSecret_('ANTHROPIC_API_KEY', 'sk-test');
  const token = gw.issueSession_('owner-1', 'owner');

  const result = gw.dispatch_({
    action: 'capability_request',
    sessionToken: token,
    capabilityRequest: { capability: 'generate_text', input: { prompt: 'hi' } },
  });
  assert.equal(result.status, 'completed');
  assert.equal(result.result.output, 'Hello from the gateway');
});

test('dispatch_: capability_request rejects a viewer-role session (write permission required)', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  const token = gw.issueSession_('viewer-1', 'viewer');
  assert.throws(
    () => gw.dispatch_({ action: 'capability_request', sessionToken: token, capabilityRequest: { capability: 'generate_text', input: {} } }),
    /lacks permission/
  );
});

test('dispatch_: unknown action is rejected', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  assert.throws(() => gw.dispatch_({ action: 'delete_everything' }), /Unknown action/);
});

test('handleRequest_ / doPost: never leaks stack traces, only a safe error message', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  const response = gw.handleRequest_({ postData: { contents: JSON.stringify({ action: 'nope' }) } });
  assert.equal(response.ok, false);
  assert.equal(response.error, 'Unknown action: nope');
  assert.equal(Object.prototype.hasOwnProperty.call(response, 'stack'), false);
});

test('redact_ strips secret-like keys before logging', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  const redacted = gw.redact_({ apiKey: 'sk-1', nested: { sessionToken: 'tok', ok: 'fine' } });
  assert.equal(redacted.apiKey, '[REDACTED]');
  assert.equal(redacted.nested.sessionToken, '[REDACTED]');
  assert.equal(redacted.nested.ok, 'fine');
});

test('doGet returns a health check payload', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  const output = gw.doGet();
  assert.equal(JSON.parse(output.getContent()).status, 'ok');
});

test('memoryWrite_/memoryRead_ round-trip a record with version 1 and audit timestamps', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  const written = gw.memoryWrite_('global', 'featureFlags', { betaEnabled: true }, { tags: ['config'] });
  assert.equal(written.version, 1);
  assert.deepEqual(written.tags, ['config']);
  const read = gw.memoryRead_('global', 'featureFlags');
  // Objects built inside the vm sandbox (e.g. via JSON.parse there) have a different realm's
  // Object.prototype than this test file, so deepEqual needs both sides normalized through JSON
  // first — same reason other tests in this file compare individual fields instead.
  assert.deepEqual(JSON.parse(JSON.stringify(read.data)), { betaEnabled: true });
});

test('memoryUpdate_ merges the patch into existing data and bumps the version', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  gw.memoryWrite_('global', 'featureFlags', { betaEnabled: true, theme: 'dark' });
  const updated = gw.memoryUpdate_('global', 'featureFlags', { betaEnabled: false });
  assert.equal(updated.version, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(updated.data)), { betaEnabled: false, theme: 'dark' });
  assert.equal(updated.previousVersions.length, 1);
});

test('memoryUpdate_ throws a clear error for a key that was never written', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  assert.throws(() => gw.memoryUpdate_('global', 'missing', {}), /no record/);
});

test('memoryDelete_/memoryList_/memorySearch_ work against real PropertiesService semantics', () => {
  const gw = loadGateway({ scriptProperties: BASE_PROPERTIES });
  gw.memoryWrite_('global', 'a', { n: 1 }, { tags: ['x'] });
  gw.memoryWrite_('global', 'b', { n: 2 }, { tags: ['y'] });

  assert.equal(gw.memoryList_('global').length, 2);
  assert.equal(gw.memorySearch_('global', { tags: ['x'] }).length, 1);

  assert.equal(gw.memoryDelete_('global', 'a'), true);
  assert.equal(gw.memoryRead_('global', 'a'), null);
  assert.equal(gw.memoryList_('global').length, 1);
});
