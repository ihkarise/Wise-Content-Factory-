/**
 * Threads publishing provider, via Meta's Threads API (`graph.threads.net`) — the same two-step
 * container pattern as Instagram: `POST /{threads-user-id}/threads` creates a container, then
 * `POST /{threads-user-id}/threads_publish` publishes it.
 *
 * IMPORTANT — like Instagram, the Threads API has no native scheduled-publish parameter.
 * `schedulePublish` creates the container and returns `nativelyScheduled: false`; the caller must
 * drive the actual publish at the right time via its own scheduler. See instagramProvider.js and
 * packages/publishing/README.md's Failure Modes for the same caveat spelled out in full.
 *
 * Same conventions as every provider: no access token -> healthStatus 'unavailable', token
 * injected by the caller, fetchImpl injectable for testing.
 */
import { definePublishingProvider } from '../publishingProviderInterface.js';
import { buildGraphUrl, graphRequest } from '../metaGraphHelpers.js';

const DEFAULT_BASE_URL = 'https://graph.threads.net/v1.0';

/**
 * @param {{threadsUserId?: string, accessToken?: string, id?: string, baseUrl?: string, fetchImpl?: typeof fetch}} options
 */
export function createThreadsProvider({
  threadsUserId,
  accessToken,
  id = 'threads',
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  const configured = Boolean(threadsUserId && accessToken);

  async function createContainer(content) {
    const mediaType = content.mediaType === 'video' ? 'VIDEO' : content.mediaType === 'image' ? 'IMAGE' : 'TEXT';
    const params = {
      access_token: accessToken,
      media_type: mediaType,
      text: content.text,
      ...(mediaType === 'IMAGE' ? { image_url: content.mediaUrls?.[0] } : {}),
      ...(mediaType === 'VIDEO' ? { video_url: content.mediaUrls?.[0] } : {}),
    };
    return graphRequest(fetchImpl, buildGraphUrl(baseUrl, `/${threadsUserId}/threads`, params), 'POST');
  }

  async function publishContainer(creationId) {
    const data = await graphRequest(
      fetchImpl,
      buildGraphUrl(baseUrl, `/${threadsUserId}/threads_publish`, { access_token: accessToken, creation_id: creationId }),
      'POST'
    );
    return data.id;
  }

  function assertConfigured() {
    if (!configured) throw new Error(`Publishing provider "${id}" has no threadsUserId/accessToken configured.`);
  }

  return definePublishingProvider({
    id,
    platform: 'threads',
    healthStatus: configured ? 'healthy' : 'unavailable',
    async authenticate() {
      assertConfigured();
      const data = await graphRequest(fetchImpl, buildGraphUrl(baseUrl, `/${threadsUserId}`, { fields: 'id,username', access_token: accessToken }));
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
        note: 'Threads has no native scheduled-publish API. The container is ready; call threads_publish at publishAt via your own scheduler.',
      };
    },
    async publishNow(content) {
      assertConfigured();
      const container = await createContainer(content);
      const postId = await publishContainer(container.id);
      return { platformPostId: postId, status: 'published', nativelyScheduled: true, publishAt: null };
    },
    async getUploadStatus(platformPostId) {
      const data = await graphRequest(
        fetchImpl,
        buildGraphUrl(baseUrl, `/${platformPostId}`, { fields: 'status', access_token: accessToken })
      );
      return { status: data.status || 'unknown', detail: data };
    },
  });
}
