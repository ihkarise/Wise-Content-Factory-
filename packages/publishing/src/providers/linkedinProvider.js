/**
 * LinkedIn publishing provider, via the UGC Posts API (`POST /v2/ugcPosts`). Image attachments go
 * through LinkedIn's asset-registration flow (`POST /v2/assets?action=registerUpload` to get an
 * upload URL and asset URN, `PUT` the image bytes, then reference the asset URN in the post) —
 * the officially documented "Share on LinkedIn" flow. Video upload is a separate, more involved
 * chunked-upload protocol not implemented here — see "Future Extension Notes" in
 * packages/publishing/README.md.
 *
 * IMPORTANT: LinkedIn's public API has no server-side draft state and no native scheduled
 * publishing for organic UGC posts (`lifecycleState` only supports `PUBLISHED` here — `DRAFT` is
 * restricted to LinkedIn's own partner-gated tools). So `createDraft`/`schedulePublish` never call
 * LinkedIn's API at all — nothing exists on LinkedIn's side until `publishNow` runs. Both return
 * `nativelyScheduled: false` and a `platformPostId: null` with an explanatory `note`; a caller
 * that wants a real scheduled LinkedIn post must invoke `publishNow` itself at the right time.
 *
 * Same conventions as every provider: no access token -> healthStatus 'unavailable', token/author
 * URN injected by the caller, fetchImpl injectable for testing.
 */
import { definePublishingProvider } from '../publishingProviderInterface.js';

const API_BASE_URL = 'https://api.linkedin.com/v2';

/**
 * @param {{accessToken?: string, authorUrn?: string, id?: string, fetchImpl?: typeof fetch}} options
 */
export function createLinkedinProvider({ accessToken, authorUrn, id = 'linkedin', fetchImpl = globalThis.fetch } = {}) {
  const configured = Boolean(accessToken && authorUrn);
  const headers = () => ({
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
    'x-restli-protocol-version': '2.0.0',
  });

  async function uploadImageAsset(imageUrl) {
    const registerResponse = await fetchImpl(`${API_BASE_URL}/assets?action=registerUpload`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: authorUrn,
          serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
        },
      }),
    });
    if (!registerResponse.ok) throw new Error(`LinkedIn asset registration error ${registerResponse.status}: ${await safeText(registerResponse)}`);
    const registerData = await registerResponse.json();
    const uploadUrl = registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
    const asset = registerData.value?.asset;
    if (!uploadUrl || !asset) throw new Error('LinkedIn API did not return an upload URL/asset URN.');

    const sourceResponse = await fetchImpl(imageUrl);
    if (!sourceResponse.ok) throw new Error(`Could not fetch source image from "${imageUrl}" (status ${sourceResponse.status}).`);
    const imageBytes = await sourceResponse.arrayBuffer();
    const uploadResponse = await fetchImpl(uploadUrl, {
      method: 'PUT',
      headers: { authorization: `Bearer ${accessToken}` },
      body: imageBytes,
    });
    if (!uploadResponse.ok) throw new Error(`LinkedIn image upload error ${uploadResponse.status}: ${await safeText(uploadResponse)}`);
    return asset;
  }

  function assertConfigured() {
    if (!configured) throw new Error(`Publishing provider "${id}" has no accessToken/authorUrn configured.`);
  }

  return definePublishingProvider({
    id,
    platform: 'linkedin',
    healthStatus: configured ? 'healthy' : 'unavailable',
    async authenticate() {
      assertConfigured();
      const response = await fetchImpl(`${API_BASE_URL}/userinfo`, { headers: { authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(`LinkedIn auth check error ${response.status}: ${await safeText(response)}`);
      const data = await response.json();
      return { authenticated: true, accountId: data.sub };
    },
    async createDraft() {
      assertConfigured();
      return {
        platformPostId: null,
        status: 'draft',
        nativelyScheduled: false,
        publishAt: null,
        note: 'LinkedIn has no server-side draft API for UGC posts — nothing was created on LinkedIn. Call publishNow when ready.',
      };
    },
    async schedulePublish(content, publishAt) {
      assertConfigured();
      return {
        platformPostId: null,
        status: 'scheduled',
        nativelyScheduled: false,
        publishAt,
        note: 'LinkedIn has no native scheduled-publish API for UGC posts — nothing was created on LinkedIn. Call publishNow at publishAt via your own scheduler.',
      };
    },
    async publishNow(content) {
      assertConfigured();
      const hasImage = content.mediaType === 'image' && content.mediaUrls?.[0];
      const asset = hasImage ? await uploadImageAsset(content.mediaUrls[0]) : null;
      const response = await fetchImpl(`${API_BASE_URL}/ugcPosts`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          author: authorUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: content.text || '' },
              shareMediaCategory: hasImage ? 'IMAGE' : 'NONE',
              ...(hasImage ? { media: [{ status: 'READY', media: asset }] } : {}),
            },
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }),
      });
      if (!response.ok) throw new Error(`LinkedIn publish error ${response.status}: ${await safeText(response)}`);
      const postId = response.headers.get('x-restli-id') || (await response.json().catch(() => ({}))).id;
      return { platformPostId: postId, status: 'published', nativelyScheduled: true, publishAt: null };
    },
    async getUploadStatus(platformPostId) {
      const response = await fetchImpl(`${API_BASE_URL}/ugcPosts/${encodeURIComponent(platformPostId)}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(`LinkedIn status check error ${response.status}: ${await safeText(response)}`);
      const data = await response.json();
      return { status: data.lifecycleState || 'unknown', detail: data };
    },
  });
}

async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
