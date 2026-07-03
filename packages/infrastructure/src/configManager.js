/**
 * Configuration Manager — layered configuration. Higher layers override lower layers only when
 * they actually define a value. See docs/architecture/PLATFORM_ARCHITECTURE.md ("Configuration System"):
 *
 *   Global -> Brand -> Project -> Session -> Runtime
 */

const LAYER_ORDER = ['global', 'brand', 'project', 'session', 'runtime'];

export class ConfigManager {
  constructor() {
    /** @type {Record<string, Record<string, any>>} */
    this.layers = Object.fromEntries(LAYER_ORDER.map((l) => [l, {}]));
  }

  /**
   * @param {'global'|'brand'|'project'|'session'|'runtime'} layer
   * @param {Record<string, any>} values
   */
  set(layer, values) {
    if (!LAYER_ORDER.includes(layer)) throw new Error(`Unknown config layer "${layer}"`);
    Object.assign(this.layers[layer], values);
  }

  /**
   * Resolve a key from the highest-priority layer that defines it.
   * @param {string} key
   * @param {any} [fallback]
   */
  get(key, fallback) {
    for (let i = LAYER_ORDER.length - 1; i >= 0; i -= 1) {
      const layer = this.layers[LAYER_ORDER[i]];
      if (Object.prototype.hasOwnProperty.call(layer, key)) return layer[key];
    }
    return fallback;
  }

  /** Returns the fully resolved config as a flat object (for debugging/observability). */
  resolveAll() {
    return LAYER_ORDER.reduce((acc, layer) => ({ ...acc, ...this.layers[layer] }), {});
  }

  clearLayer(layer) {
    if (!LAYER_ORDER.includes(layer)) throw new Error(`Unknown config layer "${layer}"`);
    this.layers[layer] = {};
  }
}

export const CONFIG_LAYER_ORDER = LAYER_ORDER;
