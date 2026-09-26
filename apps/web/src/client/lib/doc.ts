import {
  type BoardFileOutput,
  type DesktopBridge,
  type DocCommand,
  type DocPayload,
  type DocsBridge,
  type Graph,
  type GraphOp,
  type NodeVersionDto,
  runPlan,
  upstreamOf,
} from '@annie3d/contracts';
import { create } from 'zustand';
import { ApiError, api } from '../api/client';
import { t } from '../i18n';
import {
  applyRemote,
  loadLocalBoard,
  loadSnapshot,
  setBoardHooks,
  upsertVersions,
  useBoard,
} from '../store/board';
import { toast, useUi } from '../store/ui';
import { setBeforeSignIn } from './auth';
import {
  boardFromManifest,
  buildPayload,
  downloadBoardFile,
  fileNameFor,
  openBoardFilePicker,
  parseManifest,
  type UploadSource,
  uploadBoardFile,
} from './boardFile';

/**
 * Local-first board files. A `.annie3d` file is the document: in the desktop app one window per
 * file (`?doc=<id>`, assets streamed from disk by the shell), on the website the tab shows it in
 * Chrome and Edge (`?file=<key>`, File System Access API, lib/webDoc.ts). Opening sends nothing
 * to the server; edits stay in memory until Save writes the file back.
 *
 * Only server actions (runs, the agent, 3D edits, exports) need the board on the server. The
 * first one creates a working copy: a hidden board (deleted WORKING_COPY_TTL_DAYS after its last
 * run) holding every node and wire but only the results that action reads. The other results stay
 * in the file, shown from it, and are sent when a later action needs them. The file is still the
 * document: new results come back into it on the next Save.
 */

const bridge = (window as { annieDesktop?: DesktopBridge }).annieDesktop ?? null;
/** Board files as documents in the desktop app (shell 0.3.0+). */
export const docs: DocsBridge | null = bridge?.docs ?? null;
const params = new URLSearchParams(location.search);
/** The document this desktop window shows. */
export const docId = docs ? params.get('doc') : null;
/** The website writes files back only where the File System Access API exists (Chrome, Edge). */
export const webFiles = !docs && typeof window !== 'undefined' && 'showOpenFilePicker' in window;
/** The file this website tab was loaded with (a reload of a file tab). */
const webFileKey = webFiles ? params.get('file') : null;
/** The page starts on a board file (the desktop window of one, or a reloaded file tab). */
export const startsAsDoc = !!(docId || webFileKey);

export interface DocState {
  name: string;
  path: string | null;
  dirty: boolean;
  /** What the document is busy with (saving, preparing a run), shown in the top bar. */
  busy: string | null;
}
export const useDoc = create<{ doc: DocState | null; needsPermission: string | null }>()(() => ({
  doc: null,
  needsPermission: null,
}));

/** Where a document lives: the desktop shell, or a file handle in the browser. */
export interface DocHost {
  read(): Promise<{
    name: string;
    path: string | null;
    manifest: string | null;
    draft: boolean;
    assets: Set<string>;
    fileOf(path: string, mime: string): Promise<{ url: string; size: number } | null>;
    bundleOf(f: BoardFileOutput): Promise<{ url: string; size: number } | null>;
  }>;
  /** The URL prefix of the document's assets, when they have one. */
  prefix: string | null;
  /**
   * Writes the file (asking where when it has none yet, or with `as`). Returns its name and
   * path, the assets it now holds, and new URLs for assets whose URL changed; null if cancelled.
   */
  save(
    payload: DocPayload,
    as: boolean,
    suggestedName: string,
  ): Promise<{ name: string; path: string | null; moved?: Map<string, string> } | null>;
  pack(payload: DocPayload): Promise<UploadSource>;
  stash(payload: DocPayload): Promise<void>;
  setDirty(dirty: boolean, name: string): void;
  close(): void;
}

