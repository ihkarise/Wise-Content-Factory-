/**
 * Action dispatch table. Every action name maps to a handler and (except login) a required
 * permission from the v1 role matrix in Auth.gs / packages/core/src/schemas/session.js.
 */

var ROUTES_ = {
  login: { permission: null, handler: handleLogin_ },
  capability_request: { permission: 'campaign:write', handler: handleCapabilityRequest_ },
  job_status: { permission: 'campaign:read', handler: handleJobStatus_ },
};

/**
 * @param {{action: string, sessionToken: string, [key: string]: any}} request
 */
function dispatch_(request) {
  var route = ROUTES_[request.action];
  if (!route) throw new Error('Unknown action: ' + request.action);

  var session = null;
  if (route.permission) {
    session = requireSession_(request.sessionToken, route.permission);
    enforceRateLimit_(session.userId);
  }
  return route.handler(request, session);
}

function handleLogin_(request) {
  // v1 is single-owner: any caller who knows the shared owner passphrase (itself stored
  // encrypted via Secrets.gs) is issued an "owner" session. Swap this for real per-user auth
  // before scaling past a single owner/small team — see SECURITY_ARCHITECTURE.md, Contradiction #7.
  var expected = getDecryptedScriptSecret_('OWNER_PASSPHRASE');
  if (!request.passphrase || request.passphrase !== expected) {
    throw new Error('Invalid credentials');
  }
  var token = issueSession_(request.userId || 'owner', 'owner');
  return { sessionToken: token };
}

function handleCapabilityRequest_(request) {
  var jobId = enqueueJob_('capability_request', request.capabilityRequest);
  // Demo scope: run inline immediately (fast mock/text providers complete well under GAS's
  // ceiling). Real long-running media generation should instead be picked up by a time-driven
  // trigger calling runJob_ — see JobQueue.gs.
  runJob_(jobId, routeCapabilityRequest_);
  return getJobStatus_(jobId);
}

function handleJobStatus_(request) {
  return getJobStatus_(request.jobId);
}
