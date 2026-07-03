/**
 * Retry Manager — failures should be automatic. Retries a single provider, then fails over to the
 * next-ranked provider, and never terminates an entire workflow because one provider failed.
 * See docs/architecture/AI_INFRASTRUCTURE.md ("Retry Manager") and
 * docs/architecture/OMNIROUTE_INTEGRATION.md ("Failover chain").
 */

/**
 * @param {() => Promise<any>} fn
 * @param {{retries?: number, baseDelayMs?: number, onAttemptError?: (err: Error, attempt: number) => void}} [options]
 */
export async function withExponentialBackoff(fn, options = {}) {
  const { retries = 2, baseDelayMs = 50, onAttemptError } = options;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      onAttemptError?.(err, attempt);
      if (attempt < retries) {
        const delay = baseDelayMs * 2 ** attempt;
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

/**
 * Try each provider in order (already ranked by the Cost Optimizer / Provider Router). Each
 * provider gets its own retry-with-backoff budget before failover to the next one.
 *
 * @param {Array<{id: string, execute: () => Promise<any>}>} rankedProviders
 * @param {{retriesPerProvider?: number, baseDelayMs?: number, onProviderFailover?: (from: string, to: string|null, err: Error) => void}} [options]
 */
export async function executeWithFailover(rankedProviders, options = {}) {
  const { retriesPerProvider = 1, baseDelayMs = 25, onProviderFailover } = options;
  if (!rankedProviders.length) {
    throw new Error('No providers available to fulfil this capability request.');
  }
  const attemptedProviderIds = [];
  let lastError;
  for (let i = 0; i < rankedProviders.length; i += 1) {
    const provider = rankedProviders[i];
    attemptedProviderIds.push(provider.id);
    try {
      const result = await withExponentialBackoff(() => provider.execute(), {
        retries: retriesPerProvider,
        baseDelayMs,
      });
      return { result, providerId: provider.id, attemptedProviderIds };
    } catch (err) {
      lastError = err;
      const next = rankedProviders[i + 1];
      onProviderFailover?.(provider.id, next?.id ?? null, err);
    }
  }
  const graceful = new Error(
    `All ${rankedProviders.length} provider(s) failed for this request: ${attemptedProviderIds.join(', ')}. Last error: ${lastError?.message}`
  );
  graceful.attemptedProviderIds = attemptedProviderIds;
  graceful.cause = lastError;
  throw graceful;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
