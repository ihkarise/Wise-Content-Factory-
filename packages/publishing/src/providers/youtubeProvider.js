/**
 * YouTube publishing provider, via the YouTube Data API v3's resumable upload flow: initiate
 * (`POST /upload/youtube/v3/videos?uploadType=resumable`, get an upload URL back in the
 * `Location` header), then `PUT` the actual video bytes to that URL. Unlike the Meta-family
 * providers (which just hand Graph API a `video_url` and let Meta fetch it), YouTube's resumable
 * upload wants the bytes streamed to it directly, so this provider fetches `mediaUrls[0]` itself
 * and re-uploads it.
 *
 * YouTube natively supports scheduled publishing (`status.privacyStatus: 'private'` +
 * `status.publishAt: <ISO 8601>`), so `schedulePublish` returns `nativelyScheduled: true` — no
 * caller-driven job needed, unlike Instagram/Threads/X/LinkedIn.
 *
 * Same conventions as every provider: no access token -> healthStatus 'unavailable', token
 * injected by the caller, fetchImpl injectable for testing.
 */
import { definePublishingProvider } from '../publishingProviderInterface.js';
import { safeText } from '../httpHelpers.js';

const UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';
const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
// Metadata calls (auth, status, upload init) are quick; a hung upstream would otherwise tie up
// the request indefinitely since Node's fetch has no default timeout. Transferring the actual
// video bytes (fetching the source, then uploading it) legitimately takes much longer, so those
// get a separate, more generous budget.
const METADATA_TIMEOUT_MS = 30_000;
const TRANSFER_TIMEOUT_MS = 180_000;

/**
 * @param {{accessToken?: string, id?: string, fetchImpl?: typeof fetch}} options
 */
export function createYoutubeProvider({ accessToken, id = 'youtube', fetchImpl = globalThis.fetch } = {}) {
  const configured = Boolean(accessToken);

  async function uploadVideo(content, { privacyStatus, publishAt }) {
    const initResponse = await fetchImpl(`${UPLOAD_URL}?uploadType=resumable&part=snippet,status`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-type': content.mimeType || 'video/mp4',
      },
      body: JSON.stringify({
        snippet: { title: content.title || (content.text || 'Untitled').slice(0, 100), description: content.text || '' },
        status: { privacyStatus, ...(publishAt ? { publishAt } : {}) },
      }),
      signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
    });
    if (!initResponse.ok) throw new Error(`YouTube upload init error ${initResponse.status}: ${await safeText(initResponse)}`);
    const uploadUrl = initResponse.headers.get('location');
    if (!uploadUrl) throw new Error('YouTube API did not return a resumable upload URL.');

    const sourceUrl = content.mediaUrls?.[0];
    if (!sourceUrl) throw new Error('YouTube publishing requires content.mediaUrls[0] pointing at the source video.');
    const sourceResponse = await fetchImpl(sourceUrl, { signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS) });
    if (!sourceResponse.ok) throw new Error(`Could not fetch source video from "${sourceUrl}" (status ${sourceResponse.status}).`);
    const videoBytes = await sourceResponse.arrayBuffer();

    const uploadResponse = await fetchImpl(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': content.mimeType || 'video/mp4' },
      body: videoBytes,
      signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS),
    });
    if (!uploadResponse.ok) throw new Error(`YouTube upload error ${uploadResponse.status}: ${await safeText(uploadResponse)}`);
    return uploadResponse.json();
  }

  function assertConfigured() {
    if (!configured) throw new Error(`Publishing provider "${id}" has no accessToken configured.`);
  }

  return definePublishingProvider({
    id,
    platform: 'youtube',
    healthStatus: configured ? 'healthy' : 'unavailable',
    async authenticate() {
      assertConfigured();
      const response = await fetchImpl(`${API_BASE_URL}/channels?part=id&mine=true`, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`YouTube auth check error ${response.status}: ${await safeText(response)}`);
      const data = await response.json();
      return { authenticated: true, accountId: data.items?.[0]?.id };
    },
    async createDraft(content) {
      assertConfigured();
      const data = await uploadVideo(content, { privacyStatus: 'private' });
      return { platformPostId: data.id, status: 'draft', nativelyScheduled: false, publishAt: null };
    },
    async schedulePublish(content, publishAt) {
      assertConfigured();
      const data = await uploadVideo(content, { privacyStatus: 'private', publishAt });
      return { platformPostId: data.id, status: 'scheduled', nativelyScheduled: true, publishAt };
    },
    async publishNow(content) {
      assertConfigured();
      const data = await uploadVideo(content, { privacyStatus: 'public' });
      return { platformPostId: data.id, status: 'published', nativelyScheduled: true, publishAt: null };
    },
    async getUploadStatus(platformPostId) {
      const response = await fetchImpl(`${API_BASE_URL}/videos?part=status,processingDetails&id=${platformPostId}`, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`YouTube status check error ${response.status}: ${await safeText(response)}`);
      const data = await response.json();
      const item = data.items?.[0];
      return { status: item?.processingDetails?.processingStatus || item?.status?.uploadStatus || 'unknown', detail: item };
    },
  });
}

