import type { DesktopBridge, DesktopUpdateState } from '@annie3d/contracts';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { currentViewCentre, importBoardFile } from '../lib/boardFile';
import { useBoard } from '../store/board';
import { toast } from '../store/ui';
import './desktop.css';

/**
 * Desktop-only UI (feature `desktop-updates`), loaded only inside the Annie 3D app, so website
 * visitors never download it:
 * - the update pill: "Update ready" after a website deploy (reload into the new web pack) or a new
 *   app build (relaunch), listing the features that changed;
 * - `.annie3d` files opened from the OS go through the same import as "Open board file";
 * - `ready()` once the board has loaded, which confirms a fresh update (the shell rolls back
 *   to the previous version if this never arrives).
 */
export default function DesktopIntegration({ bridge }: { bridge: DesktopBridge }) {
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const [busy, setBusy] = useState(false);
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
  if (web.status !== 'ready') return null;
  const shared = web.changes.filter((c) => c.surface === 'shared');
  const desktopOnly = web.changes.filter((c) => c.surface === 'desktop');
  const kb = Math.max(1, Math.round(web.bytes / 1024));
  return (
    <div className="update-pill" role="status" data-testid="update-pill" title={web.version}>
      <RefreshCw size={14} aria-hidden />
      <span>
        <b>Update ready</b>
        {shared.length > 0 && <> · {shared.map((c) => c.title).join(', ')}</>}
        {desktopOnly.length > 0 && <> · App only: {desktopOnly.map((c) => c.title).join(', ')}</>}
        <small>
          {' '}
          · {web.files} file{web.files === 1 ? '' : 's'}, {kb} KB
        </small>
      </span>
      <button type="button" onClick={() => void apply('web')} disabled={busy} data-testid="update-apply">
        Reload
      </button>
    </div>
  );
}
