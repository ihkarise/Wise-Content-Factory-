/**
 * X (Twitter) publishing provider, via the X API v2 (`POST /2/tweets`). Media still goes through
 * the older v1.1 media upload endpoint (`upload.x.com/1.1/media/upload.json`), which is what X's
 * own v2 posting docs point to as of this writing — there is no v2 media upload endpoint yet.
 *
 * IMPORTANT: the standard X API has no native draft or scheduled-publish support for organic
 * posts (that requires the separate Ads API or a third-party scheduler polling loop). Like
 * LinkedIn, `createDraft`/`schedulePublish` never call X's API — nothing is created there until
 * `publishNow` runs; both return `nativelyScheduled: false` with an explanatory `note`.
 *
 * Same conventions as every provider: no access token -> healthStatus 'unavailable', token
 * injected by the caller, fetchImpl injectable for testing.
 */
import { definePublishingProvider } from '../publishingProviderInterface.js';
import { safeText } from '../httpHelpers.js';

const API_BASE_URL = 'https://api.x.com/2';
const MEDIA_UPLOAD_URL = 'https://upload.x.com/1.1/media/upload.json';
// Metadata calls are quick; a hung upstream would otherwise tie up the request indefinitely since
// Node's fetch has no default timeout. Media transfer (fetch + upload) gets a longer budget.
const METADATA_TIMEOUT_MS = 30_000;
const TRANSFER_TIMEOUT_MS = 120_000;

/**
 * @param {{accessToken?: string, id?: string, fetchImpl?: typeof fetch}} options
 */
export function createXProvider({ accessToken, id = 'x', fetchImpl = globalThis.fetch } = {}) {
  const configured = Boolean(accessToken);

  async function uploadMedia(mediaUrl) {
    const sourceResponse = await fetchImpl(mediaUrl, { signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS) });
    if (!sourceResponse.ok) throw new Error(`Could not fetch source media from "${mediaUrl}" (status ${sourceResponse.status}).`);
    const bytes = await sourceResponse.arrayBuffer();
    const form = new FormData();
    form.append('media', new Blob([bytes]));
    const uploadResponse = await fetchImpl(MEDIA_UPLOAD_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
      signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS),
    });
    if (!uploadResponse.ok) throw new Error(`X media upload error ${uploadResponse.status}: ${await safeText(uploadResponse)}`);
    const data = await uploadResponse.json();
    return data.media_id_string;
  }

  function assertConfigured() {
    if (!configured) throw new Error(`Publishing provider "${id}" has no accessToken configured.`);
  }

  return definePublishingProvider({
    id,
    platform: 'x',
    healthStatus: configured ? 'healthy' : 'unavailable',
    async authenticate() {
      assertConfigured();
      const response = await fetchImpl(`${API_BASE_URL}/users/me`, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`X auth check error ${response.status}: ${await safeText(response)}`);
      const data = await response.json();
      return { authenticated: true, accountId: data.data?.id };
    },
    async createDraft() {
      assertConfigured();
      return {
        platformPostId: null,
        status: 'draft',
        nativelyScheduled: false,
        publishAt: null,
        note: 'X has no draft API for organic posts — nothing was created on X. Call publishNow when ready.',
      };
    },
    async schedulePublish(content, publishAt) {
      assertConfigured();
      return {
        platformPostId: null,
        status: 'scheduled',
        nativelyScheduled: false,
        publishAt,
        note: 'X has no native scheduled-publish API for organic posts — nothing was created on X. Call publishNow at publishAt via your own scheduler.',
      };
    },
    async publishNow(content) {
      assertConfigured();
      const hasMedia = content.mediaUrls?.[0];
      const mediaId = hasMedia ? await uploadMedia(content.mediaUrls[0]) : null;
      const response = await fetchImpl(`${API_BASE_URL}/tweets`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ text: content.text || '', ...(mediaId ? { media: { media_ids: [mediaId] } } : {}) }),
        signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`X publish error ${response.status}: ${await safeText(response)}`);
      const data = await response.json();
      return { platformPostId: data.data?.id, status: 'published', nativelyScheduled: true, publishAt: null };
    },
    async getUploadStatus(platformPostId) {
      const response = await fetchImpl(`${API_BASE_URL}/tweets/${platformPostId}`, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`X status check error ${response.status}: ${await safeText(response)}`);
      const data = await response.json();
      return { status: data.data ? 'published' : 'unknown', detail: data };
    },
  });
}

