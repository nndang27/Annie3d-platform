import { Button, Field, Input, useToast } from '@3dads/ui';
import { type FormEvent, useEffect, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { fieldError } from '@/lib/errors';
import { useServices } from '@/services/context';
import { useInvalidate, useMe } from '@/services/queries';

export function Profile() {
  const services = useServices();
  const me = useMe();
  const inv = useInvalidate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (me.data) setName(me.data.user.name);
  }, [me.data]);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await services.workspace.updateProfile({ name });
      await inv.workspace();
      toast.push({ message: 'Profile saved' });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="h-profile" style={{ display: 'grid', gap: 16 }}>
      <h2 id="h-profile" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
        Profile
      </h2>
      <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'grid', gap: 14, maxWidth: 420 }} noValidate>
        <Field label="Name" error={fieldError(error, 'name')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoComplete="name"
              data-testid="profile-name"
            />
          )}
        </Field>
        <Field label="Email" help="Demo identity; cannot be changed here.">
          {({ id, describedBy }) => (
            <Input id={id} value={me.data?.user.email ?? ''} readOnly aria-describedby={describedBy} />
          )}
        </Field>
        <Field
          label="Language"
          help="English only in this release. Vietnamese and other locales can map onto the same copy keys."
        >
          {({ id, describedBy }) => (
            <select id={id} className="select" aria-describedby={describedBy} value="en" disabled>
              <option value="en">English</option>
            </select>
          )}
        </Field>
        {error && !fieldError(error, 'name') ? <ErrorState error={error} compact /> : null}
        <div>
          <Button type="submit" variant="primary" loading={busy}>
            Save profile
          </Button>
        </div>
      </form>
    </section>
  );
}
