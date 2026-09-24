import { cx } from '@annie3d/ui';
import { Link, Outlet, useRouter } from '@tanstack/react-router';

const ITEMS = [
  { to: '/settings/profile', label: 'Profile' },
  { to: '/settings/workspace', label: 'Workspace' },
  { to: '/settings/notifications', label: 'Notifications' },
  { to: '/settings/members', label: 'Members & roles' },
  { to: '/settings/billing', label: 'Usage & billing' },
] as const;

export function SettingsLayout() {
  const path = useRouter().state.location.pathname;
  return (
    <div
      className="page settings-layout"
      style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 200px) minmax(0, 1fr)', gap: 24 }}
    >
      <nav aria-label="Settings sections" style={{ display: 'grid', gap: 4, alignContent: 'start' }}>
        <h1 className="page-title" style={{ fontSize: '1.25rem', marginBottom: 8 }}>
          Settings
        </h1>
        {ITEMS.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className={cx('nav-link', path.startsWith(i.to) && 'is-active')}
            aria-current={path.startsWith(i.to) ? 'page' : undefined}
          >
            {i.label}
          </Link>
        ))}
      </nav>
      <div style={{ minWidth: 0, maxWidth: 760 }}>
        <Outlet />
      </div>
    </div>
  );
}