let host: DocHost | null = null;
/** Asset paths the document's file holds (copied from it on save, never re-read). */
let assets = new Set<string>();
let revision = 0;
/** Edits are tracked from the first document on (a tab may open another file later). */
let tracking = false;
/** Board changes that are not edits (switching to the working copy) do not dirty the file. */
let suspended = false;
const quietly = (fn: () => void) => {
  suspended = true;
  try {
    fn();
  } finally {
    suspended = false;
  }
};

const patch = (p: Partial<DocState>) => {
  const doc = useDoc.getState().doc;
  if (doc) useDoc.setState({ doc: { ...doc, ...p } });
};

function setDirty(dirty: boolean) {
  const doc = useDoc.getState().doc;
  if (!doc || !host || doc.dirty === dirty) return;
  patch({ dirty });
  host.setDirty(dirty, doc.name);
}

function desktopHost(id: string, bridge: DocsBridge): DocHost {
  const prefix = `/__doc/${id}/`;
  return {
    prefix,
    async read() {
      const f = await bridge.read(id);
      if (!f) throw new Error(t('file.noLongerOpen'));
      const sizes = new Map(f.assets.map((a) => [a.path, a.size]));
      return {
        ...f,
        assets: new Set(sizes.keys()),
        fileOf: async (p) => (sizes.has(p) ? { url: prefix + p, size: sizes.get(p)! } : null),
        bundleOf: async (b) => ({ url: prefix + b.path, size: 0 }),
      };
    },
    save: (payload, as, suggestedName) => bridge.save(id, payload, { as, suggestedName }),
    async pack(payload) {
      const packed = await bridge.pack(id, payload);
      return {
        size: packed.size,
        slice: async (o, l) =>
          (await fetch(packed.url, { headers: { range: `bytes=${o}-${o + l - 1}` } })).blob(),
      };
    },
    stash: (payload) => bridge.stash(id, payload),
    setDirty: (dirty) => bridge.setDirty(id, dirty),
    close: () => bridge.close(id),
  };
}

/** Loads this window's document (a new, empty one has no manifest). */
export async function loadDocument(web?: { key: string; handle: FileSystemFileHandle }) {
  if (docId && docs) host = desktopHost(docId, docs);
  else if (web || webFileKey)
    host = await (await import('./webDoc')).webDocHost(web?.key ?? webFileKey!, web?.handle);
  else return;
  const f = await host.read();
  assets = f.assets;
  localOnly.clear();
  revision = 0;
  const board = f.manifest
    ? await boardFromManifest(parseManifest(f.manifest), f.fileOf, f.bundleOf)
    : { title: f.name.replace(/\.annie3d$/i, ''), nodes: [], edges: [], versions: [] };
  loadLocalBoard(board, 'file');
  useUi.setState({ initialFit: null });
  useDoc.setState({ doc: { name: f.name, path: f.path, dirty: f.draft, busy: null }, needsPermission: null });
  host.setDirty(f.draft, f.name);
  setBeforeSignIn(stashDocument);
  setBoardHooks({ afterSnapshot: putBackLocalResults, outgoing: withoutLocalResults });
  if (tracking) return;
  tracking = true;
  useBoard.subscribe((s, p) => {
    if (s.graph !== p.graph) forgetReplacedResults(s.graph);
    if (suspended) return;
    if (s.graph !== p.graph || s.versions !== p.versions || s.title !== p.title) {
      revision++;
      setDirty(true);
    }
  });
}

const docRef = () => ({ prefix: host?.prefix ?? null, assets });

let saving: Promise<boolean> | null = null;

/**
 * ⌘S. Board files are written back (asking where on the first save or with `as`); other desktop
 * windows and Chrome/Edge tabs save a copy as a new file; other browsers download it.
 */
