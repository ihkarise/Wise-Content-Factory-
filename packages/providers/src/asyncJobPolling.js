/**
 * Shared submit-then-poll helper. Most async media-generation APIs (FLUX, HyperFrames, Veo, and
 * effectively every video-generation vendor) follow the same shape: submit a job, get back a
 * job/operation id or polling URL, then poll until it reports done. Factored out once here so
 * every provider that needs it reuses the same retry/timeout/error handling instead of
 * reimplementing it (CLAUDE.md: "Never duplicate business logic").
 */

const DEFAULT_INTERVAL_MS = 1000;
const DEFAULT_MAX_ATTEMPTS = 60; // 60s at the default interval — generous for image gen, tight for video

/**
 * @param {{
 *   fetchImpl: typeof fetch,
 *   poll: () => Promise<any>,
 *   isDone: (pollResult: any) => boolean,
 *   isFailed?: (pollResult: any) => boolean,
 *   getError?: (pollResult: any) => string,
 *   intervalMs?: number,
 *   maxAttempts?: number,
 * }} options
 * @returns {Promise<any>} the final poll result once `isDone` returns true
 */
export async function pollUntilComplete({
  poll,
  isDone,
  isFailed = () => false,
  getError = () => 'The generation job failed.',
  intervalMs = DEFAULT_INTERVAL_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await poll();
    if (isFailed(result)) throw new Error(getError(result));
    if (isDone(result)) return result;
    await sleep(intervalMs);
  }
  throw new Error(`Generation job did not complete after ${maxAttempts} poll attempts.`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
