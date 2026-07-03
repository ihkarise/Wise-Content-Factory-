/**
 * The only place this gateway is allowed to hold or use an AI provider credential. Mirrors
 * "Never expose provider secrets... The browser never communicates directly with AI providers"
 * (docs/architecture/SECURITY_ARCHITECTURE.md). Two modes, chosen by which Script Properties are set:
 *
 *   1. OMNIROUTE_ENDPOINT set  -> relay the capability request to a hosted OmniRoute instance
 *      (see packages/infrastructure/src/omniroute.js for the reference implementation of what
 *      that service should do: cache, rank providers, retry/failover, observability).
 *   2. Otherwise               -> call Anthropic directly as a minimal working fallback, so this
 *      gateway is useful standalone without standing up a separate OmniRoute deployment first.
 */

function routeCapabilityRequest_(capabilityRequest) {
  var endpoint = PropertiesService.getScriptProperties().getProperty('OMNIROUTE_ENDPOINT');
  if (endpoint) return callOmniRouteHttp_(endpoint, capabilityRequest);
  return callAnthropicDirect_(capabilityRequest);
}

function callOmniRouteHttp_(endpoint, capabilityRequest) {
  var apiKey = getDecryptedScriptSecret_('OMNIROUTE_API_KEY');
  var response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(capabilityRequest),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() >= 300) {
    throw new Error('OmniRoute request failed (' + response.getResponseCode() + '): ' + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}

function callAnthropicDirect_(capabilityRequest) {
  if (['generate_text', 'summarize', 'translate', 'reason', 'analyze'].indexOf(capabilityRequest.capability) === -1) {
    throw new Error('No fallback provider configured for capability "' + capabilityRequest.capability + '". Set OMNIROUTE_ENDPOINT.');
  }
  var apiKey = getDecryptedScriptSecret_('ANTHROPIC_API_KEY');
  var prompt = capabilityRequest.input.prompt || capabilityRequest.input.text || capabilityRequest.input.question || JSON.stringify(capabilityRequest.input);
  var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: 'claude-3-5-haiku-latest',
      max_tokens: capabilityRequest.input.maxTokens || 512,
      messages: [{ role: 'user', content: prompt }],
    }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() >= 300) {
    throw new Error('Anthropic API error (' + response.getResponseCode() + '): ' + response.getContentText());
  }
  var data = JSON.parse(response.getContentText());
  var output = (data.content || []).map(function (block) { return block.text; }).join('');
  return { output: output, providerId: 'anthropic-direct', fromCache: false };
}
