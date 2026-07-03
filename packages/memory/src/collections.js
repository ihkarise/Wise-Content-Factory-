/**
 * Collection names and the documented `data` shape convention for each — matching the memory
 * levels in docs/architecture/PLATFORM_ARCHITECTURE.md ("Memory Architecture": Global, Brand,
 * Project, Conversation, Generation/AI Cache) plus this platform's Campaign, Asset, Prompt
 * Library, Template Library, and Knowledge Cache collections.
 *
 * `MemoryProvider.write(collection, key, data)` accepts any JSON-serializable `data` — these
 * `create*MemoryData` factories are optional convenience for producing a well-shaped payload
 * (the same role `packages/core/src/schemas/*.js`'s `create*` factories play for Intent/Execution
 * Plan/Capability Request), never a requirement enforced by MemoryManager or any provider.
 */

export const MEMORY_COLLECTIONS = [
  'global',
  'brand',
  'project',
  'campaign',
  'conversation',
  'asset',
  'promptLibrary',
  'templateLibrary',
  'knowledgeCache',
];

/**
 * @param {Partial<{
 *   identity: string, voice: string, style: string, colorPalette: string[],
 *   logoReferences: string[], products: string[], services: string[],
 *   previousCampaigns: string[], successfulHooks: string[], preferredCtas: string[],
 * }>} fields
 */
export function createBrandMemoryData(fields = {}) {
  return {
    identity: fields.identity ?? '',
    voice: fields.voice ?? '',
    style: fields.style ?? '',
    colorPalette: fields.colorPalette || [],
    logoReferences: fields.logoReferences || [],
    products: fields.products || [],
    services: fields.services || [],
    previousCampaigns: fields.previousCampaigns || [],
    successfulHooks: fields.successfulHooks || [],
    preferredCtas: fields.preferredCtas || [],
  };
}

/**
 * @param {Partial<{
 *   uploadedAssets: Object[], generatedAssets: Object[], research: Object[], scripts: Object[],
 *   storyboards: Object[], videos: Object[], images: Object[], publishingHistory: Object[],
 *   performanceMetadata: Object,
 * }>} fields
 */
export function createProjectMemoryData(fields = {}) {
  return {
    uploadedAssets: fields.uploadedAssets || [],
    generatedAssets: fields.generatedAssets || [],
    research: fields.research || [],
    scripts: fields.scripts || [],
    storyboards: fields.storyboards || [],
    videos: fields.videos || [],
    images: fields.images || [],
    publishingHistory: fields.publishingHistory || [],
    performanceMetadata: fields.performanceMetadata || {},
  };
}

/**
 * @param {Partial<{
 *   prompt: string, strategy: Object, outputs: Object[], providersUsed: string[],
 *   costEstimateUsd: number, generationTimeMs: number, revisions: Object[], finalAssets: Object[],
 * }>} fields
 */
export function createCampaignMemoryData(fields = {}) {
  return {
    prompt: fields.prompt ?? '',
    strategy: fields.strategy ?? {},
    outputs: fields.outputs || [],
    providersUsed: fields.providersUsed || [],
    costEstimateUsd: fields.costEstimateUsd ?? 0,
    generationTimeMs: fields.generationTimeMs ?? 0,
    revisions: fields.revisions || [],
    finalAssets: fields.finalAssets || [],
  };
}

/**
 * @param {Partial<{context: Object, userPreferences: Object, recentDecisions: Object[], workflowState: Object}>} fields
 */
export function createConversationMemoryData(fields = {}) {
  return {
    context: fields.context ?? {},
    userPreferences: fields.userPreferences ?? {},
    recentDecisions: fields.recentDecisions || [],
    workflowState: fields.workflowState ?? {},
  };
}
