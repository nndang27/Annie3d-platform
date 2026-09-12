import { newOperationId } from '@3dads/contracts';
import { Button, Field, Input } from '@3dads/ui';
import { Link, useSearch } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { en } from '@/i18n/en';
import { fieldError } from '@/lib/errors';
import { navigateToHref } from '@/router';
import { useServices } from '@/services/context';
import { useSessionStore } from '@/stores/sessionStore';
import { AuthLayout } from './AuthLayout';
import { destinationFor } from './SignIn';

export function SignUp() {
  const services = useServices();
  const search = useSearch({ from: '/signup' });
  const setSession = useSessionStore((s) => s.setSession);
  const [form, setForm] = useState({ name: '', email: '', workspaceName: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [opId] = useState(() => newOperationId());
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = await services.session.signUp({ ...form, operationId: opId });
      setSession(s);
      navigateToHref(destinationFor(search));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const generic =
    error && !fieldError(error, 'name') && !fieldError(error, 'email') && !fieldError(error, 'workspaceName');
  return (
    <AuthLayout title={en.auth.signUpTitle} intro={en.auth.signUpIntro}>
      {search.template ? (
        <p className="banner banner-info">Your selected template is kept; the new project form opens next.</p>
      ) : null}
      <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'grid', gap: 14 }} noValidate>
        <Field label="Your name" required error={fieldError(error, 'name')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="name"
              autoComplete="name"
              value={form.name}
              onChange={set('name')}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required
              data-autofocus
            />
          )}
        </Field>
        <Field
          label="Email"
          required
          error={fieldError(error, 'email')}
          help="Not sent anywhere in the demo."
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={form.email}
              onChange={set('email')}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required
            />
          )}
        </Field>
        <Field
          label="Workspace name"
          required
          error={fieldError(error, 'workspaceName')}
          help="Usually your brand or team."
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="organization"
              autoComplete="organization"
              value={form.workspaceName}
              onChange={set('workspaceName')}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required
            />
          )}
        </Field>
        {generic ? <ErrorState error={error} compact /> : null}
        <Button type="submit" variant="primary" loading={busy} style={{ width: '100%' }}>
          {en.auth.createAccount}
        </Button>
      </form>
      <p style={{ fontSize: '0.875rem' }}>
        {en.auth.haveAccount}{' '}
        <Link to="/signin" search={search}>
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
