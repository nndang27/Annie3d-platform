import { Copy, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import {
  type Budget,
  FEATURE_BUDGETS,
  getSamples,
  getVitals,
  PAGE_BUDGETS,
  perfVersion,
  rate,
  resourceSummary,
  stats,
  subscribePerf,
} from '../lib/perf';
import { toast, useUi } from '../store/ui';

const fmt = (b: Budget | undefined, v: number) =>
  b?.unit === 'ms' ? (v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`) : String(v);
const budgetText = (b: Budget) => `≤ ${fmt(b, b.good)}`;

/**
 * Performance panel: this browser's page-load vitals, network summary and per-feature timings
 * against their budgets (docs/PERFORMANCE_STANDARDS.md). Opened from the top bar, ⌥P or `?perf`.
 */
export default function PerfPanel() {
  useSyncExternalStore(subscribePerf, perfVersion);
  const vitals = getVitals();
  const net = resourceSummary();
  const apis = new Map<string, number[]>();
  for (const s of getSamples())
    if (s.name === 'api' && s.detail) apis.set(s.detail, [...(apis.get(s.detail) ?? []), s.ms]);
  const slowApis = [...apis]
    .map(([k, xs]) => ({ k, n: xs.length, max: Math.max(...xs), last: xs.at(-1)! }))
    .sort((a, b) => b.max - a.max)
    .slice(0, 5);
  const close = () => useUi.setState({ perfOpen: false });
  const copy = () => {
    const report = {
      url: location.href,
      at: new Date().toISOString(),
      vitals: Object.fromEntries(vitals),
      network: net,
      features: Object.fromEntries(
        Object.keys(FEATURE_BUDGETS)
          .map((k) => [k, stats(k)])
          .filter(([, v]) => v),
      ),
      api: slowApis,
    };
    void navigator.clipboard
      .writeText(JSON.stringify(report, null, 2))
      .then(() => toast('Performance report copied'));
  };
  return (
    <aside className="perf-panel" aria-label="Performance" data-testid="perf-panel">
      <header>
        <b>Performance</b>
        <span className="grow" />
        <button type="button" onClick={copy} aria-label="Copy report" title="Copy report (JSON)">
          <Copy size={14} />
        </button>
        <button type="button" onClick={close} aria-label="Close performance panel">
          <X size={15} />
        </button>
      </header>
      <h3>Page load</h3>
      <table>
        <tbody>
          {Object.entries(PAGE_BUDGETS).map(([k, b]) => {
            const v = vitals.get(k);
            return (
              <tr key={k} data-testid={`perf-${k}`}>
                <td>
                  <i className={`dot ${v === undefined ? 'none' : rate(b, v)}`} />
                  {b.label}
                </td>
                <td className="num">{v === undefined ? '—' : fmt(b, v)}</td>
                <td className="budget">{budgetText(b)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="net">
        {net.count} requests, {net.kb} KB transferred
      </p>
      <h3>Features</h3>
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th className="num">last</th>
            <th className="num">p95</th>
            <th className="num">n</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(FEATURE_BUDGETS).map(([k, b]) => {
            const st = stats(k);
            return (
              <tr
                key={k}
                className={st ? '' : 'idle'}
                data-testid={`perf-feature-${k}`}
                title={budgetText(b)}
              >
                <td>
                  <i className={`dot ${st ? rate(b, st.p95) : 'none'}`} />
                  {b.label}
                </td>
                <td className="num">{st ? fmt(b, st.last) : '—'}</td>
                <td className="num">{st ? fmt(b, st.p95) : '—'}</td>
                <td className="num">{st?.count ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {slowApis.length > 0 && (
        <>
          <h3>Slowest API calls</h3>
          <table>
            <tbody>
              {slowApis.map((a) => (
                <tr key={a.k}>
                  <td className="mono">
                    <i className={`dot ${rate(FEATURE_BUDGETS.api, a.max)}`} />
                    {a.k}
                  </td>
                  <td className="num">{fmt(FEATURE_BUDGETS.api, a.max)}</td>
                  <td className="num">×{a.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h3>Slowest files</h3>
      <table>
        <tbody>
          {net.slow.map((r) => (
            <tr key={r.name}>
              <td className="mono">{r.name.slice(0, 44)}</td>
              <td className="num">{r.ms} ms</td>
              <td className="num" title="Worker time (Server-Timing)">
                {r.server ? `srv ${r.server}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="foot">
        Measured in this browser. Budgets: Core Web Vitals (web.dev), RAIL, Nielsen response limits. The same
        numbers are sent to the server when you leave the tab.
      </p>
    </aside>
  );
}
