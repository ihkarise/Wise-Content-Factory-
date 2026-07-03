/**
 * Tiny internal helper shared by the non-Meta-family providers (X, LinkedIn, YouTube each speak a
 * different API, so they don't share metaGraphHelpers.js, but they all need this one thing).
 */

/** Reads a response body for an error message without ever throwing itself. */
export async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
