import type { DesktopBridge, DocCommand, DocsBridge } from '@annie3d/contracts';
import { create } from 'zustand';
import { ApiError, api } from '../api/client';
import { loadLocalBoard, loadSnapshot, useBoard } from '../store/board';
import { toast, useUi } from '../store/ui';
import { setBeforeSignIn } from './auth';
import {
  boardFromManifest,
  buildPayload,
  downloadBoardFile,
  fileNameFor,
  openBoardFilePicker,
  parseManifest,
  uploadBoardFile,
} from './boardFile';

/**
 * Local-first boards in the desktop app: a `.annie3d` file is the document (one window each,
 * `?doc=<id>`). Opening reads only its manifest (assets stream from disk through the shell),
 * edits stay in memory until Save writes the file back, and nothing goes to the server.
 *
 * Only a run (or another server action) needs the board on the server: the first one uploads
 * the current state as a working copy (a hidden board, deleted WORKING_COPY_TTL_DAYS after its
 * last run) and the window switches to it, so runs work as on any cloud board. The file is still
 * the document: results come back into it on the next Save.
 */

const bridge = (window as { annieDesktop?: DesktopBridge }).annieDesktop ?? null;
/** Board files as documents (desktop shell 0.3.0+). */
export const docs: DocsBridge | null = bridge?.docs ?? null;
/** The document this window shows, if it is a document window. */
export const docId = docs ? new URLSearchParams(location.search).get('doc') : null;

export interface DocState {
  name: string;
  path: string | null;
  dirty: boolean;
  /** What the document is busy with (saving, preparing a run), shown in the top bar. */
  busy: string | null;
}
export const useDoc = create<{ doc: DocState | null }>()(() => ({ doc: null }));

/** Asset paths the document's file holds (copied from disk on save, never re-read). */
let assets = new Set<string>();
let revision = 0;
/** Board changes that are not edits (switching to the working copy) do not dirty the file. */
let suspended = false;

const patch = (p: Partial<DocState>) => {
  const doc = useDoc.getState().doc;
  if (doc) useDoc.setState({ doc: { ...doc, ...p } });
};

function setDirty(dirty: boolean) {
  const doc = useDoc.getState().doc;
  if (!doc || !docs || !docId || doc.dirty === dirty) return;
  patch({ dirty });
  docs.setDirty(docId, dirty);
}

/** Loads this window's document (a new, empty one has no manifest). */
export async function loadDocument() {
  if (!docs || !docId) return;
  const f = await docs.read(docId);
  if (!f) throw new Error('This board file is no longer open.');
  assets = new Set(f.assets.map((a) => a.path));
  const sizes = new Map(f.assets.map((a) => [a.path, a.size]));
  const url = (p: string) => `/__doc/${docId}/${p}`;
  const board = f.manifest
    ? await boardFromManifest(
        parseManifest(f.manifest),
        async (p) => (sizes.has(p) ? { url: url(p), size: sizes.get(p)! } : null),
        async (file) => ({ url: url(file.path), size: 0 }),
      )
    : { title: f.name.replace(/\.annie3d$/i, ''), nodes: [], edges: [], versions: [] };
  loadLocalBoard(board, 'file');
  useUi.setState({ initialFit: null });
  useDoc.setState({ doc: { name: f.name, path: f.path, dirty: f.draft, busy: null } });
  if (f.draft) docs.setDirty(docId, true);
  setBeforeSignIn(stashDocument);
  useBoard.subscribe((s, p) => {
    if (suspended) return;
    if (s.graph !== p.graph || s.versions !== p.versions || s.title !== p.title) {
      revision++;
      setDirty(true);
    }
  });
}

let saving: Promise<boolean> | null = null;

/**
 * ⌘S. Document windows write their file (asking where on the first save or with `as`); other
 * desktop windows save a copy as a new file; the website downloads the board file.
 */
export function saveDocument(as = false): Promise<boolean> {
  if (!docs) return downloadBoardFile().then(() => true);
  if (!docId) return saveCopy();
  saving ??= (async () => {
    const doc = useDoc.getState().doc;
    if (!doc) return false;
    const rev = revision;
    patch({ busy: 'Saving…' });
    try {
      const payload = await buildPayload({ id: docId, assets });
      const suggestedName = doc.path ? doc.name : fileNameFor(useBoard.getState().title);
      const r = await docs.save(docId, payload, { as, suggestedName });
      if (!r) return false;
      // The new file holds every asset now: later saves copy them from it.
      assets = new Set(payload.files.map((f) => f.path));
      patch({ name: r.name, path: r.path });
      // Edits made while writing are not in the file yet.
      if (revision === rev) {
        patch({ dirty: false });
        docs.setDirty(docId, false);
      }
      return true;
    } catch (e) {
      toast(`Could not save: ${(e as Error).message}`, 'error');
      return false;
    } finally {
      patch({ busy: null });
      saving = null;
    }
  })();
  return saving;
}

