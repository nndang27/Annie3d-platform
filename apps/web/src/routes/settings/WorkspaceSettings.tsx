import { ASPECT_RATIOS, type AspectRatio } from '@annie3d/contracts';
import { Button, Field, Input, Select, useToast } from '@annie3d/ui';
import { type FormEvent, useEffect, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { fieldError } from '@/lib/errors';
import { useServices } from '@/services/context';
import { useInvalidate, useMe } from '@/services/queries';

export function WorkspaceSettings() {
  const services = useServices();
  const me = useMe();
  const inv = useInvalidate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [aspect, setAspect] = useState<AspectRatio>('1:1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (me.data) {
      setName(me.data.workspace.name);
      setAspect(me.data.workspace.defaultAspect);
    }
  }, [me.data]);
  const isOwner = me.data?.role === 'owner';
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await services.workspace.update({ name, defaultAspect: aspect });
      await inv.workspace();
      toast.push({ message: 'Workspace saved' });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="h-ws" style={{ display: 'grid', gap: 16 }}>
      <h2 id="h-ws" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
        Workspace
      </h2>
      <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'grid', gap: 14, maxWidth: 420 }} noValidate>
        <Field label="Workspace name" error={fieldError(error, 'name')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              disabled={!isOwner}
              data-testid="workspace-name"
            />
          )}
        </Field>
        <Field label="Default aspect ratio for new projects">
          {({ id }) => (
            <Select
              id={id}
              value={aspect}
              onChange={(e) => setAspect(e.target.value as AspectRatio)}
              disabled={!isOwner}
            >
              {ASPECT_RATIOS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Workspace ID" help="Used in support requests.">
          {({ id }) => <Input id={id} readOnly value={me.data?.workspace.id ?? ''} className="mono" />}
        </Field>
        {error && !fieldError(error, 'name') ? <ErrorState error={error} compact /> : null}
        <div>
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabledReason={isOwner ? undefined : 'Only the workspace owner can change these settings.'}
          >
            Save workspace
          </Button>
        </div>
      </form>
    </section>
  );
}
