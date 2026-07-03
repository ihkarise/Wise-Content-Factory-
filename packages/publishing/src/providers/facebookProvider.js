/**
 * Facebook Pages publishing provider, via the Meta Graph API (`/{page-id}/feed` for text posts,
 * `/{page-id}/photos` for image posts). Facebook natively supports scheduled publishing
 * (`published=false` + `scheduled_publish_time`), so `schedulePublish` here returns
 * `nativelyScheduled: true` — the platform itself will publish at the requested time, no caller
 * job needed.
 *
 * Same conventions as every AI provider: no access token -> healthStatus 'unavailable', the token
 * is injected by the caller (acquired via a real OAuth flow elsewhere — this adapter never
 * performs authorization itself), fetchImpl injectable for testing.
 */
import { definePublishingProvider } from '../publishingProviderInterface.js';
import { buildGraphUrl, graphRequest, toUnixSeconds } from '../metaGraphHelpers.js';

const DEFAULT_BASE_URL = 'https://graph.facebook.com/v19.0';

/**
 * @param {{pageId?: string, accessToken?: string, id?: string, baseUrl?: string, fetchImpl?: typeof fetch}} options
 */
export function createFacebookProvider({
  pageId,
  accessToken,
  id = 'facebook',
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  const configured = Boolean(pageId && accessToken);

  async function post(content, { published, scheduledPublishTime }) {
    const isPhoto = content.mediaType === 'image' && content.mediaUrls?.[0];
    const path = isPhoto ? `/${pageId}/photos` : `/${pageId}/feed`;
    const params = {
      access_token: accessToken,
      published,
      ...(scheduledPublishTime ? { scheduled_publish_time: scheduledPublishTime } : {}),
      ...(isPhoto ? { url: content.mediaUrls[0], caption: content.text } : { message: content.text }),
    };
    const data = await graphRequest(fetchImpl, buildGraphUrl(baseUrl, path, params), 'POST');
    return {
      platformPostId: data.id ?? data.post_id,
      status: published ? 'published' : scheduledPublishTime ? 'scheduled' : 'draft',
      nativelyScheduled: true,
      publishAt: scheduledPublishTime ? new Date(scheduledPublishTime * 1000).toISOString() : null,
    };
  }

  return definePublishingProvider({
    id,
    platform: 'facebook',
    healthStatus: configured ? 'healthy' : 'unavailable',
    async authenticate() {
      if (!configured) throw new Error(`Publishing provider "${id}" has no pageId/accessToken configured.`);
      const data = await graphRequest(fetchImpl, buildGraphUrl(baseUrl, `/${pageId}`, { fields: 'id,name', access_token: accessToken }));
      return { authenticated: true, accountId: data.id };
    },
    async createDraft(content) {
      if (!configured) throw new Error(`Publishing provider "${id}" has no pageId/accessToken configured.`);
      return post(content, { published: false });
    },
    async schedulePublish(content, publishAt) {
      if (!configured) throw new Error(`Publishing provider "${id}" has no pageId/accessToken configured.`);
      return post(content, { published: false, scheduledPublishTime: toUnixSeconds(publishAt) });
    },
    async publishNow(content) {
      if (!configured) throw new Error(`Publishing provider "${id}" has no pageId/accessToken configured.`);
      return post(content, { published: true });
    },
    async getUploadStatus(platformPostId) {
      const data = await graphRequest(
        fetchImpl,
        buildGraphUrl(baseUrl, `/${platformPostId}`, { fields: 'id,status_type', access_token: accessToken })
      );
      return { status: data.status_type || 'unknown', detail: data };
    },
  });
}
