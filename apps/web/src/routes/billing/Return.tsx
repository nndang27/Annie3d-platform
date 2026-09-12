import { type CheckoutSession, findPlan, type Subscription, safeReturnTo } from '@3dads/contracts';
import { Badge, Button } from '@3dads/ui';
import { Link, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { navigateToHref } from '@/router';
import { useServices } from '@/services/context';
import { useInvalidate } from '@/services/queries';

/** Return page: reconciles with server-held checkout state. `success=true` in the URL proves nothing. */
export function CheckoutReturn() {
  const services = useServices();
  const search = useSearch({ from: '/authed/billing/return' });
  const inv = useInvalidate();
  const [state, setState] = useState<{ checkout: CheckoutSession; subscription: Subscription } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const attempts = useRef(0);

  useEffect(() => {
    if (!search.checkout) return;
    let cancelled = false;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const r = await services.billing.reconcile(search.checkout!);
        if (cancelled) return;
        setState(r);
        void inv.billing();
        attempts.current += 1;
        if (r.checkout.status === 'pending_confirmation' && attempts.current < 20)
          timer = window.setTimeout(() => void tick(), 1500);
      } catch (e) {
        if (!cancelled) setError(e);
      }
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [search.checkout, services, inv]);

  if (!search.checkout) {
    return (
      <div className="page" style={{ maxWidth: 560 }}>
        <ErrorState
          error={{
            code: 'invalid_input',
            message:
              'No checkout session in this link. If you completed a payment, open Usage & billing to see the confirmed plan.',
          }}
        />
        <Link to="/settings/billing" className="btn btn-secondary" style={{ marginTop: 12 }}>
          Usage & billing
        </Link>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page" style={{ maxWidth: 560 }}>
        <ErrorState
          error={error}
          onRetry={() => {
            setError(null);
            attempts.current = 0;
          }}
        />
      </div>
    );
  }
  if (!state) {
    return (
      <div className="page" style={{ maxWidth: 560 }} aria-busy="true">
        <p className="badge">Checking payment status…</p>
        <div className="skeleton" style={{ height: 80, marginTop: 12 }} />
      </div>
    );
  }
  const { checkout, subscription } = state;
  const plan = findPlan(checkout.planId)!;
  const returnTo = safeReturnTo(checkout.returnTo, '/app/settings/billing');
  const granted = checkout.status === 'succeeded' && subscription.planId === checkout.planId;
  const claimedSuccess = search.success === 'true' && checkout.status !== 'succeeded';
  return (
    <div
      className="page"
      style={{ maxWidth: 640 }}
      data-testid="checkout-return"
      data-status={checkout.status}
    >
      <Badge
        tone={
          granted
            ? 'success'
            : checkout.status === 'pending_confirmation'
              ? 'warning'
              : checkout.status === 'failed'
                ? 'danger'
                : 'neutral'
        }
      >
        {checkout.status.replace('_', ' ')}
      </Badge>
      <h1 className="page-title" style={{ marginTop: 12 }}>
        {granted
          ? `${plan.name} is active`
          : checkout.status === 'pending_confirmation'
            ? 'Payment confirmation pending'
            : checkout.status === 'failed'
              ? 'Payment declined'
              : checkout.status === 'cancelled'
                ? 'Checkout cancelled'
                : 'Checkout not completed'}
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
        {granted
          ? `Your workspace now has ${subscription.creditsIncluded} credits per month on ${plan.name} (${subscription.interval}). Entitlement was confirmed from the checkout record, not from the URL.`
          : checkout.status === 'pending_confirmation'
            ? 'The simulated provider accepted the payment but has not confirmed it yet. Your work is untouched; this page rechecks every 1.5 s and you will not be asked to pay again.'
            : checkout.status === 'failed'
              ? `${checkout.failureReason ?? 'The payment did not go through.'} Your current plan (${findPlan(subscription.planId)?.name}) is unchanged.`
              : `No purchase was made. Your current plan (${findPlan(subscription.planId)?.name}) is unchanged and your work is where you left it.`}
      </p>
      {claimedSuccess ? (
        <p className="banner banner-warning" style={{ marginTop: 12 }}>
          The link claimed success, but the checkout record says otherwise. No entitlement was granted.
        </p>
      ) : null}
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 8 }} className="mono">
        {checkout.id} · callbacks received: {checkout.callbacks}
        {checkout.fulfilledAt ? ' · fulfilled once' : ''}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        {granted || checkout.status === 'cancelled' || checkout.status === 'failed' ? (
          <Button variant="primary" onClick={() => navigateToHref(returnTo)} data-testid="return-continue">
            Continue to where you were
          </Button>
        ) : null}
        {checkout.status === 'failed' || checkout.status === 'cancelled' ? (
          <Link
            to="/billing/checkout"
            search={{ plan: checkout.planId, interval: checkout.interval, returnTo }}
            className="btn btn-secondary"
          >
            Try checkout again
          </Link>
        ) : null}
        <Link to="/settings/billing" className="btn btn-tertiary">
          Usage & billing
        </Link>
      </div>
    </div>
  );
}
