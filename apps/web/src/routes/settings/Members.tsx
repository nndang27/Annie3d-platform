import { newOperationId, type Role } from '@3dads/contracts';
import { Badge, Button, Dialog, Field, formatRelative, Input, Select, useToast } from '@3dads/ui';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { fieldError, presentError } from '@/lib/errors';
import { useServices } from '@/services/context';
import { keys, useInvalidate, useMe, useWorkspaceId } from '@/services/queries';

export function Members() {
  const services = useServices();
  const ws = useWorkspaceId();
  const me = useMe();
  const inv = useInvalidate();
  const toast = useToast();
  const search = useSearch({ from: '/authed/settings/members' });
  const members = useQuery({ queryKey: keys.members(ws), queryFn: () => services.workspace.members() });
  const invitations = useQuery({
    queryKey: keys.invitations(ws),
    queryFn: () => services.workspace.invitations(),
  });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [opId, setOpId] = useState(() => newOperationId());
  const [removeId, setRemoveId] = useState<string | null>(null);
  const isOwner = me.data?.role === 'owner';

  const act = async (id: string, fn: () => Promise<unknown>, done?: string) => {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      await fn();
      await inv.workspace();
      if (done) toast.push({ message: done });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    await act(
      'invite',
      async () => {
        await services.workspace.invite({ email, role, operationId: opId });
        setEmail('');
        setOpId(newOperationId());
      },
      'Invitation created (simulated; nothing was emailed)',
    );
  };

  return (
    <section aria-labelledby="h-members" style={{ display: 'grid', gap: 18 }}>
      <h2 id="h-members" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
        Members & roles
      </h2>
      {search.accept ? (
        <p className="banner banner-info">
          You opened a simulated invitation link. In the live product this would join the workspace after
          sign-in.
        </p>
      ) : null}
      <div className="table-wrap">
        <table className="table" data-testid="members-table">
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Role</th>
              <th scope="col">Joined</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.data?.map((m) => (
              <tr key={m.userId}>
                <td>
                  <div style={{ fontWeight: 500 }}>
                    {m.name} {m.userId === me.data?.user.id ? <Badge>you</Badge> : null}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{m.email}</div>
                </td>
                <td>
                  <Select
                    small
                    aria-label={`Role for ${m.name}`}
                    value={m.role}
                    disabled={!isOwner || m.role === 'owner'}
                    onChange={(e) =>
                      void act(
                        `role-${m.userId}`,
                        () => services.workspace.setRole(m.userId, e.target.value as Role),
                        'Role updated',
                      )
                    }
                    style={{ width: 120 }}
                    title={
                      !isOwner
                        ? 'Only owners change roles'
                        : m.role === 'owner'
                          ? 'The owner role is fixed in the demo'
                          : undefined
                    }
                  >
                    <option value="owner">Owner</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </Select>
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{formatRelative(m.joinedAt)}</td>
                <td style={{ textAlign: 'right' }}>
                  {m.role !== 'owner' ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setRemoveId(m.userId)}
                      disabledReason={isOwner ? undefined : 'Only owners remove members.'}
                    >
                      Remove
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        <strong>Roles:</strong> owners manage billing, members and deletion; editors create, edit, run and
        export; viewers can open projects and outputs but not change them.
      </div>

      <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Invite a teammate (simulated)</h3>
      <form
        onSubmit={(e) => void invite(e)}
        style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}
        noValidate
      >
        <Field label="Email" error={fieldError(error, 'email')} className="grow">
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="teammate@brand.example"
              style={{ width: 280 }}
              data-testid="invite-email"
            />
          )}
        </Field>
        <Field label="Role">
          {({ id }) => (
            <Select
              id={id}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              style={{ width: 130 }}
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </Select>
          )}
        </Field>
        <Button
          type="submit"
          variant="primary"
          loading={busy === 'invite'}
          disabledReason={isOwner ? undefined : 'Only owners can invite.'}
          data-testid="invite-send"
        >
          Create invitation
        </Button>
      </form>
      {error && !fieldError(error, 'email') ? <ErrorState error={error} compact /> : null}
      {invitations.data?.length ? (
        <ul
          style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}
          data-testid="invitations"
        >
          {invitations.data.map((i) => (
            <li
              key={i.id}
              className="card"
              style={{
                padding: '8px 12px',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                flexWrap: 'wrap',
                fontSize: '0.875rem',
              }}
            >
              <span>
                {i.email} · {i.role}
              </span>
              <Badge
                tone={i.status === 'pending' ? 'warning' : i.status === 'accepted' ? 'success' : 'neutral'}
              >
                {i.status}
              </Badge>
              {i.status === 'pending' ? (
                <>
                  <span className="mono" style={{ color: 'var(--text-muted)' }}>
                    link: {i.simulatedLink}
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <Button
                      size="sm"
                      onClick={() =>
                        void act(
                          `acc-${i.id}`,
                          () => services.workspace.acceptInvitationSimulated(i.id),
                          'Invitation accepted (simulated)',
                        )
                      }
                      data-testid="simulate-accept"
                    >
                      Simulate acceptance
                    </Button>
                    <Button
                      size="sm"
                      variant="tertiary"
                      onClick={() =>
                        void act(
                          `rev-${i.id}`,
                          () => services.workspace.revokeInvitation(i.id),
                          'Invitation revoked',
                        )
                      }
                    >
                      Revoke
                    </Button>
                  </span>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <Dialog
        open={!!removeId}
        onClose={() => setRemoveId(null)}
        title="Remove member?"
        description="They lose access to this workspace immediately. Their past runs and outputs stay."
        actions={
          <>
            <Button onClick={() => setRemoveId(null)}>Keep</Button>
            <Button
              variant="destructive-solid"
              loading={busy === 'remove'}
              onClick={() =>
                void act('remove', () => services.workspace.removeMember(removeId!), 'Member removed').then(
                  () => setRemoveId(null),
                )
              }
            >
              Remove member
            </Button>
          </>
        }
      >
        {error ? <p style={{ color: 'var(--danger)' }}>{presentError(error).message}</p> : null}
      </Dialog>
    </section>
  );
}
