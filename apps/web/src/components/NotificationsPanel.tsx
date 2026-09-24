import { Button, formatRelative } from '@annie3d/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useServices } from '@/services/context';
import { keys, useWorkspaceId } from '@/services/queries';

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const services = useServices();
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);
  const q = useQuery({ queryKey: keys.notifications(ws), queryFn: () => services.workspace.notifications() });
  useEffect(
    () =>
      services.workspace.subscribeNotifications(() =>
        qc.invalidateQueries({ queryKey: keys.notifications(ws) }),
      ),
    [services, qc, ws],
  );
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (
        !ref.current?.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest('[data-testid="notifications-toggle"]')
      )
        onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  const items = q.data ?? [];
  return (
    <div
      ref={ref}
      className="menu"
      role="dialog"
      aria-label="Notifications"
      style={{
        position: 'absolute',
        right: 0,
        top: 'calc(100% + 4px)',
        width: 340,
        zIndex: 50,
        maxHeight: 420,
        overflow: 'auto',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px' }}
      >
        <strong style={{ fontSize: '0.9rem' }}>Notifications</strong>
        <span className="badge">In-app only · emails are logged, not sent</span>
      </div>
      {items.length === 0 ? (
        <p style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Nothing yet. Run a workflow to see completion notices here.
        </p>
      ) : (
        items.slice(0, 20).map((n) => (
          <div
            key={n.id}
            style={{ padding: '8px', borderTop: '1px solid var(--border-subtle)', display: 'grid', gap: 2 }}
          >
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                fontSize: '0.875rem',
                fontWeight: n.read ? 400 : 600,
              }}
            >
              {n.channel === 'email' ? <Mail size={13} aria-hidden="true" /> : null}
              {n.title}
              <span
                style={{
                  marginLeft: 'auto',
                  color: 'var(--text-muted)',
                  fontWeight: 400,
                  fontSize: '0.75rem',
                }}
              >
                {formatRelative(n.at)}
              </span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{n.body}</div>
            {!n.read ? (
              <div>
                <Button size="sm" variant="tertiary" onClick={() => void services.workspace.markRead(n.id)}>
                  Mark read
                </Button>
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
