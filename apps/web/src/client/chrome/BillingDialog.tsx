import { FREE_RUN_CREDITS } from '@annie3d/contracts';
import type { MessageKey } from '@annie3d/i18n';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { useMe } from '../api/me';
import { rich, useT } from '../i18n';
import { toast, useUi } from '../store/ui';
import { Modal } from './Modal';

const REASON: Record<string, MessageKey> = {
  grant_free: 'dialog.billing.reason.grantFree',
  purchase: 'dialog.billing.reason.purchase',
  subscription: 'dialog.billing.reason.subscription',
  run_reserve: 'dialog.billing.reason.runReserve',
  run_settle: 'dialog.billing.reason.runSettle',
  run_refund: 'dialog.billing.reason.runRefund',
  adjust: 'dialog.billing.reason.adjust',
};

const PLAN_BADGE = {
  free: 'dialog.billing.plan.free',
  creator: 'dialog.billing.plan.creator',
  studio: 'dialog.billing.plan.studio',
} as const satisfies Record<string, MessageKey>;

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
  const t = useT();
  const me = useMe();
  const plans = useQuery({ queryKey: ['plans'], queryFn: api.plans, staleTime: 300_000 });
  const history = useQuery({ queryKey: ['credits'], queryFn: api.credits });
  const [busy, setBusy] = useState<string | null>(null);
  if (!me.data) {
    return (
      <>
        <h2 id="billing-title">{t('dialog.billing.title')}</h2>
        <p>{t('dialog.billing.guest', { count: FREE_RUN_CREDITS })}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => useUi.setState({ dialog: null, signInPrompt: { reason: 'save' } })}
          >
            {t('dialog.billing.signIn')}
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
      <h2 id="billing-title">{t('dialog.billing.title')}</h2>
      <div className="balance" data-testid="billing-balance">
        {rich(t, 'dialog.billing.balance', {
          count: credits.balance,
          balance: <b>{t.number(credits.balance)}</b>,
        })}
        {credits.reserved > 0 && (
          <span className="muted"> {t('dialog.billing.held', { count: credits.reserved })}</span>
        )}
        <span className="plan-badge">
          {t(PLAN_BADGE[workspace.plan as keyof typeof PLAN_BADGE] ?? PLAN_BADGE.studio)}
        </span>
      </div>
      <p className="muted small">
        {credits.freeRunAvailable
          ? t('dialog.billing.firstRunFree', { count: FREE_RUN_CREDITS })
          : t('dialog.billing.chargedOnSuccess')}
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
              {t.number(p.priceMonthlyUsd, {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
              <span className="muted small">{t('dialog.billing.perMonth')}</span>
            </span>
            <span className="muted small">
              {t('dialog.billing.creditsPerMonth', { count: p.creditsPerMonth })}
            </span>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => void buy(p.id)}
              disabled={!!busy}
              data-testid={`buy-${p.id}`}
            >
              {busy === p.id
                ? t('dialog.billing.openingCheckout')
                : workspace.plan === p.id
                  ? t('dialog.billing.addCredits')
                  : t('dialog.billing.choose', { plan: p.name })}
            </button>
          </div>
        ))}
      </div>
      <h3 className="small-heading">{t('dialog.billing.history')}</h3>
      <ul className="history" data-testid="billing-history">
        {(history.data?.entries ?? [])
          .filter((e) => e.amount !== 0)
          .slice(0, 12)
          .map((e) => (
            <li key={e.id}>
              <span>{REASON[e.reason] ? t(REASON[e.reason]!) : e.reason}</span>
              <span className="muted small">{t.date(new Date(e.createdAt))}</span>
              <b className={e.amount > 0 ? 'ok' : ''}>{t.number(e.amount, { signDisplay: 'exceptZero' })}</b>
            </li>
          ))}
      </ul>
      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </>
  );
}
