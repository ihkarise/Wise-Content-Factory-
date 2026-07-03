/**
 * The only file you need to edit after deploying apps/gateway. Left blank, the app runs in a
 * fully local, zero-cost demo mode using the mock providers from @wcf/providers — no backend,
 * no API keys, nothing to configure. Set GATEWAY_URL to switch to real AI providers via the
 * secure Google Apps Script gateway (see apps/gateway/README.md).
 */
export const GATEWAY_URL = '';

// Seed brands from PRODUCT.md's initial three brands. Real deployments would load this from
// Brand Memory via the gateway instead of hard-coding it here.
export const BRANDS = [
  { id: 'wise-homeopathy', name: 'Wise Homeopathy' },
  { id: 'wiseaitechs', name: 'WiseAitechs' },
  { id: 'pillfill', name: 'PillFill' },
];
