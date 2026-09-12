import { Link } from '@tanstack/react-router';
import { useSessionStore } from '@/stores/sessionStore';

export function NotFound() {
  const session = useSessionStore((s) => s.session);
  return (
    <main id="main" className="page" style={{ maxWidth: 560, margin: '64px auto' }}>
      <p className="badge">404</p>
      <h1 className="page-title" style={{ marginTop: 12 }}>
        This page does not exist in the workspace
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
        The link may be outdated, or the project or artifact it pointed to was deleted. Nothing you were
        working on is lost.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        {session ? (
          <Link className="btn btn-primary" to="/">
            Go to projects
          </Link>
        ) : (
          <Link className="btn btn-primary" to="/signin">
            Sign in
          </Link>
        )}
        <a className="btn btn-secondary" href={`${import.meta.env.VITE_SITE_ORIGIN ?? ''}/help`}>
          Help & quickstart
        </a>
      </div>
    </main>
  );
}
