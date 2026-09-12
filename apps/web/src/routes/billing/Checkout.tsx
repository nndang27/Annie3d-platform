import {
  type BillingInterval,
  type CheckoutSession,
  findPlan,
  newOperationId,
  type PlanId,
  safeReturnTo,
} from '@3dads/contracts';
import { Badge, Button } from '@3dads/ui';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { useServices } from '@/services/context';
import { useMe } from '@/services/queries';

/**
 * Simulated hosted checkout. No card fields. Outcome buttons stand in for the provider's result;
 * the return page reconciles against server-held checkout state, never the query string.
 */
export function Checkout() {
  const services = useServices();
  const search = useSearch({ from: '/authed/billing/checkout' });
  const navigate = useNavigate({ from: '/billing/checkout' });
  const me = useMe();
  const planId = (search.plan ?? 'studio') as PlanId;
  const interval = (search.interval === 'yearly' ? 'yearly' : 'monthly') as BillingInterval;
  const plan = findPlan(planId);
  const returnTo = safeReturnTo(search.returnTo, '/app/settings/billing');
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const opId = useRef(newOperationId());
  const creating = useRef(false);

  useEffect(() => {
    if (!plan || checkout || creating.current || !me.data) return;
    creating.current = true;
    services.billing
      .createCheckout({ planId: plan.id, interval, returnTo, operationId: opId.current })
      .then(setCheckout)
      .catch(setError)
      .finally(() => {
        creating.current = false;
      });
  }, [plan, interval, returnTo, services, checkout, me.data]);

  const outcome = async (o: 'success' | 'cancel' | 'decline' | 'delayed') => {
    if (!checkout || busy) return; // double clicks cannot create a second outcome
    setBusy(o);
    try {
      const c = await services.billing.simulateOutcome(checkout.id, o);
      void navigate({
        to: '/billing/return',
        search: { checkout: c.id, success: o === 'success' ? 'true' : undefined },
      });
    } catch (e) {
      setError(e);
      setBusy(null);
    }
  };

  if (!plan) {
    return (
      <div className="page" style={{ maxWidth: 560 }}>
        <ErrorState
          error={{ code: 'invalid_input', message: 'Unknown plan. Choose a plan from Usage & billing.' }}
        />
        <Link to="/settings/billing" className="btn btn-secondary" style={{ marginTop: 12 }}>
          Usage & billing
        </Link>
      </div>
    );
  }
  const amount = interval === 'monthly' ? plan.monthlyUsd : plan.yearlyUsd;
  return (
    <div className="page" style={{ maxWidth: 640 }} data-testid="checkout">
      <Badge tone="warning">Demo checkout · no card details · nothing is charged</Badge>
      <h1 className="page-title" style={{ marginTop: 12 }}>
        Confirm {plan.name} ({interval})
      </h1>
      <div className="card card-pad" style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{plan.name} plan</span>
          <span className="numeric">
            USD {amount} / {interval === 'monthly' ? 'month' : 'year'}
          </span>
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Includes {plan.creditsPerMonth} render credits per month and {plan.seats} seat
          {plan.seats > 1 ? 's' : ''}. Renews automatically each {interval === 'monthly' ? 'month' : 'year'}{' '}
          until cancelled. Illustrative pricing for the demonstration.
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Workspace: {me.data?.workspace.name ?? '…'} · After payment you return to{' '}
          <span className="mono">{returnTo}</span>
        </div>
        {checkout ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} className="mono">
            checkout {checkout.id} · status {checkout.status}
          </div>
        ) : error ? null : (
          <div className="skeleton" style={{ height: 16, width: 240 }} />
        )}
      </div>
      {error ? (
        <div style={{ marginTop: 12 }}>
          <ErrorState
            error={error}
            onRetry={() => {
              setError(null);
              setCheckout(null);
            }}
          />
        </div>
      ) : null}
      <p style={{ marginTop: 20, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        In the live product this page is the payment provider's hosted checkout. Choose how the simulated
        provider should respond:
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 8,
          marginTop: 10,
        }}
      >
        <Button
          variant="primary"
          loading={busy === 'success'}
          disabledReason={checkout ? undefined : 'Creating checkout session…'}
          onClick={() => void outcome('success')}
          data-testid="pay-success"
        >
          Simulate successful payment
        </Button>
        <Button
          loading={busy === 'delayed'}
          disabledReason={checkout ? undefined : 'Creating checkout session…'}
          onClick={() => void outcome('delayed')}
          data-testid="pay-delayed"
        >
          Simulate delayed confirmation
        </Button>
        <Button
          loading={busy === 'decline'}
          disabledReason={checkout ? undefined : 'Creating checkout session…'}
          onClick={() => void outcome('decline')}
          data-testid="pay-decline"
        >
          Simulate declined card
        </Button>
        <Button
          variant="tertiary"
          loading={busy === 'cancel'}
          disabledReason={checkout ? undefined : 'Creating checkout session…'}
          onClick={() => void outcome('cancel')}
          data-testid="pay-cancel"
        >
          Cancel and go back
        </Button>
      </div>
    </div>
  );
}
