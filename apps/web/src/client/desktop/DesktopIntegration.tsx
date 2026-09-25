import type { DesktopBridge, DesktopUpdateState } from '@annie3d/contracts';
import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { currentViewCentre, importBoardFile } from '../lib/boardFile';
import { useBoard } from '../store/board';
import { toast } from '../store/ui';
import './desktop.css';

/**
 * Desktop-only UI (feature `desktop-updates`), loaded only inside the Annie 3D app, so website
 * visitors never download it:
 * - the update pill: a website deploy downloads in the background while the app is open, then
 *   the pill offers "Restart to update" (the app quits and starts into the new version, as the
 *   Claude and Codex apps do). Downloading and the restart itself are silent;
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
  if (web.status === 'shell-required')
    return (
      <div className="update-pill" role="status" data-testid="update-pill">
        <span>A newer app is needed for the latest update (app {web.minShell}+).</span>
      </div>
    );
  const layer = shell.status === 'ready' ? 'shell' : web.status === 'ready' ? 'web' : null;
  if (!layer) return null;
  const apply = async () => {
    setBusy(true);
    await bridge.updates.apply(layer);
    setBusy(false);
  };
  return (
    <div className="update-pill" role="status" data-testid="update-pill">
      <RefreshCw size={14} aria-hidden />
      <span>Update available</span>
      <button type="button" onClick={() => void apply()} disabled={busy} data-testid="update-apply">
        {busy ? 'Restarting…' : 'Restart to update'}
      </button>
    </div>
  );
}
