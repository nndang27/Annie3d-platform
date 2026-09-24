import {
  type BillingInterval,
  findPlan,
  newOperationId,
  PLANS,
  type PlanId,
  USAGE_UNIT,
  yearlyMonthlyEquivalent,
} from '@annie3d/contracts';
import { Badge, Button, Dialog, formatRelative, Segmented, useToast } from '@annie3d/ui';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { useServices } from '@/services/context';
import { keys, useInvalidate, useMe, useSubscription, useWorkspaceId } from '@/services/queries';

export function Billing() {
  const services = useServices();
  const ws = useWorkspaceId();
  const me = useMe();
  const inv = useInvalidate();
  const toast = useToast();
  const navigate = useNavigate({ from: '/settings/billing' });
  const search = useSearch({ from: '/authed/settings/billing' });
  const sub = useSubscription();
  const usage = useQuery({ queryKey: keys.usage(ws), queryFn: () => services.billing.usage() });
  const invoices = useQuery({ queryKey: keys.invoices(ws), queryFn: () => services.billing.invoices() });
  const [interval, setInterval] = useState<BillingInterval>(
    (search.interval as BillingInterval) ?? sub.data?.interval ?? 'monthly',
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const isOwner = me.data?.role === 'owner';
  const plan = findPlan(sub.data?.planId);
  const pct = sub.data
    ? Math.min(100, Math.round((100 * sub.data.creditsUsed) / sub.data.creditsIncluded))
    : 0;

  const choose = (planId: PlanId) => {
    void navigate({
      to: '/billing/checkout',
      search: { plan: planId, interval, returnTo: '/app/settings/billing' },
    });
  };
  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await services.billing.cancelSubscription();
      await inv.billing();
      toast.push({ message: 'Subscription cancelled (simulated). Access continues until the period ends.' });
      setCancelOpen(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const downgradeFree = async () => {
    setBusy(true);
    try {
      await services.billing.changePlan({
        planId: 'starter',
        interval: 'monthly',
        operationId: newOperationId(),
      });
      await inv.billing();
      toast.push({ message: 'Moved to Starter (simulated).' });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="h-billing" style={{ display: 'grid', gap: 18 }}>
      <h2 id="h-billing" className="settings-heading" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
        Usage & billing <Badge tone="warning">Illustrative prices · no charges</Badge>
      </h2>
      {search.plan ? (
        <p className="banner banner-info">
          Plan “{search.plan}” selected on the pricing page. Continue below to the simulated checkout.
        </p>
      ) : null}
      {sub.data && plan ? (
        <div className="card card-pad" style={{ display: 'grid', gap: 10 }} data-testid="subscription-card">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>{plan.name}</strong>
            <Badge
              tone={
                sub.data.status === 'active'
                  ? 'success'
                  : sub.data.status === 'pending'
                    ? 'warning'
                    : 'neutral'
              }
            >
              {sub.data.status}
            </Badge>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {sub.data.interval} · renews {formatRelative(sub.data.renewsAt)}
            </span>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span>Render credits this period</span>
              <span className="numeric" data-testid="credits-used">
                {sub.data.creditsUsed} / {sub.data.creditsIncluded}
              </span>
            </div>
            <div
              style={{
                height: 8,
                background: 'var(--bg-subtle)',
                borderRadius: 4,
                overflow: 'hidden',
                marginTop: 4,
              }}
              role="progressbar"
              aria-valuenow={sub.data.creditsUsed}
              aria-valuemin={0}
              aria-valuemax={sub.data.creditsIncluded}
              aria-label="Credits used"
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: pct > 90 ? 'var(--danger)' : 'var(--accent)',
                }}
              />
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 6 }}>
              {plan.limitsThatStopWork.join(' ')}{' '}
              {plan.limitsThatCharge.length ? plan.limitsThatCharge.join(' ') : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {sub.data.seatsUsed} of {plan.seats} seats used
            </span>
            {plan.id !== 'starter' && sub.data.status === 'active' ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setCancelOpen(true)}
                disabledReason={isOwner ? undefined : 'Only owners manage billing.'}
                style={{ marginLeft: 'auto' }}
              >
                Cancel subscription
              </Button>
            ) : null}
            {plan.id !== 'starter' ? (
              <Button
                size="sm"
                variant="tertiary"
                onClick={() => void downgradeFree()}
                disabledReason={isOwner ? undefined : 'Only owners manage billing.'}
              >
                Downgrade to Starter
              </Button>
            ) : null}
          </div>
        </div>
      ) : sub.error ? (
        <ErrorState error={sub.error} onRetry={() => void sub.refetch()} />
      ) : (
        <div className="skeleton" style={{ height: 120 }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Change plan</h3>
        <Segmented
          label="Billing interval"
          value={interval}
          onChange={setInterval}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly' },
          ]}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {PLANS.map((p) => {
          const current =
            sub.data?.planId === p.id && sub.data.interval === interval && sub.data.status === 'active';
          const price = interval === 'monthly' ? p.monthlyUsd : yearlyMonthlyEquivalent(p);
          return (
            <div
              key={p.id}
              className="card card-pad"
              style={{ display: 'grid', gap: 8, borderColor: current ? 'var(--accent)' : undefined }}
              data-testid={`plan-${p.id}`}
            >
              <strong>{p.name}</strong>
              <div>
                <span style={{ fontSize: '1.5rem', fontWeight: 600 }} className="numeric">
                  ${price}
                </span>
                <span style={{ color: 'var(--text-muted)' }}> /mo</span>
                {interval === 'yearly' && p.yearlyUsd ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ${p.yearlyUsd} billed yearly
                  </div>
                ) : null}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {p.creditsPerMonth} credits · {p.seats} seat{p.seats > 1 ? 's' : ''}
              </div>
              {current ? (
                <Badge tone="accent">Current plan</Badge>
              ) : p.id === 'starter' ? (
                <Button
                  size="sm"
                  onClick={() => void downgradeFree()}
                  disabledReason={
                    !isOwner
                      ? 'Only owners manage billing.'
                      : sub.data?.planId === 'starter'
                        ? 'Already on Starter.'
                        : undefined
                  }
                >
                  Switch to Starter
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => choose(p.id)}
                  disabledReason={isOwner ? undefined : 'Only owners manage billing.'}
                  data-testid={`choose-${p.id}`}
                >
                  {sub.data &&
                  PLANS.findIndex((x) => x.id === sub.data.planId) < PLANS.findIndex((x) => x.id === p.id)
                    ? 'Upgrade'
                    : 'Change'}{' '}
                  to {p.name}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        One {USAGE_UNIT.name}: {USAGE_UNIT.explanation} Full comparison on the{' '}
        <a href={`${import.meta.env.VITE_SITE_ORIGIN ?? ''}/pricing`}>pricing page</a>.
      </p>

      <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Usage history</h3>
      {usage.data?.length ? (
        <div className="table-wrap">
          <table className="table" data-testid="usage-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Kind</th>
                <th scope="col">Reference</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Credits
                </th>
              </tr>
            </thead>
            <tbody>
              {usage.data.slice(0, 15).map((u) => (
                <tr key={u.id}>
                  <td>{formatRelative(u.at)}</td>
                  <td>{u.kind}</td>
                  <td className="mono">{u.refId}</td>
                  <td className="numeric" style={{ textAlign: 'right' }}>
                    {u.credits}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          No usage recorded yet in this session.
        </p>
      )}

      <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Invoices (sample)</h3>
      {invoices.data?.length ? (
        <ul
          style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4, fontSize: '0.875rem' }}
          data-testid="invoices"
        >
          {invoices.data.map((i) => (
            <li
              key={i.id}
              className="card"
              style={{ padding: '8px 12px', display: 'flex', gap: 10, flexWrap: 'wrap' }}
            >
              <span className="mono">{i.id}</span>
              <span>{i.description}</span>
              <span style={{ marginLeft: 'auto' }} className="numeric">
                ${i.amountUsd} · {i.status}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No invoices.</p>
      )}
      {error ? <ErrorState error={error} /> : null}
      <p style={{ fontSize: '0.8125rem' }}>
        <Link to="/">Back to projects</Link>
      </p>
      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel subscription?"
        description="Simulated: the workspace keeps its plan until the current period ends, then moves to Starter. No refund logic exists in the demo."
        locked={busy}
        actions={
          <>
            <Button onClick={() => setCancelOpen(false)}>Keep plan</Button>
            <Button variant="destructive-solid" loading={busy} onClick={() => void cancel()}>
              Cancel subscription
            </Button>
          </>
        }
      >
        {error ? <ErrorState error={error} compact /> : null}
      </Dialog>
    </section>
  );
}
