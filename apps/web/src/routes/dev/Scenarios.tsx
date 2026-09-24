import { Badge, Button, Select, useToast } from '@annie3d/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useServices } from '@/services/context';
import { SCENARIOS, type ScenarioId } from '@/services/mock/scenarios';
import type { MockServices } from '@/services/mock/services';

/** Developer/test scenario selector. Linked from the account menu; unobtrusive in normal use. */
export function Scenarios() {
  const services = useServices() as MockServices;
  const qc = useQueryClient();
  const toast = useToast();
  const [config, setConfig] = useState(() => services.dev?.getConfig());
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => services.dev?.transport.onConfig(setConfig), [services]);
  if (services.mode !== 'demo' || !services.dev)
    return <div className="page">Scenario controls exist only in the demo adapter.</div>;
  const set = (id: ScenarioId) => {
    services.dev.setScenario(id);
    void qc.invalidateQueries();
    toast.push({ message: `Scenario: ${id}` });
  };
  return (
    <div className="page" style={{ maxWidth: 820 }} data-testid="scenarios">
      <h1 className="page-title">Demo scenarios</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
        Shapes the simulated transport and engine. Also available as <span className="mono">?scenario=</span>,
        localStorage <span className="mono">annie3d.scenario</span>, and{' '}
        <span className="mono">window.__annie3d</span> in tests. Documented in docs/MOCK_SCENARIOS.md.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '16px 0', flexWrap: 'wrap' }}>
        <Badge tone="accent">Active: {config?.scenario}</Badge>
        <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: '0.875rem' }}>
          Latency scale
          <Select
            small
            value={String(config?.latencyScale ?? 1)}
            onChange={(e) => services.dev.setLatencyScale(Number(e.target.value))}
            style={{ width: 100 }}
            aria-label="Latency scale"
          >
            {['0', '0.05', '0.25', '0.5', '1', '2'].map((v) => (
              <option key={v} value={v}>
                ×{v}
              </option>
            ))}
          </Select>
        </label>
        <Button
          size="sm"
          loading={busy === 'reset'}
          onClick={() => {
            setBusy('reset');
            void services.dev.reset().then(() => window.location.assign('/app/signin'));
          }}
        >
          Reset all demo data
        </Button>
        <Button
          size="sm"
          loading={busy === 'reseed'}
          onClick={() => {
            setBusy('reseed');
            void services.dev.reseed('stress').then(() => {
              qc.clear();
              setBusy(null);
              toast.push({ message: 'Reseeded with the stress dataset (400 projects)' });
            });
          }}
        >
          Reseed: stress
        </Button>
        <Button
          size="sm"
          onClick={() => {
            services.dev.expireSession();
            toast.push({ message: 'Session expired; the next call redirects to sign-in.' });
          }}
        >
          Expire session
        </Button>
      </div>
      <div style={{ display: 'grid', gap: 8 }} role="radiogroup" aria-label="Scenario">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={config?.scenario === s.id}
            onClick={() => set(s.id)}
            className="card"
            style={{
              textAlign: 'left',
              padding: '10px 14px',
              display: 'grid',
              gap: 2,
              borderColor: config?.scenario === s.id ? 'var(--accent)' : undefined,
              cursor: 'pointer',
            }}
            data-testid={`scenario-${s.id}`}
          >
            <strong style={{ fontSize: '0.9rem' }}>{s.title}</strong>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{s.description}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Expect: {s.expect}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