async function saveCopy(): Promise<boolean> {
  const { graph, title } = useBoard.getState();
  if (!graph.nodes.size) {
    toast('The board is empty');
    return false;
  }
  try {
    const r = await docs!.saveCopy(await buildPayload(), fileNameFor(title));
    if (r) toast(`Saved ${r.name}`);
    return !!r;
  } catch (e) {
    toast(`Could not save: ${(e as Error).message}`, 'error');
    return false;
  }
}

/** Menu commands from the shell (File > Save, the close dialog's Save, Import). */
export function onDocCommand(c: DocCommand) {
  if (c === 'import') return openBoardFilePicker();
  if (c === 'save' || c === 'saveAs') return void saveDocument(c === 'saveAs');
  if (c === 'saveAndClose' && docs && docId)
    void saveDocument().then((ok) => {
      if (ok) docs.close(docId);
    });
}

/**
 * Before this window leaves (Google sign-in navigates away and back): unsaved edits wait in
 * the shell, and the document comes back with them.
 */
export async function stashDocument() {
  if (!docs || !docId || !useDoc.getState().doc?.dirty) return;
  await docs.stash(docId, await buildPayload({ id: docId, assets }));
}

type Attach = { ok: true; idOf: (id: string) => string } | { ok: false; signin: boolean };
let attaching: Promise<Attach> | null = null;

/** Uploads the document's current state as a working copy and switches this window to it. */
function attachWorkingCopy() {
  attaching ??= (async () => {
    const st = useBoard.getState();
    patch({ busy: 'Preparing to run…' });
    try {
      let boardId: string;
      try {
        boardId = (await api.createBoard({ title: st.title, starter: 'blank', workingCopy: true })).board.id;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return { ok: false, signin: true };
        throw e;
      }
      const nodes = [...st.graph.nodes.values()];
      const ids = new Map<string, string>();
      if (nodes.length) {
        const payload = await buildPayload({ id: docId!, assets });
        const packed = await docs!.pack(docId!, payload);
        const r = await uploadBoardFile(
          boardId,
          {
            size: packed.size,
            slice: async (o, l) =>
              (await fetch(packed.url, { headers: { range: `bytes=${o}-${o + l - 1}` } })).blob(),
          },
          { x: Math.min(...nodes.map((n) => n.x)), y: Math.min(...nodes.map((n) => n.y)) },
        );
        // The copy's nodes are the file's nodes in the same order, with new ids.
        const order = (JSON.parse(payload.manifest) as { nodes: { id: string }[] }).nodes;
        order.forEach((n, i) => {
          if (r.nodeIds[i]) ids.set(n.id, r.nodeIds[i]!);
        });
      }
      const idOf = (id: string) => ids.get(id) ?? id;
      const snap = await api.board(boardId);
      suspended = true;
      try {
        loadSnapshot(snap);
      } finally {
        suspended = false;
      }
      // Node ids changed with the copy: follow them.
      const ui = useUi.getState();
      useUi.setState({
        selected: new Set([...ui.selected].map(idOf)),
        editingNodeId: ui.editingNodeId && idOf(ui.editingNodeId),
        simulatingNodeId: ui.simulatingNodeId && idOf(ui.simulatingNodeId),
      });
      return { ok: true, idOf };
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not prepare the run', 'error');
      return { ok: false, signin: false };
    } finally {
      patch({ busy: null });
      attaching = null;
    }
  })();
  return attaching;
}

type Reason = 'run' | 'share' | 'save';

/**
 * Actions that need the board on the server (runs, the agent, 3D edits and exports). Cloud
 * boards go ahead; guests are asked to sign in; a board file first gets its working copy.
 */
export function withCloud(reason: Reason, action: (nodeId?: string) => void, nodeId?: string) {
  const { mode } = useBoard.getState();
  if (mode === 'remote') return action(nodeId);
  if (mode === 'guest') return useUi.setState({ signInPrompt: { reason, nodeId } });
  if (mode !== 'file') return;
  void attachWorkingCopy().then(async (r) => {
    if (r.ok) action(nodeId && r.idOf(nodeId));
    else if (r.signin) {
      await stashDocument();
      useUi.setState({ signInPrompt: { reason, nodeId } });
    }
  });
}
