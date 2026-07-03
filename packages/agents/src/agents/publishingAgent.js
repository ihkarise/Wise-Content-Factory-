/**
 * Publishing Agent — the final step of a campaign pipeline (see
 * docs/architecture/AGENT_ORCHESTRATOR.md's "Publishing" agent group and
 * docs/architecture/STRATEGY_ENGINE.md's example marketing workflow, which ends in "Publishing").
 * Takes whatever content the upstream Caption/Image/Video Agents produced and hands it to
 * `ctx.publishingManager` (a `@wcf/publishing` `PublishingManager`), one platform per
 * `intent.platforms` entry. Never talks to a platform's REST API directly — same "Agents never
 * select providers" rule every other Agent follows, just for publishing providers instead of AI
 * providers.
 *
 * Publishing is optional the same way NotebookLM is optional (KNOWLEDGE_ENGINE.md): if no
 * `publishingManager` is injected, or a given platform has no configured provider, this agent
 * reports that plainly in its output instead of failing the whole pipeline — a content package
 * with unpublished assets is still a successful run.
 */

export function createPublishingAgent() {
  return {
    name: 'publishing_agent',
    capabilities: ['publishing'],
    async run(task, ctx) {
      const { intent, upstream, publishingManager } = ctx;
      const content = {
        text: firstUpstreamValue(upstream, 'caption') || intent.goal,
        mediaUrls: collectMediaUrls(upstream),
        mediaType: firstUpstreamValue(upstream, 'video') ? 'video' : firstUpstreamValue(upstream, 'image') ? 'image' : 'text',
      };
      const platforms = intent.platforms?.length ? intent.platforms : [];

      if (!publishingManager || !platforms.length) {
        return {
          output: { published: {}, skipped: true, reason: !publishingManager ? 'no publishingManager configured' : 'no platforms on this intent' },
          costUsd: 0,
        };
      }

      const results = await publishingManager.publishToMany(platforms, 'publishNow', content);
      const succeeded = Object.entries(results).filter(([, r]) => r.ok);
      return {
        output: { published: results },
        costUsd: 0,
        asset: succeeded.length
          ? {
              type: 'publish_receipt',
              platform: succeeded[0][0],
              content: results,
              metadata: { platforms, succeededCount: succeeded.length, failedCount: platforms.length - succeeded.length },
              providerId: 'publishing_agent',
            }
          : undefined,
      };
    },
  };
}

function firstUpstreamValue(upstream, key) {
  for (const result of Object.values(upstream || {})) {
    if (result?.output?.[key]) return result.output[key];
  }
  return null;
}

function collectMediaUrls(upstream) {
  const video = firstUpstreamValue(upstream, 'video');
  const image = firstUpstreamValue(upstream, 'image');
  const url = video?.videoUrl || image?.imageUrl || (typeof video === 'string' ? video : null) || (typeof image === 'string' ? image : null);
  return url ? [url] : [];
}
