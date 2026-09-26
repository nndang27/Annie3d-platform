import { Copy, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type ShareResult } from '../api/client';
import { useT } from '../i18n';
import { useBoard } from '../store/board';
import { toast, useUi } from '../store/ui';
import { Modal } from './Modal';

/** F10: one link per board; anyone with it sees the video, images and model (no sign-in). */
export function ShareDialog() {
  const dialog = useUi((s) => s.dialog);
  const open = dialog?.type === 'share';
  const close = () => useUi.getState().dialog?.type === 'share' && useUi.setState({ dialog: null });
  return (
    <Modal open={open} onClose={close} labelledBy="share-title" testId="share-dialog">
      {open && <ShareBody onClose={close} />}
    </Modal>
  );
}

function ShareBody({ onClose }: { onClose: () => void }) {
  const t = useT();
  const boardId = useBoard((s) => s.boardId);
  const [share, setShare] = useState<ShareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!boardId) return;
    // Ignore a response that arrives after this effect was cleaned up (StrictMode runs it twice).
    let live = true;
    api.createShare({ targetType: 'board', targetId: boardId }).then(
      (s) => live && setShare(s),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [boardId]);
  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      toast(t('dialog.share.copied'));
    } catch {
      toast(t('dialog.share.copyFailed'), 'error');
    }
  };
  const revoke = async () => {
    if (!share) return;
    await api.revokeShare(share.id);
    toast(t('dialog.share.revoked'));
    onClose();
  };
  return (
    <>
      <h2 id="share-title">{t('dialog.share.title')}</h2>
      <p>{t('dialog.share.body')}</p>
      {error && <p className="bad">{error}</p>}
      <div className="share-row">
        <input
          readOnly
          value={share?.url ?? t('dialog.share.creating')}
          aria-label={t('dialog.share.link')}
          onFocus={(e) => e.target.select()}
          data-testid="share-url"
        />
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => void copy()}
          disabled={!share}
          data-testid="share-copy"
        >
          <Copy size={14} aria-hidden="true" /> {t('dialog.share.copy')}
        </button>
      </div>
      {share && (
        <p className="muted small">
          {t('dialog.share.views', { count: share.viewCount })}{' '}
          <a href={share.url} target="_blank" rel="noreferrer" data-testid="share-open">
            {t('dialog.share.openPreview')} <ExternalLink size={12} aria-hidden="true" />
          </a>
        </p>
      )}
      <div className="modal-actions">
        {share && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void revoke()}
            data-testid="share-revoke"
          >
            {t('dialog.share.revoke')}
          </button>
        )}
        <button type="button" className="btn-primary" onClick={onClose}>
          {t('common.done')}
        </button>
      </div>
    </>
  );
}
