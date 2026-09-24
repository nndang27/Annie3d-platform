import { Button, Field, Input } from '@annie3d/ui';
import { Link, useSearch } from '@tanstack/react-router';
import { type FormEvent, useEffect, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { en } from '@/i18n/en';
import { navigateToHref } from '@/router';
import { useServices } from '@/services/context';
import { useSessionStore } from '@/stores/sessionStore';
import { AuthLayout } from './AuthLayout';
import { destinationFor } from './SignIn';

export function Recover() {
  const services = useServices();
  const search = useSearch({ from: '/recover' });
  const setSession = useSessionStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const token = search.token;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setBusy(true);
    services.session
      .completeRecovery({ token })
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        navigateToHref(destinationFor(search));
      })
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [token, services, setSession, search]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await services.session.requestRecovery({ email });
      setLink(r.simulatedLink);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (token) {
    return (
      <AuthLayout title="Opening your recovery link" intro="Signing you in from the simulated link.">
        {error ? <ErrorState error={error} /> : <p style={{ color: 'var(--text-secondary)' }}>One moment…</p>}
        <Link to="/recover" search={{}}>
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={en.auth.recoverTitle} intro={en.auth.recoverIntro}>
      {link ? (
        <div className="banner banner-success" role="status" style={{ display: 'grid', gap: 8 }}>
          <div>
            <strong>Simulated recovery link created.</strong> Nothing was emailed. In the demo you open it
            here:
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigateToHref(link)}
            data-testid="open-recovery-link"
          >
            Open recovery link (simulated)
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'grid', gap: 12 }} noValidate>
          <Field
            label="Email"
            required
            help="A link is generated whether or not the account exists; only a real demo account's link signs you in."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby={describedBy}
                required
                data-autofocus
              />
            )}
          </Field>
          {error ? <ErrorState error={error} compact /> : null}
          <Button type="submit" variant="primary" loading={busy}>
            Send recovery link (simulated)
          </Button>
        </form>
      )}
      <p style={{ fontSize: '0.875rem' }}>
        <Link to="/signin" search={search}>
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
