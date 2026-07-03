/**
 * Observability System — every request should be traceable. See docs/architecture/AI_INFRASTRUCTURE.md.
 * In-memory by default; swap for a real sink (e.g. a log-ingestion endpoint) in production.
 *
 * `maxEvents` bounds the in-memory buffer (default 1000) — a long-running process (e.g.
 * apps/omniroute-server, which keeps one OmniRoute/ObservabilityLog instance alive for its entire
 * lifetime) would otherwise accumulate one entry per request forever, an unbounded memory leak.
 * Oldest events are dropped first (ring-buffer behavior), matching "record everything recent" over
 * "record everything ever" for an in-memory sink — swap in a real log sink for durable retention.
 */
const DEFAULT_MAX_EVENTS = 1000;

export class ObservabilityLog {
  /** @param {{maxEvents?: number}} [options] */
  constructor({ maxEvents = DEFAULT_MAX_EVENTS } = {}) {
    this.events = [];
    this.maxEvents = maxEvents;
  }

  /** @param {Record<string, any>} event */
  record(event) {
    this.events.push({ timestamp: Date.now(), ...event });
    if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
  }

  getEvents() {
    return [...this.events];
  }

  clear() {
    this.events = [];
  }
}