export function saveDocument(as = false): Promise<boolean> {
  if (!host) {
    if (docs) return saveCopy((p, name) => docs.saveCopy(p, name));
    if (webFiles) return import('./webDoc').then((w) => saveCopy(w.saveCopyAs));
    return downloadBoardFile().then(() => true);
  }
  saving ??= (async () => {
    const doc = useDoc.getState().doc;
    if (!doc || !host) return false;
    const rev = revision;
    patch({ busy: t('file.saving') });
    try {
      const payload = await buildPayload(docRef());
      const suggestedName = doc.path ? doc.name : fileNameFor(useBoard.getState().title);
      const r = await host.save(payload, as, suggestedName);
      if (!r) return false;
      // The new file holds every asset now: later saves copy them from it.
      assets = new Set(payload.files.map((f) => f.path));
      if (r.moved?.size) quietly(() => moveUrls(r.moved!));
      patch({ name: r.name, path: r.path });
      // Edits made while writing are not in the file yet.
      if (revision === rev) {
        patch({ dirty: false });
        host.setDirty(false, r.name);
      }
      return true;
    } catch (e) {
      if ((e as Error).name !== 'AbortError')
        toast(t('file.couldNotSave', { reason: (e as Error).message }), 'error');
      return false;
    } finally {
      patch({ busy: null });
      saving = null;
    }
  })();
  return saving;
}

/** Assets read from a file that was just rewritten get their new URLs (the website's slices). */
function moveUrls(moved: Map<string, string>) {
  const move = (v: NodeVersionDto): NodeVersionDto => ({
    ...v,
    outputs: v.outputs.map((o) => ({
      ...o,
      urls: Object.fromEntries(
        Object.entries(o.urls).map(([k, u]) => [k, (u && moved.get(u)) ?? u]),
      ) as typeof o.urls,
    })),
  });
  useBoard.setState({ versions: new Map([...useBoard.getState().versions].map(([id, v]) => [id, move(v)])) });
  for (const [id, v] of localOnly) localOnly.set(id, move(v));
}

async function saveCopy(
  write: (p: DocPayload, name: string) => Promise<{ name: string } | null>,
): Promise<boolean> {
  const { graph, title } = useBoard.getState();
  if (!graph.nodes.size) {
    toast(t('file.boardEmpty'));
    return false;
  }
  try {
    const r = await write(await buildPayload(), fileNameFor(title));
    if (r) toast(t('file.saved', { name: r.name }));
    return !!r;
  } catch (e) {
    if ((e as Error).name !== 'AbortError')
      toast(t('file.couldNotSave', { reason: (e as Error).message }), 'error');
    return false;
  }
}

/** Menu commands from the desktop shell (File > Save, the close dialog's Save, Import). */
export function onDocCommand(c: DocCommand) {
  if (c === 'import') return openBoardFilePicker();
  if (c === 'save' || c === 'saveAs') return void saveDocument(c === 'saveAs');
  if (c === 'saveAndClose' && host)
    void saveDocument().then((ok) => {
      if (ok) host?.close();
    });
}

/**
 * Before this window leaves (Google sign-in navigates away and back): unsaved edits are kept
 * (by the shell, or in the browser), and the document comes back with them.
 */
export async function stashDocument() {
  if (!host || !useDoc.getState().doc?.dirty) return;
  await host.stash(await buildPayload(docRef()));
}

// ------------------------------------------------------------------ the working copy

/**
 * Results only in the file, not on the working copy (by the copy's node id). They stay on the
 * canvas, shown from the file, and are sent when an action needs them.
 */
const localOnly = new Map<string, NodeVersionDto>();
const localVersionIds = () => new Set([...localOnly.values()].map((v) => v.id));

/** A snapshot of the working copy has no local results: put them back on their nodes. */
function putBackLocalResults() {
  if (!localOnly.size) return;
  const st = useBoard.getState();
  const nodes = new Map(st.graph.nodes);
  const versions = new Map(st.versions);
  for (const [id, v] of localOnly) {
    const n = nodes.get(id);
    if (!n || n.currentVersionId) continue;
    nodes.set(id, { ...n, currentVersionId: v.id });
    versions.set(v.id, { ...v, nodeId: id });
  }
  quietly(() => useBoard.setState({ graph: { nodes, edges: st.graph.edges }, versions }));
}

