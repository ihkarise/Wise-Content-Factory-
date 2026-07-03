/**
 * Observability System — every request should be traceable. See docs/architecture/AI_INFRASTRUCTURE.md.
 * In-memory by default; swap for a real sink (e.g. a log-ingestion endpoint) in production.
 */
export class ObservabilityLog {
  constructor() {
    this.events = [];
  }

  /** @param {Record<string, any>} event */
  record(event) {
    this.events.push({ timestamp: Date.now(), ...event });
  }

  getEvents() {
    return [...this.events];
  }

  clear() {
    this.events = [];
  }
}
