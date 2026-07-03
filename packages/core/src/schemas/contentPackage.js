/**
 * Content Package schema — the final output of the Content Factory / Agent Orchestrator pipeline.
 * See docs/architecture/CONTENT_FACTORY.md.
 *
 * @typedef {Object} ContentAsset
 * @property {string} id
 * @property {string} type          e.g. "blog_post", "caption", "video", "image", "email"
 * @property {string} platform      e.g. "instagram", "linkedin", "blog", "email"
 * @property {*} content            The generated payload (text, or a reference/URL for media).
 * @property {Object} metadata      SEO title, hashtags, alt text, duration, etc.
 * @property {string} providerId    Which provider produced this asset (for traceability).
 * @property {boolean} fromCache
 *
 * @typedef {Object} ContentPackageObject
 * @property {string} id
 * @property {string} intentId
 * @property {string} executionPlanId
 * @property {string|null} brandId
 * @property {string|null} projectId
 * @property {ContentAsset[]} assets
 * @property {{estimatedUsd: number, actualUsd: number}} cost
 * @property {string} qaStatus      "pending" | "passed" | "failed"
 * @property {string} createdAt     ISO timestamp
 */

let counter = 0;
function nextId(prefix) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

/**
 * @param {Partial<ContentPackageObject>} fields
 * @returns {ContentPackageObject}
 */
export function createContentPackage(fields = {}) {
  return {
    id: fields.id || nextId('pkg'),
    intentId: fields.intentId || '',
    executionPlanId: fields.executionPlanId || '',
    brandId: fields.brandId ?? null,
    projectId: fields.projectId ?? null,
    assets: fields.assets || [],
    cost: {
      estimatedUsd: fields.cost?.estimatedUsd ?? 0,
      actualUsd: fields.cost?.actualUsd ?? 0,
    },
    qaStatus: fields.qaStatus || 'pending',
    createdAt: fields.createdAt || new Date().toISOString(),
  };
}

/**
 * @param {Partial<ContentAsset>} fields
 * @returns {ContentAsset}
 */
export function createContentAsset(fields = {}) {
  return {
    id: fields.id || nextId('asset'),
    type: fields.type || 'text',
    platform: fields.platform || 'generic',
    content: fields.content ?? null,
    metadata: fields.metadata || {},
    providerId: fields.providerId || 'unknown',
    fromCache: fields.fromCache ?? false,
  };
}
