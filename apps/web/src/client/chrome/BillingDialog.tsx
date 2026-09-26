import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { useMe } from '../api/me';
import { toast, useUi } from '../store/ui';
import { Modal } from './Modal';

const REASON: Record<string, string> = {
  grant_free: 'Free credits',
  purchase: 'Plan purchase',
  subscription: 'Monthly credits',
  run_reserve: 'Run started (held)',
  run_settle: 'Run charged',
  run_refund: 'Refund',
  adjust: 'Adjustment',
};

/** F11: balance, plans and history. Checkout goes through the (simulated) hosted provider page. */
export function BillingDialog() {
  const dialog = useUi((s) => s.dialog);
  const open = dialog?.type === 'billing';
  const close = () => useUi.getState().dialog?.type === 'billing' && useUi.setState({ dialog: null });
  return (
    <Modal open={open} onClose={close} labelledBy="billing-title" testId="billing-dialog" wide>
      {open && <BillingBody onClose={close} />}
    </Modal>
  );
}

function BillingBody({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const plans = useQuery({ queryKey: ['plans'], queryFn: api.plans, staleTime: 300_000 });
  const history = useQuery({ queryKey: ['credits'], queryFn: api.credits });
  const [busy, setBusy] = useState<string | null>(null);
  if (!me.data) {
    return (
      <>
        <h2 id="billing-title">Credits</h2>
        <p>Sign in to get 60 free credits: enough for one full run.</p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => useUi.setState({ dialog: null, signInPrompt: { reason: 'save' } })}
          >
            Sign in
          </button>
        </div>
      </>
    );
  }
  const { credits, workspace } = me.data;
  const buy = async (planId: 'creator' | 'studio') => {
    setBusy(planId);
    try {
      const r = await api.checkout({ planId, returnUrl: location.href });
      location.assign(r.checkoutUrl);
    } catch (e) {
      toast((e as Error).message, 'error');
      setBusy(null);
    }
  };
  return (
    <>
      <h2 id="billing-title">Credits</h2>
      <div className="balance" data-testid="billing-balance">
        <b>{credits.balance}</b> credits
        {credits.reserved > 0 && <span className="muted"> ({credits.reserved} held by a running job)</span>}
        <span className="plan-badge">
          {workspace.plan === 'free' ? 'Free' : workspace.plan === 'creator' ? 'Creator' : 'Studio'}
        </span>
      </div>
      <p className="muted small">
        {credits.freeRunAvailable
          ? 'Your first run is free (60 credits included).'
          : 'Runs are charged only for steps that succeed; cached steps are free.'}
      </p>
      <div className="plans">
        {(plans.data?.plans ?? []).map((p) => (
          <div
            key={p.id}
            className={`plan${workspace.plan === p.id ? ' current' : ''}`}
            data-testid={`plan-${p.id}`}
          >
            <b>{p.name}</b>
            <span className="price">
              ${p.priceMonthlyUsd}
              <span className="muted small">/month</span>
            </span>
            <span className="muted small">{p.creditsPerMonth.toLocaleString('en')} credits every month</span>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => void buy(p.id)}
              disabled={!!busy}
              data-testid={`buy-${p.id}`}
            >
              {busy === p.id
                ? 'Opening checkout…'
                : workspace.plan === p.id
                  ? 'Add credits'
                  : `Choose ${p.name}`}
            </button>
          </div>
        ))}
      </div>
      <h3 className="small-heading">History</h3>
      <ul className="history" data-testid="billing-history">
        {(history.data?.entries ?? [])
          .filter((e) => e.amount !== 0)
          .slice(0, 12)
          .map((e) => (
            <li key={e.id}>
              <span>{REASON[e.reason] ?? e.reason}</span>
              <span className="muted small">{new Date(e.createdAt).toLocaleDateString()}</span>
              <b className={e.amount > 0 ? 'ok' : ''}>
                {e.amount > 0 ? '+' : ''}
                {e.amount}
              </b>
            </li>
          ))}
      </ul>
      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );
}
