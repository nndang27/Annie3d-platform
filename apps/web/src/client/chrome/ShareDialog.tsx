import { Copy, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type ShareResult } from '../api/client';
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
      toast('Link copied');
    } catch {
      toast('Copy failed: select the link and copy it', 'error');
    }
  };
  const revoke = async () => {
    if (!share) return;
    await api.revokeShare(share.id);
    toast('Link turned off');
    onClose();
  };
  return (
    <>
      <h2 id="share-title">Share this board</h2>
      <p>
        Anyone with the link can watch the ad, see the images and download the 3D model. They cannot edit.
      </p>
      {error && <p className="bad">{error}</p>}
      <div className="share-row">
        <input
          readOnly
          value={share?.url ?? 'Creating link…'}
          aria-label="Share link"
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
          <Copy size={14} aria-hidden="true" /> Copy
        </button>
      </div>
      {share && (
        <p className="muted small">
          {share.viewCount} view{share.viewCount === 1 ? '' : 's'} ·{' '}
          <a href={share.url} target="_blank" rel="noreferrer" data-testid="share-open">
            Open preview <ExternalLink size={12} aria-hidden="true" />
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
            Turn off link
          </button>
        )}
        <button type="button" className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </>
  );
}