/** A node that got a new result on the server no longer needs its file result sent. */
function forgetReplacedResults(g: Graph) {
  for (const [id, v] of localOnly) {
    const n = g.nodes.get(id);
    if (n?.currentVersionId && n.currentVersionId !== v.id) localOnly.delete(id);
  }
}

/** Ops never point the server at a result it does not have (undo, paste of a file result). */
function withoutLocalResults(ops: GraphOp[]): GraphOp[] {
  if (!localOnly.size) return ops;
  const local = localVersionIds();
  return ops.flatMap((op): GraphOp[] => {
    if (op.type !== 'node.update') return [op];
    const p = { ...op.patch } as Record<string, unknown>;
    const copied = typeof p.copyOfVersionId === 'string' && local.has(p.copyOfVersionId);
    if (copied || (typeof p.currentVersionId === 'string' && local.has(p.currentVersionId))) {
      // A pasted copy of a file result is a file result too.
      const v = useBoard.getState().versions.get(p.currentVersionId as string);
      if (copied && v) localOnly.set(op.id, v);
      delete p.currentVersionId;
      delete p.copyOfVersionId;
    }
    return Object.keys(p).length ? [{ ...op, patch: p } as GraphOp] : [];
  });
}

/** What an action reads, as node ids (it needs those nodes' results on the server). */
export type Need =
  | { kind: 'run'; nodeId: string | null; scope: 'node' | 'from_here' | 'with_upstream' | 'all' }
  | { kind: 'export'; nodeId?: string }
  | { kind: 'edit'; nodeId?: string }
  | { kind: 'agent' };

function readsOf(g: Graph, need: Need): Set<string> {
  const withParents = (ids: Iterable<string>) => {
    const out = new Set(ids);
    for (const e of g.edges.values()) if (out.has(e.target)) out.add(e.source);
    return out;
  };
  switch (need.kind) {
    // The run's nodes (a node whose result is on the server and fresh is not run again) and
    // their inputs.
    case 'run':
      return withParents(runPlan(g, need.nodeId, need.scope));
    case 'export':
      return need.nodeId ? new Set([need.nodeId, ...upstreamOf(g, need.nodeId)]) : new Set();
    case 'edit':
      return new Set(need.nodeId ? [need.nodeId] : []);
    case 'agent':
      return new Set(g.nodes.keys());
  }
}

type Attach = { ok: true; idOf: (id: string) => string } | { ok: false; signin: boolean };
let attaching: Promise<Attach> | null = null;

/**
 * Creates the working copy: every node and wire, and only the results `need` reads. The
 * window switches to it; the other results stay here (localOnly).
 */
