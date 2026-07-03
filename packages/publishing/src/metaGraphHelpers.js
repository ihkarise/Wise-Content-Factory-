/**
 * Shared request helpers for the three Meta-family publishing providers (Facebook, Instagram,
 * Threads), which all speak the same query-string-parameters-over-HTTPS Graph API convention.
 * Kept here once instead of duplicated three times, per CLAUDE.md's "never duplicate business
 * logic."
 */

/** @param {string} baseUrl @param {string} path @param {Record<string, any>} params */
export function buildGraphUrl(baseUrl, path, params = {}) {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

// A hung upstream connection would otherwise tie up the request indefinitely — Node's fetch has
// no default timeout of its own.
const DEFAULT_TIMEOUT_MS = 30_000;

/** @param {typeof fetch} fetchImpl @param {string} url @param {'GET'|'POST'} [method] */
export async function graphRequest(fetchImpl, url, method = 'GET') {
  const response = await fetchImpl(url, { method, signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Graph API error ${response.status}`);
  }
  return data;
}

/** Graph API scheduling wants Unix seconds; every provider's public interface takes ISO 8601. */
export function toUnixSeconds(isoTimestamp) {
  const ms = new Date(isoTimestamp).getTime();
  if (Number.isNaN(ms)) throw new Error(`Invalid publishAt timestamp: "${isoTimestamp}"`);
  return Math.floor(ms / 1000);
}
