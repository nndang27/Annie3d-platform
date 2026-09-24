import { type ConnectivityState, ServiceError } from '@annie3d/contracts';
import { isScenarioId, LATENCY, type LatencyProfile, type ScenarioId } from './scenarios';

export interface TransportConfig {
  scenario: ScenarioId;
  /** Multiplies every simulated delay; tests use 0.05. */
  latencyScale: number;
}

const STORAGE_KEY = 'annie3d.scenario';
const SCALE_KEY = 'annie3d.latencyScale';

/**
 * Simulated transport: adds representative latency and scenario failures around backend calls.
 * Domain logic never lives here. Latency here is "backend time" and is excluded from frontend
 * processing measurements.
 */
export class MockTransport {
  private config: TransportConfig;
  private flakyCounters = new Map<string, number>();
  private connectivity: ConnectivityState = 'online';
  private connListeners = new Set<(s: ConnectivityState) => void>();
  private configListeners = new Set<(c: TransportConfig) => void>();
  private inflight = new Set<() => void>();

  constructor(initial?: Partial<TransportConfig>) {
    this.config = { scenario: 'normal', latencyScale: 1, ...readPersisted(), ...initial };
    if (this.config.scenario === 'offline') this.connectivity = 'offline';
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', () => this.setConnectivity('offline'));
      window.addEventListener('online', () => {
        if (this.config.scenario !== 'offline') void this.reconnect();
      });
    }
  }

  get scenario(): ScenarioId {
    return this.config.scenario;
  }

  getConfig(): TransportConfig {
    return { ...this.config };
  }

  setScenario(id: ScenarioId): void {
    this.config.scenario = id;
    this.flakyCounters.clear();
    persist(this.config);
    if (id === 'offline') this.setConnectivity('offline');
    else if (this.connectivity !== 'online') void this.reconnect();
    for (const l of this.configListeners) l(this.getConfig());
  }

  setLatencyScale(scale: number): void {
    this.config.latencyScale = Math.max(0, scale);
    persist(this.config);
    for (const l of this.configListeners) l(this.getConfig());
  }

  onConfig(l: (c: TransportConfig) => void): () => void {
    this.configListeners.add(l);
    return () => this.configListeners.delete(l);
  }

  latency(): LatencyProfile {
    const base = this.config.scenario === 'slow' ? LATENCY.slow : LATENCY.normal;
    const s = this.config.latencyScale;
    return {
      callMinMs: base.callMinMs * s,
      callMaxMs: base.callMaxMs * s,
      stepMinMs: base.stepMinMs * s,
      stepMaxMs: base.stepMaxMs * s,
      queueMs: base.queueMs * s,
    };
  }

  state(): ConnectivityState {
    return this.connectivity;
  }

  onConnectivity(l: (s: ConnectivityState) => void): () => void {
    this.connListeners.add(l);
    return () => this.connListeners.delete(l);
  }

  private setConnectivity(s: ConnectivityState): void {
    if (this.connectivity === s) return;
    this.connectivity = s;
    for (const l of this.connListeners) l(s);
  }

  async reconnect(): Promise<void> {
    if (this.config.scenario === 'offline') {
      this.setConnectivity('offline');
      return;
    }
    this.setConnectivity('reconnecting');
    await sleep(Math.min(600, 300 * this.config.latencyScale + 50));
    this.setConnectivity('online');
  }

  /**
   * Wrap a backend call. `kind` distinguishes reads (auto-retryable) from mutations.
   */
  async call<T>(
    name: string,
    kind: 'read' | 'mutation',
    fn: () => T | Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const { scenario } = this.config;
    if (scenario === 'offline' || this.connectivity === 'offline') {
      throw new ServiceError(
        'network',
        'You appear to be offline. Changes are kept locally until the connection returns.',
      );
    }
    if (scenario === 'flaky') {
      const n = (this.flakyCounters.get(name) ?? 0) + 1;
      this.flakyCounters.set(name, n);
      if (n <= 2) {
        await this.delay(80, signal);
        throw new ServiceError('rate_limited', 'Too many requests. Retrying shortly.', {
          retryAfterMs: 400 * this.config.latencyScale + 20,
        });
      }
    }
    if (scenario === 'timeout' && kind === 'mutation') {
      await this.delay(8000, signal);
      throw new ServiceError(
        'timeout',
        'The request timed out. Retry to send the same command again; it will not be applied twice.',
      );
    }
    await this.delay(this.pickCallLatency(), signal);
    if (signal?.aborted) throw new ServiceError('network', 'Request cancelled.');
    return await fn();
  }

  private pickCallLatency(): number {
    const p = this.latency();
    return p.callMinMs + Math.random() * (p.callMaxMs - p.callMinMs);
  }

  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      let t: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        if (t) clearTimeout(t);
        this.inflight.delete(done);
        signal?.removeEventListener('abort', done);
        resolve();
      };
      t = setTimeout(done, ms);
      this.inflight.add(done);
      signal?.addEventListener('abort', done, { once: true });
    });
  }
}

function readPersisted(): Partial<TransportConfig> {
  if (typeof localStorage === 'undefined') return {};
  const out: Partial<TransportConfig> = {};
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (isScenarioId(s)) out.scenario = s;
    const sc = Number(localStorage.getItem(SCALE_KEY));
    if (Number.isFinite(sc) && sc >= 0 && localStorage.getItem(SCALE_KEY) !== null) out.latencyScale = sc;
  } catch {
    /* storage unavailable */
  }
  if (typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search).get('scenario');
    if (isScenarioId(q)) out.scenario = q;
  }
  return out;
}

function persist(c: TransportConfig): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, c.scenario);
    localStorage.setItem(SCALE_KEY, String(c.latencyScale));
  } catch {
    /* ignore */
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
