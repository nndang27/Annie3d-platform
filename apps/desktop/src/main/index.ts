import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DesktopInfo, DesktopUpdateState } from '@annie3d/contracts/desktop';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
  session,
  shell,
} from 'electron';
import { DEV_URL, INLINE_HOSTS, ORIGIN } from './config';
import { isBoardFile, openPath, setDeliver } from './files';
import { parseHeaders } from './headers';
import { interceptOrigin } from './protocol';
import { ShellUpdater } from './shellUpdate';
import { WebPackStore } from './webpack';

/**
 * Annie 3D desktop shell. The window shows the website's own code, served from a stored,
 * signed web pack (see webpack.ts) on the website's origin; this process adds what a browser
 * tab cannot: updates on the user's click, opening `.annie3d` files, `annie3d://` links, native
 * menus. The page talks to it only through `window.annieDesktop` (preload/bridge.ts).
 */
// Tests (and side-by-side installs) can isolate the app's data folder; must run before any store reads it.
if (process.env.ANNIE3D_USER_DATA) app.setPath('userData', process.env.ANNIE3D_USER_DATA);
else useLegacyUserData();

/**
 * Builds before productName was set ran as "@annie3d/desktop" (the macOS menu read "Quit
 * @annie3d/desktop") and kept their data in <appData>/@annie3d/desktop. Keep using that folder
 * when it exists, so boards and window state survive. Moving it was tried and was not safe: the
 * new <appData>/Annie 3D folder already existed by the time this code ran, so nothing moved.
 */
function useLegacyUserData() {
  const legacy = join(app.getPath('appData'), '@annie3d', 'desktop');
  if (existsSync(legacy)) app.setPath('userData', legacy);
}

const PROTOCOL = 'annie3d';
const bundledDir = app.isPackaged
  ? join(process.resourcesPath, 'webpack')
  : join(__dirname, '../../web/dist/client');

if (!app.requestSingleInstanceLock()) app.quit();
if (process.defaultApp && process.argv[1])
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]]);
else app.setAsDefaultProtocolClient(PROTOCOL);

const windows = new Set<BrowserWindow>();
const broadcast = (channel: string, payload: unknown) => {
  for (const w of windows) if (!w.isDestroyed()) w.webContents.send(channel, payload);
};
const pack = new WebPackStore(
  bundledDir,
  () => broadcast('updates:state', updateState()),
  () => {
    for (const w of windows) w.webContents.reload();
  },
);
const shellUpdater = new ShellUpdater(() => broadcast('updates:state', updateState()));
function updateState(): DesktopUpdateState {
  return {
    web: pack.state,
    shell: shellUpdater.state,
    current: DEV_URL ? 'dev' : pack.version,
    rolledBackFrom: pack.rolledBackFrom,
  };
}

// ---- files and links from the OS (may arrive before `ready`) ----
app.on('open-file', (e, path) => {
  e.preventDefault();
  openPath(path);
});
app.on('open-url', (e, url) => {
  e.preventDefault();
  openLink(url);
});
for (const a of process.argv.slice(1)) if (isBoardFile(a)) openPath(a);
app.on('second-instance', (_e, argv) => {
  for (const a of argv) {
    if (isBoardFile(a)) openPath(a);
    else if (a.startsWith(`${PROTOCOL}://`)) openLink(a);
  }
  const w = [...windows][0];
  if (w) {
    if (w.isMinimized()) w.restore();
    w.focus();
  }
});

/** `annie3d://open?path=/s/abc` opens that page of the site in the app. */
function openLink(url: string) {
  try {
    const u = new URL(url);
    const path = u.searchParams.get('path') ?? '/';
    if (!path.startsWith('/') || path.startsWith('//')) return;
    const w = [...windows][0] ?? createWindow();
    void w.loadURL(`${DEV_URL ?? ORIGIN}${path}`);
  } catch {
    /* malformed link */
  }
}

// ---- windows ----
const stateFile = () => join(app.getPath('userData'), 'window.json');
function loadBounds() {
  try {
    return JSON.parse(readFileSync(stateFile(), 'utf8')) as {
      width: number;
      height: number;
      x?: number;
      y?: number;
    };
  } catch {
    return { width: 1440, height: 900 };
  }
}

