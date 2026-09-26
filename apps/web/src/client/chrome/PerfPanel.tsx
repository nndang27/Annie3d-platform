import type { MessageKey } from '@annie3d/i18n';
import { Copy, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { t, useT } from '../i18n';
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
  b?.unit === 'ms'
    ? v >= 1000
      ? t('perf.seconds', {
          value: t.number(v / 1000, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        })
      : t('perf.ms', { value: Math.round(v) })
    : t.number(v);
const budgetText = (b: Budget) => t('perf.budget', { value: fmt(b, b.good) });

/** Display names of the budgets in lib/perf (their `label` is the English fallback). */
const METRIC: Record<string, MessageKey> = {
  TTFB: 'perf.metric.ttfb',
  FCP: 'perf.metric.fcp',
  LCP: 'perf.metric.lcp',
  CLS: 'perf.metric.cls',
  INP: 'perf.metric.inp',
  'board.ready': 'perf.metric.boardReady',
  'board.load': 'perf.metric.boardLoad',
  'clipboard.paste': 'perf.metric.clipboardPaste',
  'image.add': 'perf.metric.imageAdd',
  'upload.file': 'perf.metric.uploadFile',
  'editor.open': 'perf.metric.editorOpen',
  'simulator.open': 'perf.metric.simulatorOpen',
  'run.start': 'perf.metric.runStart',
  'run.total': 'perf.metric.runTotal',
  'agent.first': 'perf.metric.agentFirst',
  'agent.reply': 'perf.metric.agentReply',
  'export.bundle': 'perf.metric.exportBundle',
  'undo.apply': 'perf.metric.undoApply',
  'file.export': 'perf.metric.fileExport',
  'file.import': 'perf.metric.fileImport',
  api: 'perf.metric.api',
};
const metricName = (k: string, b: Budget) => (METRIC[k] ? t(METRIC[k]) : b.label);

/**
 * Performance panel: this browser's page-load vitals, network summary and per-feature timings
 * against their budgets (docs/PERFORMANCE_STANDARDS.md). Opened from the top bar, ⌥P or `?perf`.
 */
export default function PerfPanel() {
  // Subscribed so a change of language re-renders the panel (the helpers read `t` at call time).
  const tr = useT();
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
    void navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(() => toast(tr('perf.copied')));
  };
  return (
    <aside className="perf-panel" aria-label={tr('perf.title')} data-testid="perf-panel">
      <header>
        <b>{tr('perf.title')}</b>
        <span className="grow" />
        <button type="button" onClick={copy} aria-label={tr('perf.copy')} title={tr('perf.copyHint')}>
          <Copy size={14} />
        </button>
        <button type="button" onClick={close} aria-label={tr('perf.close')}>
          <X size={15} />
        </button>
      </header>
      <h3>{tr('perf.pageLoad')}</h3>
      <table>
        <tbody>
          {Object.entries(PAGE_BUDGETS).map(([k, b]) => {
            const v = vitals.get(k);
            return (
              <tr key={k} data-testid={`perf-${k}`}>
                <td>
                  <i className={`dot ${v === undefined ? 'none' : rate(b, v)}`} />
                  {metricName(k, b)}
                </td>
                <td className="num">{v === undefined ? '—' : fmt(b, v)}</td>
                <td className="budget">{budgetText(b)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="net">{tr('perf.network', { count: net.count, kb: net.kb })}</p>
      <h3>{tr('perf.features')}</h3>
      <table>
        <thead>
          <tr>
            <th>{tr('perf.action')}</th>
            <th className="num">{tr('perf.last')}</th>
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
                  {metricName(k, b)}
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
          <h3>{tr('perf.slowApis')}</h3>
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
      <h3>{tr('perf.slowFiles')}</h3>
      <table>
        <tbody>
          {net.slow.map((r) => (
            <tr key={r.name}>
              <td className="mono">{r.name.slice(0, 44)}</td>
              <td className="num">{tr('perf.ms', { value: r.ms })}</td>
              <td className="num" title={tr('perf.serverTime')}>
                {r.server ? tr('perf.server', { time: r.server }) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="foot">{tr('perf.foot')}</p>
    </aside>
  );
}
