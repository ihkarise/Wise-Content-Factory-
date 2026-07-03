/**
 * Publishing Manager — the single gateway between Wise Content Factory and every social platform,
 * mirroring `McpManager`'s role for MCP servers (`packages/infrastructure/src/mcp/mcpManager.js`)
 * and `ProviderRouter`'s role for AI providers. The Publishing Agent (see
 * docs/architecture/AGENT_ORCHESTRATOR.md, "Publishing Agent") always publishes through this
 * class, never by calling a platform's REST API directly.
 *
 * Unlike AI capability requests, publishing has no interchangeable-provider ranking — "publish to
 * Instagram" only ever means the Instagram provider, there's no cheaper substitute. So this
 * registry is keyed by platform name rather than ranked by cost tier; what's shared with
 * ProviderRouter/McpManager is the rest of the shape: register/unregister, a health check, and
 * "never let one platform's failure take down the others."
 */

export class PublishingManager {
  constructor() {
    /** @type {Map<string, import('./publishingProviderInterface.js').PublishingProvider>} */
    this.providers = new Map();
  }

  /** @param {import('./publishingProviderInterface.js').PublishingProvider} provider */
  registerProvider(provider) {
    if (!provider?.platform) throw new Error('Publishing provider must declare a "platform"');
    this.providers.set(provider.platform, provider);
  }

  unregisterProvider(platform) {
    this.providers.delete(platform);
  }

  listProviders() {
    return [...this.providers.values()];
  }

  /** @param {string} platform */
  getProvider(platform) {
    const provider = this.providers.get(platform);
    if (!provider) throw new Error(`No publishing provider registered for platform "${platform}".`);
    if (provider.healthStatus === 'unavailable') {
      throw new Error(`Publishing provider for platform "${platform}" is unavailable (not configured).`);
    }
    return provider;
  }

  /**
   * @param {string} platform
   * @param {'createDraft'|'schedulePublish'|'publishNow'} action
   * @param {...any} args
   */
  async publish(platform, action, ...args) {
    const provider = this.getProvider(platform);
    if (typeof provider[action] !== 'function') {
      throw new Error(`Publishing provider for platform "${platform}" does not support action "${action}".`);
    }
    return provider[action](...args);
  }

  /**
   * Fan a single piece of content out to several platforms in parallel. Never lets one platform's
   * failure prevent the others from publishing — matches the platform-wide "never terminate an
   * entire workflow because one [provider] is unavailable" rule.
   * @param {string[]} platforms
   * @param {'createDraft'|'schedulePublish'|'publishNow'} action
   * @param {import('./publishingProviderInterface.js').PublishContent} content
   * @param {string} [publishAt] required when action === 'schedulePublish'
   * @returns {Promise<Record<string, {ok: true, result: any}|{ok: false, error: string}>>}
   */
  async publishToMany(platforms, action, content, publishAt) {
    const entries = await Promise.all(
      platforms.map(async (platform) => {
        try {
          const result = await this.publish(platform, action, content, ...(publishAt !== undefined ? [publishAt] : []));
          return [platform, { ok: true, result }];
        } catch (err) {
          return [platform, { ok: false, error: err.message }];
        }
      })
    );
    return Object.fromEntries(entries);
  }
}
