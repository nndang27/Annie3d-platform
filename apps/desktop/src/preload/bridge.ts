import type { DesktopBridge, DesktopUpdateState } from '@annie3d/contracts/desktop';
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
  onOpenFile(cb) {
    const h = (_: unknown, f: { name: string; bytes: Uint8Array }) => cb(f);
    ipcRenderer.on('files:open', h);
    ipcRenderer.send('files:subscribe');
    return () => ipcRenderer.off('files:open', h);
  },
};

contextBridge.exposeInMainWorld('annieDesktop', bridge);
