/**
 * Every publishing provider (Instagram, Facebook, YouTube, LinkedIn, X, Threads, ...) must
 * implement the same interface, mirroring how `packages/providers/src/providerInterface.js`
 * enforces one shape for every AI provider (CLAUDE.md: "Every provider must implement the same
 * interface"). The Strategy Engine and Agent Orchestrator never call a platform's REST API
 * directly — they always go through a `PublishingProvider`, registered with `PublishingManager`.
 *
 * @typedef {Object} PublishContent
 * @property {string} [text] Caption/body text.
 * @property {string} [title] Title, where the platform has one (e.g. YouTube).
 * @property {string[]} [mediaUrls] Publicly reachable URLs of images/video to attach.
 * @property {'text'|'image'|'video'} [mediaType]
 *
 * @typedef {Object} PublishResult
 * @property {string} platformPostId Id assigned by the platform (post/video/tweet/container id).
 * @property {'draft'|'scheduled'|'published'} status
 * @property {boolean} nativelyScheduled Whether the platform itself will publish this at
 *   `publishAt` (true), or whether the caller must invoke `publishNow` again at the right time
 *   because the platform has no native scheduling API (false) — see each provider's file for
 *   which case it is. Never assume every platform can schedule; check this flag.
 * @property {string|null} publishAt ISO 8601 timestamp, when scheduled.
 *
 * @typedef {Object} PublishingProvider
 * @property {string} id
 * @property {string} platform
 * @property {'healthy'|'unavailable'} healthStatus
 * @property {() => Promise<{authenticated: boolean, accountId?: string}>} authenticate
 *   Verifies the injected credential is currently usable (a lightweight "who am I" call), never
 *   performs an OAuth authorization-code exchange itself — that flow belongs to a higher layer
 *   (a future browser/gateway OAuth flow), the same way AI providers never acquire their own API
 *   keys, only use ones injected by the caller.
 * @property {(content: PublishContent) => Promise<PublishResult>} createDraft
 * @property {(content: PublishContent, publishAt: string) => Promise<PublishResult>} schedulePublish
 * @property {(content: PublishContent) => Promise<PublishResult>} publishNow
 * @property {(platformPostId: string) => Promise<{status: string, detail?: any}>} getUploadStatus
 * @property {(platformPostId: string) => Promise<any>} getAnalytics Stubbed by default — see
 *   "Future Extension Notes" in packages/publishing/README.md.
 */

const REQUIRED_FUNCTIONS = ['authenticate', 'createDraft', 'schedulePublish', 'publishNow', 'getUploadStatus'];

/**
 * @param {Partial<PublishingProvider>} fields
 * @returns {PublishingProvider}
 */
export function definePublishingProvider(fields) {
  for (const fn of REQUIRED_FUNCTIONS) {
    if (typeof fields[fn] !== 'function') {
      throw new Error(`Publishing provider "${fields.id ?? '(unnamed)'}" is missing required function "${fn}"`);
    }
  }
  return {
    id: fields.id,
    platform: fields.platform || fields.id,
    healthStatus: fields.healthStatus ?? 'healthy',
    authenticate: fields.authenticate,
    createDraft: fields.createDraft,
    schedulePublish: fields.schedulePublish,
    publishNow: fields.publishNow,
    getUploadStatus: fields.getUploadStatus,
    getAnalytics:
      fields.getAnalytics ||
      (async () => {
        throw new Error(
          `Analytics retrieval is not implemented for "${fields.id ?? '(unnamed)'}" yet — see "Future Extension Notes" in packages/publishing/README.md.`
        );
      }),
  };
}
