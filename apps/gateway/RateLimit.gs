/**
 * Per-user rate limiting via CacheService.
 *
 * KNOWN LIMITATION (Architecture Review Report, Security Review #4): CacheService get/put is not
 * atomic, so concurrent invocations can race past the limit. Acceptable for a single-owner v1
 * deployment; move this to OmniRoute (or a real atomic counter) before scaling to many
 * simultaneous users.
 */

var RATE_LIMIT_WINDOW_SECONDS = 60;
var RATE_LIMIT_MAX_REQUESTS = 30;

/**
 * @param {string} userId
 * @throws if the user has exceeded RATE_LIMIT_MAX_REQUESTS in the current window.
 */
function enforceRateLimit_(userId) {
  var cache = CacheService.getScriptCache();
  var key = 'ratelimit:' + userId + ':' + Math.floor(Date.now() / (RATE_LIMIT_WINDOW_SECONDS * 1000));
  var current = Number(cache.get(key) || '0');
  if (current >= RATE_LIMIT_MAX_REQUESTS) {
    throw new Error('Rate limit exceeded: max ' + RATE_LIMIT_MAX_REQUESTS + ' requests per ' + RATE_LIMIT_WINDOW_SECONDS + 's');
  }
  cache.put(key, String(current + 1), RATE_LIMIT_WINDOW_SECONDS + 5);
}
