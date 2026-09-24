import { Download, Film } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { uploadAsset } from '../canvas/actions';
import { recordReel } from '../lib/reel';
import { useBoard } from '../store/board';
import { useRuns } from '../store/runs';
import { toast, useUi } from '../store/ui';
import { Modal } from './Modal';

/** F12: record the process reel of the last run in the browser, save it, download it. */
export function ReelDialog() {
  const dialog = useUi((s) => s.dialog);
  const open = dialog?.type === 'reel';
  const close = () => useUi.getState().dialog?.type === 'reel' && useUi.setState({ dialog: null });
  return (
    <Modal open={open} onClose={close} labelledBy="reel-title" testId="reel-dialog">
      {open && <ReelBody runId={dialog.runId} onClose={close} />}
    </Modal>
  );
}

/** Top-bar entry: appears after a run finishes with results. */
export function ReelButton() {
  const runId = useRuns((s) => s.lastFinishedRunId);
  const running = useRuns((s) => s.activeRunId !== null);
  if (!runId || running) return null;
  return (
    <div className="pill">
      <button
        type="button"
        onClick={() => useUi.setState({ dialog: { type: 'reel', runId } })}
        data-testid="make-reel"
        title="A 9:16 video: the ad on top, how it was made below"
      >
        <Film size={16} aria-hidden="true" /> Process reel
      </button>
    </div>
  );
}

function ReelBody({ runId, onClose }: { runId: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'idle' | 'recording' | 'saving' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState('annie3d-reel.webm');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => void (url?.startsWith('blob:') && URL.revokeObjectURL(url)), [url]);
  const record = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setState('recording');
    try {
      const st = useBoard.getState();
      const { blob, mime } = await recordReel({
        runId,
        graph: st.graph,
        versions: st.versions,
        title: st.title,
        canvas,
        onProgress: setProgress,
      });
      setState('saving');
      const ext = mime === 'video/mp4' ? 'mp4' : 'webm';
      const fileName = `${st.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'annie3d'}-reel.${ext}`;
      const asset = await uploadAsset(new File([blob], fileName, { type: mime }), 'video');
      const reel = await api.createReel(runId, asset.id);
      setName(fileName);
      setUrl(reel.asset?.urls.original ?? URL.createObjectURL(blob));
      setState('done');
    } catch (e) {
      setError((e as Error).message);
      toast((e as Error).message, 'error');
      setState('error');
    }
  };
  return (
    <>
      <h2 id="reel-title">Process reel</h2>
      <p>A 9:16 video for Reels and TikTok: your ad on top, how Annie 3D made it below.</p>
      <div className="reel-stage">
        {state === 'done' && url ? (
          // biome-ignore lint/a11y/useMediaCaption: the reel's audio is the ad's music, no speech.
          <video src={url} controls playsInline data-testid="reel-video" />
        ) : (
          <canvas
            ref={canvasRef}
            width={540}
            height={960}
            aria-label="Reel preview"
            data-testid="reel-canvas"
          />
        )}
      </div>
      {state === 'recording' && (
        <p className="muted small" aria-live="polite" data-testid="reel-progress">
          Recording… {Math.round(progress * 100)}%
        </p>
      )}
      {state === 'saving' && <p className="muted small">Saving…</p>}
      {state === 'error' && error && (
        <p className="bad small" data-testid="reel-error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={onClose}
          disabled={state === 'recording' || state === 'saving'}
        >
          {state === 'done' ? 'Done' : 'Cancel'}
        </button>
        {state === 'done' && url ? (
          <a
            className="btn-primary"
            href={url.startsWith('blob:') ? url : `${url}?download=${name}`}
            download={name}
            data-testid="reel-download"
          >
            <Download size={14} aria-hidden="true" /> Download
          </a>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={() => void record()}
            disabled={state === 'recording' || state === 'saving'}
            data-testid="reel-record"
          >
            {state === 'error' ? 'Try again' : 'Record reel'}
          </button>
        )}
      </div>
    </>
  );
}
