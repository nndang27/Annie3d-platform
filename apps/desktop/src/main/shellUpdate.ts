import type { ShellUpdateState } from '@annie3d/contracts/desktop';
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { ORIGIN } from './config';

/**
 * Shell updates (layer S): a new app build through electron-updater (NSIS blockmap deltas on
 * Windows, zip differential on macOS, AppImage on Linux), from `<origin>/desktop/shell/<os>/`.
 * Only packaged apps update; macOS additionally needs a signed build (Apple Developer ID), so
 * until signing is set up the state stays "unavailable" there and the web layer still updates.
 */
export class ShellUpdater {
  state: ShellUpdateState = { status: 'idle' };
  constructor(private readonly onState: () => void) {}

  init() {
    if (!app.isPackaged || process.env.ANNIE3D_SHELL_UPDATES === '0') {
      this.set({ status: 'unavailable' });
      return;
    }
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.logger = null;
    autoUpdater.setFeedURL({ provider: 'generic', url: `${ORIGIN}/desktop/shell/${process.platform}` });
    autoUpdater.on('checking-for-update', () => this.set({ status: 'checking' }));
    autoUpdater.on('update-not-available', () => this.set({ status: 'up-to-date' }));
    autoUpdater.on('download-progress', (p) =>
      this.set({ status: 'downloading', version: '', percent: Math.round(p.percent) }),
    );
    autoUpdater.on('update-downloaded', (i) => this.set({ status: 'ready', version: i.version }));
    autoUpdater.on('error', (e) => this.set({ status: 'error', message: e.message }));
  }

  async check() {
    if (this.state.status === 'unavailable') return;
    await autoUpdater
      .checkForUpdates()
      .catch((e: Error) => this.set({ status: 'error', message: e.message }));
  }

  apply() {
    if (this.state.status === 'ready') autoUpdater.quitAndInstall();
  }

  private set(s: ShellUpdateState) {
    this.state = s;
    this.onState();
  }
}
