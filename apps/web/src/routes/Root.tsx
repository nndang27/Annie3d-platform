import { ToastProvider } from '@annie3d/ui';
import { Outlet } from '@tanstack/react-router';
import { Component, type ReactNode, useEffect } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { useServices } from '@/services/context';
import { useSessionStore } from '@/stores/sessionStore';

class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="page" style={{ maxWidth: 640 }}>
          <ErrorState error={this.state.error} onRetry={() => this.setState({ error: null })} />
        </div>
      );
    }
    return this.props.children;
  }
}

export function RootLayout() {
  const services = useServices();
  const setSession = useSessionStore((s) => s.setSession);
  // Keep the session store aligned with the adapter (e.g. sign-out in another tab is not simulated; expiry is).
  useEffect(() => {
    const t = window.setInterval(() => {
      void services.session
        .current()
        .then((s) => {
          const cur = useSessionStore.getState().session;
          if ((s?.token ?? null) !== (cur?.token ?? null)) setSession(s);
        })
        .catch(() => {});
    }, 30_000);
    return () => window.clearInterval(t);
  }, [services, setSession]);
  return (
    <ToastProvider>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Boundary>
        <Outlet />
      </Boundary>
    </ToastProvider>
  );
}
