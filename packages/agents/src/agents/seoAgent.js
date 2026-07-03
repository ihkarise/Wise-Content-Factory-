/**
 * SEO Agent — the last content-shaping step for text-first output types (blog posts, emails). It
 * repackages the upstream script into the final deliverable with SEO metadata attached.
 */
import { createCapabilityRequest } from '@wcf/core';

export function createSeoAgent() {
  return {
    name: 'seo_agent',
    capabilities: ['seo_optimization'],
    async run(task, ctx) {
      const { intent, upstream } = ctx;
      const script = firstUpstreamScript(upstream);
      const response = await ctx.omniroute.request(
        createCapabilityRequest({
          brandId: intent.brandId,
          capability: 'summarize',
          input: { text: script || intent.goal },
        })
      );
      const seoTitle = truncate(response.output, 60);
      return {
        output: { finalText: script, seoTitle },
        costUsd: response.costUsd,
        asset: {
          type: intent.outputTypes[0] || 'blog_post',
          platform: intent.platforms[0] || 'blog',
          content: script,
          metadata: { seoTitle, keywords: extractKeywords(script) },
          providerId: 'seo_agent',
        },
      };
    },
  };
}

function firstUpstreamScript(upstream) {
  for (const result of Object.values(upstream || {})) {
    if (result?.output?.script) return result.output.script;
  }
  return null;
}

function extractKeywords(text) {
  if (!text) return [];
  const words = text.toLowerCase().match(/[a-z]{5,}/g) || [];
  return [...new Set(words)].slice(0, 5);
}

function truncate(text, max) {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
