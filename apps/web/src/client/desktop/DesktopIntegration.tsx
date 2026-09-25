import type { DesktopBridge, DesktopUpdateState } from '@annie3d/contracts';
import { RefreshCw, RotateCcw, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { currentViewCentre, importBoardFile } from '../lib/boardFile';
import { useBoard } from '../store/board';
import { toast } from '../store/ui';
import './desktop.css';

/**
 * Desktop-only UI (feature `desktop-updates`), loaded only inside the Annie 3D app, so website
 * visitors never download it:
 * - the update pill: a website deploy appears within a minute while the app is open, downloads in
 *   the background, then offers "Restart to update" (the app quits and starts into the new
 *   version, as the Claude and Codex apps do); after the restart it says what changed;
 * - `.annie3d` files opened from the OS go through the same import as "Open board file";
 * - `ready()` once the board has loaded, which confirms a fresh update (the shell rolls back
 *   to the previous version if this never arrives).
 */
export default function DesktopIntegration({ bridge }: { bridge: DesktopBridge }) {
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState<DesktopUpdateState['justUpdated']>(null);
  const mode = useBoard((s) => s.mode);

  useEffect(() => {
    void bridge.updates.get().then(setState);
    return bridge.updates.onChange(setState);
  }, [bridge]);

  useEffect(() => {
    if (mode !== 'loading') bridge.ready();
  }, [bridge, mode]);

  useEffect(
    () =>
      bridge.onOpenFile(({ name, bytes }) => {
        void importBoardFile(new File([bytes as BlobPart], name), currentViewCentre());
      }),
    [bridge],
  );

  // First start after an update: say what it brought, once (the shell clears it on `ready`).
  useEffect(() => {
    if (state?.justUpdated) setUpdated(state.justUpdated);
  }, [state?.justUpdated]);
  useEffect(() => {
    if (!updated) return;
    const t = setTimeout(() => setUpdated(null), 12_000);
    return () => clearTimeout(t);
  }, [updated]);

  useEffect(() => {
    if (state?.rolledBackFrom)
      toast(`The update ${state.rolledBackFrom} did not start, so the previous version is back.`, 'error');
  }, [state?.rolledBackFrom]);

  if (!state) return null;
  const { web, shell } = state;
  const apply = async (layer: 'web' | 'shell') => {
    setBusy(true);
    await bridge.updates.apply(layer);
    setBusy(false);
  };

  if (shell.status === 'ready')
    return (
      <div className="update-pill" role="status" data-testid="update-pill">
        <RotateCcw size={14} aria-hidden />
        <span>
          App {shell.version} is ready <small>(new desktop features)</small>
        </span>
        <button type="button" onClick={() => void apply('shell')} disabled={busy} data-testid="update-apply">
          Relaunch to update
        </button>
      </div>
    );
  if (web.status === 'downloading')
    return (
      <div className="update-pill quiet" role="status" data-testid="update-pill">
        <RefreshCw size={14} aria-hidden className="spin" />
        <span>
          Downloading update · {Math.round(web.done / 1024)} / {Math.round(web.total / 1024)} KB
        </span>
      </div>
    );
  if (web.status === 'shell-required')
    return (
      <div className="update-pill" role="status" data-testid="update-pill">
        <span>A newer app is needed for the latest update (app {web.minShell}+).</span>
      </div>
    );
  if (web.status !== 'ready') {
    if (!updated) return null;
    const what = updated.notes || updated.changes.map((c) => c.title).join(', ');
    return (
      <div className="update-pill done" role="status" data-testid="update-done">
        <Sparkles size={14} aria-hidden />
        <span>
          <b>Updated</b>
          {what && <> · {what}</>}
        </span>
        <button type="button" className="icon" onClick={() => setUpdated(null)} aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
    );
  }
  const shared = web.changes.filter((c) => c.surface === 'shared');
  const desktopOnly = web.changes.filter((c) => c.surface === 'desktop');
  const kb = Math.max(1, Math.round(web.bytes / 1024));
  return (
    <div className="update-pill" role="status" data-testid="update-pill" title={web.version}>
      <RefreshCw size={14} aria-hidden />
      <span>
        <b>Update available</b>
        {web.notes && <> · {web.notes}</>}
        {!web.notes && shared.length > 0 && <> · {shared.map((c) => c.title).join(', ')}</>}
        {desktopOnly.length > 0 && <> · App only: {desktopOnly.map((c) => c.title).join(', ')}</>}
        <small>
          {' '}
          · {web.files} file{web.files === 1 ? '' : 's'}, {kb} KB
        </small>
      </span>
      <button type="button" onClick={() => void apply('web')} disabled={busy} data-testid="update-apply">
        {busy ? 'Restarting…' : 'Restart to update'}
      </button>
    </div>
  );
}
