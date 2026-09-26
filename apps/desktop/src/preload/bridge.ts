import type { DesktopBridge, DesktopUpdateState, DocCommand } from '@annie3d/contracts/desktop';
import { contextBridge, ipcRenderer } from 'electron';

/**
 * `window.annieDesktop`: the only door between the page (untrusted, sandboxed, no Node) and the
 * shell. Every call is a fixed IPC message with plain data; nothing else is exposed.
 */
const bridge: DesktopBridge = {
  apiVersion: 1,
  info: () => ipcRenderer.invoke('app:info'),
  updates: {
    get: () => ipcRenderer.invoke('updates:get'),
    check: () => ipcRenderer.invoke('updates:check'),
    apply: (layer) => ipcRenderer.invoke('updates:apply', layer === 'shell' ? 'shell' : 'web'),
    onChange(cb) {
      const h = (_: unknown, s: DesktopUpdateState) => cb(s);
      ipcRenderer.on('updates:state', h);
      return () => ipcRenderer.off('updates:state', h);
    },
  },
  ready: () => ipcRenderer.send('app:ready'),
  setLocale: (locale) => ipcRenderer.send('app:setLocale', String(locale)),
  onOpenFile(cb) {
    const h = (_: unknown, f: { name: string; bytes: Uint8Array }) => cb(f);
    ipcRenderer.on('files:open', h);
    ipcRenderer.send('files:subscribe');
    return () => ipcRenderer.off('files:open', h);
  },
  docs: {
    read: (id) => ipcRenderer.invoke('docs:read', id),
    save: (id, payload, opts) => ipcRenderer.invoke('docs:save', id, payload, opts),
    saveCopy: (payload, name) => ipcRenderer.invoke('docs:saveCopy', payload, name),
    stash: (id, payload) => ipcRenderer.invoke('docs:stash', id, payload),
    pack: (id, payload) => ipcRenderer.invoke('docs:pack', id, payload),
    setDirty: (id, dirty) => ipcRenderer.send('docs:setDirty', id, dirty),
    open: () => ipcRenderer.send('docs:open'),
    create: () => ipcRenderer.send('docs:create'),
    close: (id) => ipcRenderer.send('docs:close', id),
    onCommand(cb) {
      const h = (_: unknown, c: DocCommand) => cb(c);
      ipcRenderer.on('docs:command', h);
      return () => ipcRenderer.off('docs:command', h);
    },
  },
};

contextBridge.exposeInMainWorld('annieDesktop', bridge);
