import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '@annie3d/contracts';
import { Badge, Button, formatRelative, Switch, useToast } from '@annie3d/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useServices } from '@/services/context';
import { keys, useWorkspaceId } from '@/services/queries';

const ROWS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: 'runCompleted', label: 'Run completed', description: 'When a workflow run finishes with outputs.' },
  { key: 'runFailed', label: 'Run failed', description: 'When a step fails and needs attention.' },
  {
    key: 'exportReady',
    label: 'Export ready',
    description: 'When a queued render is available to download.',
  },
  { key: 'memberJoined', label: 'Member joined', description: 'When an invitation is accepted.' },
  { key: 'weeklyDigest', label: 'Weekly digest', description: 'A summary of activity. Email only.' },
];

export function Notifications() {
  const services = useServices();
  const ws = useWorkspaceId();
  const toast = useToast();
  const prefsQ = useQuery({
    queryKey: keys.prefs(ws),
    queryFn: () => services.workspace.notificationPrefs(),
  });
  const log = useQuery({
    queryKey: keys.notifications(ws),
    queryFn: () => services.workspace.notifications(),
  });
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (prefsQ.data) setPrefs(prefsQ.data);
  }, [prefsQ.data]);
  const setPref = (key: keyof NotificationPrefs, channel: 'inApp' | 'email', v: boolean) =>
    setPrefs((p) => ({ ...p, [key]: { ...p[key], [channel]: v } }));
  const save = async () => {
    setBusy(true);
    try {
      await services.workspace.updateNotificationPrefs(prefs);
      await prefsQ.refetch();
      toast.push({ message: 'Notification preferences saved' });
    } finally {
      setBusy(false);
    }
  };
  const dirty = JSON.stringify(prefs) !== JSON.stringify(prefsQ.data ?? DEFAULT_NOTIFICATION_PREFS);
  const emails = (log.data ?? []).filter((n) => n.channel === 'email');
  return (
    <section aria-labelledby="h-notif" style={{ display: 'grid', gap: 16 }}>
      <h2 id="h-notif" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
        Notifications
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        In-app notices appear in the bell menu. Email is simulated: messages are logged below and never
        delivered.
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">In-app</th>
              <th scope="col">Email (simulated)</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.key}>
                <td>
                  <div style={{ fontWeight: 500 }}>{r.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{r.description}</div>
                </td>
                <td>
                  {'inApp' in prefs[r.key] ? (
                    <Switch
                      label=""
                      checked={(prefs[r.key] as { inApp: boolean }).inApp}
                      onChange={(v) => setPref(r.key, 'inApp', v)}
                    />
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>
                <td>
                  <Switch
                    label=""
                    checked={prefs[r.key].email}
                    onChange={(v) => setPref(r.key, 'email', v)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <Button
          variant="primary"
          loading={busy}
          onClick={() => void save()}
          disabledReason={dirty ? undefined : 'No changes to save.'}
          data-testid="save-notifications"
        >
          Save preferences
        </Button>
      </div>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
        Simulated email log <Badge>not delivered</Badge>
      </h3>
      {emails.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No simulated emails yet.</p>
      ) : (
        <ul
          style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4, fontSize: '0.875rem' }}
        >
          {emails.slice(0, 20).map((n) => (
            <li key={n.id} className="card" style={{ padding: '8px 12px' }}>
              <strong>{n.title}</strong> · {n.body}{' '}
              <span style={{ color: 'var(--text-muted)' }}>· {formatRelative(n.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
