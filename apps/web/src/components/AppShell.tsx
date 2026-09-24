import { isServiceError } from '@annie3d/contracts';
import { Badge, Banner, Button, cx, Menu } from '@annie3d/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  HelpCircle,
  Images,
  Plus,
  Settings,
  WifiOff,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { en } from '@/i18n/en';
import { useServices } from '@/services/context';
import { useMe } from '@/services/queries';
import { useSessionStore } from '@/stores/sessionStore';
import { useUiStore } from '@/stores/uiStore';
import { NotificationsPanel } from './NotificationsPanel';

const SITE = import.meta.env.VITE_SITE_ORIGIN ?? '';

export function AppShell({ children }: { children: ReactNode }) {
  const services = useServices();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const setSession = useSessionStore((s) => s.setSession);
  const navCollapsed = useUiStore((s) => s.navCollapsed);
  const toggleNav = useUiStore((s) => s.toggleNav);
  const [conn, setConn] = useState(services.connectivity.state());
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => services.connectivity.subscribe(setConn), [services]);

  // Expired session anywhere → sign-in with returnTo, keeping drafts in stores.
  useEffect(() => {
    // A parallel query may already have cleared the expired session, so the identity call reports plain
    // `unauthorized`; both mean the same thing here: go to sign-in and keep the destination.
    if (!useSessionStore.getState().session) return; // sign-out already navigated; do not remount the sign-in page
    if (
      me.error &&
      (isServiceError(me.error, 'session_expired') || isServiceError(me.error, 'unauthorized'))
    ) {
      setSession(null);
      qc.clear();
      const href = router.state.location.href;
      void router.navigate({
        to: '/signin',
        search: { returnTo: href.startsWith('/app') ? href : `/app${href}` },
      });
    }
  }, [me.error, router, setSession, qc]);

  const signOut = async () => {
    const token = useSessionStore.getState().session?.token;
    await services.session.signOut();
    // A sign-out that settles after a newer sign-in must not clear the new session.
    if (useSessionStore.getState().session?.token !== token) return;
    setSession(null);
    qc.clear(); // no cross-user cache leakage
    void router.navigate({ to: '/signin' });
  };

  const identity = me.data;
  return (
    <div className="app-shell">
      <header className="app-header">
        <Button
          variant="tertiary"
          icon
          size="sm"
          aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          onClick={toggleNav}
          className="hidden md:inline-flex"
        >
          {navCollapsed ? (
            <ChevronRight size={18} aria-hidden="true" />
          ) : (
            <ChevronLeft size={18} aria-hidden="true" />
          )}
        </Button>
        <Link to="/" className="logo" aria-label="Annie 3D projects">
          <span className="logo-mark" aria-hidden="true">
            A
          </span>
          <span>Annie 3D</span>
        </Link>
        <span className="demo-chip" title={en.demoExplainer} data-testid="demo-label">
          <span
            className="dot"
            style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--accent)' }}
            aria-hidden="true"
          />
          <span className="demo-chip-label">{en.demoLabel}</span>
        </span>
        {identity ? (
          <span className="hidden sm:inline" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {identity.workspace.name}
          </span>
        ) : null}
        <div style={{ flex: 1 }} />
        {conn !== 'online' ? (
          <Badge tone="warning">
            <WifiOff size={13} aria-hidden="true" />
            {conn === 'offline' ? 'Offline' : 'Reconnecting…'}
          </Badge>
        ) : null}
        <Link to="/projects/new" className="btn btn-primary btn-sm" data-testid="new-project">
          <Plus size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{en.nav.newProject}</span>
        </Link>
        <div style={{ position: 'relative' }}>
          <Button
            variant="tertiary"
            icon
            aria-label="Notifications"
            aria-expanded={notifOpen}
            onClick={() => setNotifOpen((o) => !o)}
            data-testid="notifications-toggle"
          >
            <Bell size={18} aria-hidden="true" />
          </Button>
          {notifOpen ? <NotificationsPanel onClose={() => setNotifOpen(false)} /> : null}
        </div>
        <Menu
          label="Account"
          trigger={(p) => (
            <button
              type="button"
              className="btn btn-tertiary btn-icon"
              aria-label={identity ? `Account menu for ${identity.user.name}` : 'Account menu'}
              data-testid="account-menu"
              {...p}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: 'var(--bg-subtle)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {identity?.user.initials ?? '…'}
              </span>
            </button>
          )}
          items={[
            {
              label: identity ? `${identity.user.name} · ${identity.role}` : 'Loading…',
              onSelect: () => router.navigate({ to: '/settings/profile' }),
            },
            {
              label: 'Settings',
              onSelect: () => router.navigate({ to: '/settings/profile' }),
              icon: <Settings size={16} aria-hidden="true" />,
            },
            {
              label: 'Help & quickstart',
              onSelect: () => window.location.assign(`${SITE}/help`),
              icon: <HelpCircle size={16} aria-hidden="true" />,
            },
            {
              label: 'Demo scenarios (developer)',
              onSelect: () => router.navigate({ to: '/dev/scenarios' }),
            },
            'sep',
            { label: en.nav.signOut, onSelect: () => void signOut() },
          ]}
        />
      </header>
      <div className={cx('app-body', navCollapsed && 'nav-collapsed')}>
        <nav className="app-nav" aria-label="Primary">
          <NavLink
            to="/"
            icon={<FolderKanban size={18} aria-hidden="true" />}
            label={en.nav.dashboard}
            collapsed={navCollapsed}
            exact
          />
          <NavLink
            to="/library"
            icon={<Images size={18} aria-hidden="true" />}
            label={en.nav.library}
            collapsed={navCollapsed}
          />
          <NavLink
            to="/settings/profile"
            icon={<Settings size={18} aria-hidden="true" />}
            label={en.nav.settings}
            collapsed={navCollapsed}
            match="/settings"
          />
          <div style={{ flex: 1 }} />
          <a className="nav-link" href={`${SITE}/help`}>
            <HelpCircle size={18} aria-hidden="true" />
            {!navCollapsed ? (
              <span>{en.nav.help}</span>
            ) : (
              <span className="visually-hidden">{en.nav.help}</span>
            )}
          </a>
        </nav>
        <main id="main" className="app-main">
          {conn === 'offline' ? (
            <div style={{ padding: '12px 20px 0' }}>
              <Banner
                tone="warning"
                title="You are offline"
                icon={<WifiOff size={18} aria-hidden="true" />}
                action={
                  <Button size="sm" onClick={() => void services.connectivity.reconnect()}>
                    Reconnect
                  </Button>
                }
              >
                Your edits stay in this browser. Runs already accepted keep going on the server; their status
                will refresh when you are back online.
              </Banner>
            </div>
          ) : null}
          {children}
        </main>
      </div>
      <nav className="mobile-tabs" aria-label="Primary (mobile)">
        <Link to="/" activeOptions={{ exact: true }} activeProps={{ 'aria-current': 'page' }}>
          <FolderKanban size={18} aria-hidden="true" />
          {en.nav.dashboard}
        </Link>
        <Link to="/library" activeProps={{ 'aria-current': 'page' }}>
          <Images size={18} aria-hidden="true" />
          {en.nav.library}
        </Link>
        <Link to="/settings/profile" activeProps={{ 'aria-current': 'page' }}>
          <Settings size={18} aria-hidden="true" />
          {en.nav.settings}
        </Link>
      </nav>
    </div>
  );
}

function NavLink({
  to,
  icon,
  label,
  collapsed,
  exact,
  match,
}: {
  to: '/' | '/library' | '/settings/profile';
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  exact?: boolean;
  match?: string;
}) {
  const router = useRouter();
  const path = router.state.location.pathname;
  const active = match
    ? path.startsWith(match)
    : exact
      ? path === to || path === `${to}/` || path === ''
      : path.startsWith(to);
  return (
    <Link
      to={to}
      className={cx('nav-link', active && 'is-active')}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
    >
      {icon}
      {collapsed ? <span className="visually-hidden">{label}</span> : <span>{label}</span>}
    </Link>
  );
}