function attachWorkingCopy(need: Need) {
  attaching ??= (async (): Promise<Attach> => {
    const st = useBoard.getState();
    patch({ busy: t('run.preparing') });
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
      const reads = readsOf(st.graph, need);
      if (nodes.length) {
        const payload = await buildPayload(docRef(), { results: reads });
        const r = await uploadBoardFile(boardId, await host!.pack(payload), {
          x: Math.min(...nodes.map((n) => n.x)),
          y: Math.min(...nodes.map((n) => n.y)),
        });
        // The copy's nodes are the file's nodes in the same order, with new ids.
        const order = (JSON.parse(payload.manifest) as { nodes: { id: string }[] }).nodes;
        order.forEach((n, i) => {
          if (r.nodeIds[i]) ids.set(n.id, r.nodeIds[i]!);
        });
      }
      const idOf = (id: string) => ids.get(id) ?? id;
      for (const n of nodes) {
        const v = n.currentVersionId ? st.versions.get(n.currentVersionId) : undefined;
        if (v && !reads.has(n.id)) localOnly.set(idOf(n.id), v);
      }
      const snap = await api.board(boardId);
      const stale = st.stale;
      quietly(() => loadSnapshot(snap));
      // Out-of-date file results stay out of date on the copy.
      quietly(() => useBoard.setState((s) => ({ stale: new Set([...s.stale, ...[...stale].map(idOf)]) })));
      // Node ids changed with the copy: follow them.
      const ui = useUi.getState();
      useUi.setState({
        selected: new Set([...ui.selected].map(idOf)),
        editingNodeId: ui.editingNodeId && idOf(ui.editingNodeId),
        simulatingNodeId: ui.simulatingNodeId && idOf(ui.simulatingNodeId),
      });
      return { ok: true, idOf };
    } catch (e) {
      toast(e instanceof Error ? e.message : t('run.couldNotPrepare'), 'error');
      return { ok: false, signin: false };
    } finally {
      patch({ busy: null });
      attaching = null;
    }
  })();
  return attaching;
}

/** Sends the file results `need` reads that the working copy does not have yet. */
async function sendLocalResults(need: Need): Promise<boolean> {
  const st = useBoard.getState();
  const missing = new Set([...readsOf(st.graph, need)].filter((id) => localOnly.has(id)));
  if (!missing.size || !st.boardId) return true;
  patch({ busy: t('run.preparing') });
  try {
    const payload = await buildPayload(docRef(), { results: missing, nodes: missing });
    const r = await uploadBoardFile(st.boardId, await host!.pack(payload), { x: 0, y: 0 }, 'existing');
    // The same results, now also on the server: the file does not change.
    quietly(() => {
      upsertVersions(r.versions);
      applyRemote(r.ops, r.seq);
    });
    for (const id of missing) localOnly.delete(id);
    return true;
  } catch (e) {
    toast(e instanceof Error ? e.message : t('run.couldNotPrepare'), 'error');
    return false;
  } finally {
    patch({ busy: null });
  }
}

type Reason = 'run' | 'share' | 'save';

/**
 * Actions that need the board on the server. Cloud boards go ahead; guests are asked to sign in;
 * a board file gets (or completes) its working copy with what `need` reads, then goes ahead.
 */
export function withCloud(reason: Reason, need: Need, action: (nodeId?: string) => void) {
  const nodeId = 'nodeId' in need ? (need.nodeId ?? undefined) : undefined;
  const { mode } = useBoard.getState();
  if (mode === 'remote') {
    if (!localOnly.size) return action(nodeId);
    void sendLocalResults(need).then((ok) => ok && action(nodeId));
    return;
  }
  if (mode === 'guest') return useUi.setState({ signInPrompt: { reason, nodeId } });
  if (mode !== 'file') return;
  void attachWorkingCopy(need).then(async (r) => {
    if (r.ok) action(nodeId && r.idOf(nodeId));
    else if (r.signin) {
      await stashDocument();
      useUi.setState({ signInPrompt: { reason, nodeId } });
    }
  });
}

/**
 * ⌘O: desktop opens the file in its own window, Chrome/Edge in this tab; other browsers
 * import it into this board.
 */
export function openBoardFile() {
  if (docs) return docs.open();
  if (webFiles) return void import('./webDoc').then((w) => w.openFileInTab());
  openBoardFilePicker();
}

/** This window or tab shows a board file (changes when a website tab opens one). */
export const isDoc = () => host !== null;

/** This node's result is only in the file so far (not on the working copy). */
export const hasFileResult = (nodeId: string | null) => !!nodeId && localOnly.has(nodeId);

/** Chrome/Edge: after a reload the browser may ask again before the file can be read. */
export async function grantAndLoad() {
  if (!webFileKey) return;
  const w = await import('./webDoc');
  if (await w.requestAccess(webFileKey)) await loadDocument();
}
