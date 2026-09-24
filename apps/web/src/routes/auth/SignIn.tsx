import { intentToSearch, type NavigationIntent, newOperationId, safeReturnTo } from '@annie3d/contracts';
import { Button, Field, Input } from '@annie3d/ui';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { en } from '@/i18n/en';
import { navigateToHref } from '@/router';
import { useServices } from '@/services/context';
import { useSessionStore } from '@/stores/sessionStore';
import { AuthLayout } from './AuthLayout';

/** Where to land after sign-in: explicit returnTo wins; template/plan intents map to their destinations. */
export function destinationFor(intent: NavigationIntent): string {
  if (intent.returnTo) return safeReturnTo(intent.returnTo);
  if (intent.plan)
    return `/app/billing/checkout${intentToSearch({ plan: intent.plan, interval: intent.interval ?? 'monthly' })}`;
  if (intent.template) return `/app/projects/new${intentToSearch({ template: intent.template })}`;
  if (intent.project) return `/app/projects/${intent.project}`;
  return '/app';
}

export function SignIn() {
  const services = useServices();
  const search = useSearch({ from: '/signin' });
  const setSession = useSessionStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [opId] = useState(() => newOperationId());
  const identities = useQuery({
    queryKey: ['identities'],
    queryFn: () => services.session.listFixtureIdentities(),
  });

  const signIn = async (value: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = await services.session.signIn({ email: value, operationId: opId });
      setSession(s);
      navigateToHref(destinationFor(search));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void signIn(email);
  };

  return (
    <AuthLayout title={en.auth.signInTitle} intro={en.auth.signInIntro}>
      {search.template ? (
        <p className="banner banner-info">
          You will continue to the “{search.template.replace(/-/g, ' ')}” template after signing in.
        </p>
      ) : null}
      {search.plan ? (
        <p className="banner banner-info">
          Your selected plan ({search.plan}, {search.interval ?? 'monthly'}) is kept for checkout.
        </p>
      ) : null}
      <div style={{ display: 'grid', gap: 8 }} aria-label="Fixture identities">
        {(identities.data ?? []).map((i) => (
          <button
            key={i.user.id}
            type="button"
            className="btn btn-secondary"
            style={{ justifyContent: 'space-between' }}
            onClick={() => void signIn(i.user.email)}
            disabled={busy}
            data-testid={`identity-${i.user.id}`}
          >
            <span>
              {i.user.name} <span style={{ color: 'var(--text-muted)' }}>· {i.workspace.name}</span>
            </span>
            <span className="badge">{i.role}</span>
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }} noValidate>
        <Field label="Or enter a demo email" help="Try mai@lumen.demo or alex@northwind.demo">
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="you@example.com"
            />
          )}
        </Field>
        {error ? <ErrorState error={error} compact /> : null}
        <Button type="submit" variant="primary" loading={busy} style={{ width: '100%' }}>
          {en.auth.continue}
        </Button>
      </form>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.875rem',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span>
          {en.auth.noAccount}{' '}
          <Link to="/signup" search={search}>
            Create a demo account
          </Link>
        </span>
        <Link to="/recover" search={search}>
          {en.auth.forgot}
        </Link>
      </div>
    </AuthLayout>
  );
}