function createWindow() {
  const b = loadBounds();
  const win = new BrowserWindow({
    ...b,
    minWidth: 360,
    minHeight: 480,
    show: false,
    backgroundColor: '#f2f2f2',
    title: 'Annie 3D',
    // macOS: a click on the inactive window also reaches the page, as in Chrome (Electron's
    // default only activates the window, so the first click after switching apps is lost).
    acceptFirstMouse: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      // Compile scripts into V8's code cache on first run (faster later starts).
      v8CacheOptions: 'bypassHeatCheck',
    },
  });
  windows.add(win);
  win.once('ready-to-show', () => win.show());
  win.on('close', () => {
    if (!win.isMaximized() && !win.isFullScreen())
      writeFileSync(stateFile(), JSON.stringify(win.getBounds()));
  });
  win.on('closed', () => windows.delete(win));
  win.on('focus', () => maybeCheck());

  // Only our site (and Google sign-in) runs inside the app; any other link opens in the browser.
  const inside = (url: string) => {
    try {
      const u = new URL(url);
      return u.origin === new URL(DEV_URL ?? ORIGIN).origin || INLINE_HOSTS.has(u.hostname);
    } catch {
      return false;
    }
  };
  win.webContents.on('will-navigate', (e, url) => {
    if (inside(url)) return;
    e.preventDefault();
    void shell.openExternal(url);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (inside(url)) return { action: 'allow' };
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  void win.loadURL(`${DEV_URL ?? ORIGIN}/`);
  return win;
}

// ---- menu: native Edit roles for text, but ⌘Z/⌘A reach the canvas when no text field has focus ----
function sendKeyToPage(key: string, shift = false) {
  const w = BrowserWindow.getFocusedWindow();
  if (!w) return;
  void w.webContents
    .executeJavaScript(
      `(() => { const a = document.activeElement; const edit = a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
      if (edit) return 'edit';
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, metaKey: ${process.platform === 'darwin'}, ctrlKey: ${process.platform !== 'darwin'}, shiftKey: ${shift}, bubbles: true }));
      return 'page'; })()`,
    )
    .then((where: string) => {
      if (where !== 'edit') return;
      if (key === 'z') (shift ? w.webContents.redo : w.webContents.undo).call(w.webContents);
      else if (key === 'a') w.webContents.selectAll();
    });
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(mac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Board File…',
          accelerator: 'CmdOrCtrl+O',
          // The page handles ⌘O itself (same picker as the website); the menu item is for mice.
          registerAccelerator: false,
          click: async () => {
            const r = await dialog.showOpenDialog({
              filters: [{ name: 'Annie 3D board', extensions: ['annie3d'] }],
            });
            for (const p of r.filePaths) openPath(p);
          },
        },
        { type: 'separator' },
        mac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        // macOS menus take key equivalents before the page, so these route ⌘Z/⌘A to the canvas or
        // to the focused text field. On Windows/Linux the page gets the keys first and Chromium
        // edits text itself; registering them there would undo twice.
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          registerAccelerator: mac,
          click: () => sendKeyToPage('z'),
        },
        {
          label: 'Redo',
          accelerator: 'Shift+CmdOrCtrl+Z',
          registerAccelerator: mac,
          click: () => sendKeyToPage('z', true),
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          registerAccelerator: mac,
          click: () => sendKeyToPage('a'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        ...(app.isPackaged ? [] : [{ role: 'reload' as const }, { role: 'toggleDevTools' as const }]),
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{ label: 'Annie 3D website', click: () => void shell.openExternal(ORIGIN) }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- update checks: at start, every 30 min, and on focus after 5 min ----
let lastCheck = 0;
function maybeCheck(force = false) {
  if (DEV_URL) return;
  if (!force && Date.now() - lastCheck < 5 * 60_000) return;
  lastCheck = Date.now();
  void pack.check();
  void shellUpdater.check();
}

// ---- bridge ----
ipcMain.handle(
  'app:info',
  (): DesktopInfo => ({
    shellVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    webVersion: DEV_URL ? 'dev' : pack.version,
    mode: DEV_URL ? 'dev' : 'pack',
  }),
);
ipcMain.handle('updates:get', () => updateState());
ipcMain.handle('updates:check', async () => {
  lastCheck = Date.now();
  await Promise.all([pack.check(), shellUpdater.check()]);
  return updateState();
});
ipcMain.handle('updates:apply', async (_e, layer: 'web' | 'shell') => {
  if (layer === 'web') await pack.apply();
  else shellUpdater.apply();
});
ipcMain.on('app:ready', () => void pack.confirm());
ipcMain.on('files:subscribe', (e) => {
  const wc = e.sender;
  setDeliver((f) => {
    if (!wc.isDestroyed()) wc.send('files:open', f);
  });
});

app.whenReady().then(async () => {
  buildMenu();
  if (!DEV_URL) {
    await pack.init();
    let headers = parseHeaders(await pack.readText('_headers'));
    interceptOrigin(session.defaultSession, async (p) => {
      if (p === '/_headers') return null;
      return pack.serve(p, headers);
    });
    // New web pack → new headers too.
    app.on('browser-window-focus', async () => {
      headers = parseHeaders(await pack.readText('_headers'));
    });
  }
  shellUpdater.init();
  createWindow();
  setInterval(() => maybeCheck(true), 30 * 60_000);
  setTimeout(() => maybeCheck(true), 5_000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Keep the bundled web pack path visible in logs for support.
if (!existsSync(bundledDir)) console.warn(`[annie3d] bundled web pack missing at ${bundledDir}`);
