/**
 * Instagram publishing provider, via the Instagram Graph API's two-step container flow:
 * `POST /{ig-user-id}/media` creates a media container (the closest thing IG's public API has to
 * a "draft" — it exists but is not visible on the profile), then
 * `POST /{ig-user-id}/media_publish` with that container's id actually publishes it.
 *
 * IMPORTANT — Instagram's public Graph API has no native "publish at this future time" parameter
 * for regular posts (unlike Facebook's `scheduled_publish_time`). `schedulePublish` here creates
 * the container (so it's ready to go) and returns `nativelyScheduled: false` — the caller is
 * responsible for invoking `publishNow`-equivalent (`getUploadStatus` + `media_publish`, exposed
 * here as re-calling `publishNow` isn't quite right since the container already exists — see
 * `packages/publishing/README.md`'s Failure Modes) at the right time via its own job scheduler
 * (e.g. `apps/gateway/JobQueue.gs`). Never assume every platform in this package can natively
 * schedule; always check `nativelyScheduled`.
 *
 * Same conventions as every provider: no access token -> healthStatus 'unavailable', token
 * injected by the caller, fetchImpl injectable for testing.
 */
import { definePublishingProvider } from '../publishingProviderInterface.js';
import { buildGraphUrl, graphRequest } from '../metaGraphHelpers.js';

const DEFAULT_BASE_URL = 'https://graph.facebook.com/v19.0';

/**
 * @param {{igUserId?: string, accessToken?: string, id?: string, baseUrl?: string, fetchImpl?: typeof fetch}} options
 */
export function createInstagramProvider({
  igUserId,
  accessToken,
  id = 'instagram',
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  const configured = Boolean(igUserId && accessToken);

  async function createContainer(content) {
    const isVideo = content.mediaType === 'video';
    const params = {
      access_token: accessToken,
      caption: content.text,
      ...(isVideo ? { media_type: 'REELS', video_url: content.mediaUrls?.[0] } : { image_url: content.mediaUrls?.[0] }),
    };
    return graphRequest(fetchImpl, buildGraphUrl(baseUrl, `/${igUserId}/media`, params), 'POST');
  }

  async function publishContainer(creationId) {
    const data = await graphRequest(
      fetchImpl,
      buildGraphUrl(baseUrl, `/${igUserId}/media_publish`, { access_token: accessToken, creation_id: creationId }),
      'POST'
    );
    return data.id;
  }

  function assertConfigured() {
    if (!configured) throw new Error(`Publishing provider "${id}" has no igUserId/accessToken configured.`);
  }

  return definePublishingProvider({
    id,
    platform: 'instagram',
    healthStatus: configured ? 'healthy' : 'unavailable',
    async authenticate() {
      assertConfigured();
      const data = await graphRequest(fetchImpl, buildGraphUrl(baseUrl, `/${igUserId}`, { fields: 'id,username', access_token: accessToken }));
      return { authenticated: true, accountId: data.id };
    },
    async createDraft(content) {
      assertConfigured();
      const container = await createContainer(content);
      return { platformPostId: container.id, status: 'draft', nativelyScheduled: false, publishAt: null };
    },
    async schedulePublish(content, publishAt) {
      assertConfigured();
      const container = await createContainer(content);
      return {
        platformPostId: container.id,
        status: 'scheduled',
        nativelyScheduled: false,
        publishAt,
        note: 'Instagram has no native scheduled-publish API. The container is ready; call publishNow-equivalent (media_publish) at publishAt via your own scheduler.',
      };
    },
    async publishNow(content) {
      assertConfigured();
      const container = await createContainer(content);
      const mediaId = await publishContainer(container.id);
      return { platformPostId: mediaId, status: 'published', nativelyScheduled: true, publishAt: null };
    },
    async getUploadStatus(platformPostId) {
      const data = await graphRequest(
        fetchImpl,
        buildGraphUrl(baseUrl, `/${platformPostId}`, { fields: 'status_code,status', access_token: accessToken })
      );
      return { status: data.status_code || 'unknown', detail: data };
    },
  });
}
