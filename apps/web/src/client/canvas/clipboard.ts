import {
  type EdgeRecord,
  type GraphOp,
  generateKeyBetween,
  type NodeRecord,
  type NodeVersionDto,
  newId,
  nextZKey,
} from '@annie3d/contracts';
import { timed } from '../lib/perf';
import { dispatch, setStale, upsertVersions, useBoard } from '../store/board';
import { toast, useUi } from '../store/ui';
import { createNodeAt, uploadIntoNode } from './actions';

/**
 * Copy / cut / paste / duplicate (Figma, Miro, tldraw conventions).
 * - A copy carries each node's settings (prompt included), the wires between copied nodes and the
 *   current version with its outputs, so a pasted node shows its result without re-running.
 * - The payload also goes to the system clipboard as text, so paste works in another tab or board.
 * - Pasting an image file from outside creates a Photo node; plain text creates a Text node.
 */
const MARK = 'annie3d/nodes@1';

interface Payload {
  mark: typeof MARK;
  /** Guest and signed-in boards keep versions in different places; copies stay within one. */
  mode: string;
  nodes: Pick<NodeRecord, 'id' | 'kind' | 'x' | 'y' | 'label' | 'settings' | 'currentVersionId'>[];
  edges: EdgeRecord[];
  versions: NodeVersionDto[];
  stale: string[];
}

let memory: Payload | null = null;
/** Consecutive pastes of the same payload cascade instead of stacking (Figma). */
let pasteCount = 0;

function payloadOf(ids: Iterable<string>): Payload | null {
  const { graph, versions, stale, mode } = useBoard.getState();
  const set = new Set(ids);
  const nodes = [...set].map((id) => graph.nodes.get(id)).filter((n): n is NodeRecord => !!n);
  if (!nodes.length) return null;
  return {
    mark: MARK,
    mode,
    nodes: nodes.map(({ id, kind, x, y, label, settings, currentVersionId }) => ({
      id,
      kind,
      x,
      y,
      label,
      settings,
      currentVersionId,
    })),
    edges: [...graph.edges.values()].filter((e) => set.has(e.source) && set.has(e.target)),
    versions: nodes
      .map((n) => (n.currentVersionId ? versions.get(n.currentVersionId) : undefined))
      .filter((v): v is NodeVersionDto => !!v),
    stale: nodes.filter((n) => stale.has(n.id)).map((n) => n.id),
  };
}

function parse(text: string): Payload | null {
  if (!text.includes(MARK)) return null;
  try {
    const p = JSON.parse(text) as Payload;
    return p.mark === MARK && Array.isArray(p.nodes) ? p : null;
  } catch {
    return null;
  }
}

/** Inserts a payload with its top-left at `at` (flow coordinates). Returns the new node ids. */
function insert(p: Payload, at: { x: number; y: number }): string[] {
  const { graph, mode } = useBoard.getState();
  const minX = Math.min(...p.nodes.map((n) => n.x));
  const minY = Math.min(...p.nodes.map((n) => n.y));
  const withVersions = p.mode === mode;
  const versions = new Map(p.versions.map((v) => [v.id, v]));
  const ids = new Map<string, string>();
  const creates: GraphOp[] = [];
  const updates: GraphOp[] = [];
  const localVersions: NodeVersionDto[] = [];
  let z = nextZKey(graph);
  for (const n of p.nodes) {
    const id = newId();
    ids.set(n.id, id);
    creates.push({
      type: 'node.create',
      node: {
        id,
        kind: n.kind,
        x: Math.round(at.x + n.x - minX),
        y: Math.round(at.y + n.y - minY),
        label: n.label,
        settings: n.settings,
        zKey: z,
      },
    });
    z = generateKeyBetween(z, null);
    const src = withVersions && n.currentVersionId ? versions.get(n.currentVersionId) : undefined;
    if (src) {
      const vid = newId();
      localVersions.push({
        ...src,
        id: vid,
        nodeId: id,
        versionNo: 1,
        source: 'copy',
        runId: null,
        parentVersionId: null,
        createdAt: new Date().toISOString(),
      });
      updates.push({
        type: 'node.update',
        id,
        patch: { currentVersionId: vid, copyOfVersionId: src.id },
      });
    }
  }
  const edges: GraphOp[] = p.edges.map((e) => ({
    type: 'edge.create',
    edge: { ...e, id: newId(), source: ids.get(e.source)!, target: ids.get(e.target)! },
  }));
  if (localVersions.length) upsertVersions(localVersions);
  if (!dispatch([...creates, ...edges, ...updates])) return [];
  // Copies mirror their originals: only nodes that were stale stay stale.
  const wasStale = new Set(p.stale.map((id) => ids.get(id)));
  const fresh = [...ids.values()].filter((id) => !wasStale.has(id));
  setStale((prev) => {
    const next = new Set(prev);
    for (const id of fresh) next.delete(id);
    return next;
  });
  const created = [...ids.values()];
  useUi.setState({ selected: new Set(created), contextMenu: null, palette: null });
  return created;
}

export function copySelection(clipboard?: DataTransfer | null): boolean {
  const p = payloadOf(useUi.getState().selected);
  if (!p) return false;
  memory = p;
  pasteCount = 0;
  const text = JSON.stringify(p);
  if (clipboard) clipboard.setData('text/plain', text);
  else void navigator.clipboard?.writeText(text).catch(() => {});
  return true;
}

export const hasCopy = () => memory !== null;

export function duplicateNodes(ids: string[]) {
  const p = payloadOf(ids);
  if (!p) return;
  timed('clipboard.paste', () =>
    insert(p, { x: Math.min(...p.nodes.map((n) => n.x)) + 40, y: Math.min(...p.nodes.map((n) => n.y)) + 40 }),
  );
}

/** Where a paste lands: the last pointer position over the canvas, else the viewport centre. */
export type FlowPoint = () => { x: number; y: number };

export function pasteNodes(p: Payload | null, at: FlowPoint, fromPointer: boolean) {
  const payload = p ?? memory;
  if (!payload) return false;
  pasteCount += 1;
  const cascade = fromPointer ? 0 : pasteCount * 40;
  const base = fromPointer
    ? at()
    : {
        x: Math.min(...payload.nodes.map((n) => n.x)) + cascade,
        y: Math.min(...payload.nodes.map((n) => n.y)) + cascade,
      };
  return timed('clipboard.paste', () => insert(payload, base)).length > 0;
}

/** Handles a native paste event on the canvas. Returns true when it consumed the event. */
export function handlePaste(e: ClipboardEvent, at: FlowPoint, pointerOnCanvas: boolean): boolean {
  const data = e.clipboardData;
  if (!data) return false;
  const files = [...data.files].filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type));
  if (files.length) {
    e.preventDefault();
    const p = at();
    files.forEach((f, i) => void imageToNode(f, { x: p.x + i * 40, y: p.y + i * 40 }));
    return true;
  }
  const text = data.getData('text/plain');
  const payload = parse(text);
  if (payload) {
    e.preventDefault();
    if (payload !== memory && JSON.stringify(memory) !== text) {
      memory = payload;
      pasteCount = 0;
    }
    pasteNodes(payload, at, pointerOnCanvas);
    return true;
  }
  if (text.trim()) {
    e.preventDefault();
    const p = at();
    createNodeAt('text', p.x, p.y, undefined, { text: text.slice(0, 4000) });
    return true;
  }
  return false;
}

/** An image file (pasted or dropped from outside) becomes a Photo node holding it. */
export async function imageToNode(file: File, at: { x: number; y: number }) {
  if (file.size > 25 * 1024 * 1024) {
    toast('Images up to 25 MB can be added', 'error');
    return;
  }
  const id = createNodeAt('photo', at.x, at.y);
  const node = id ? useBoard.getState().graph.nodes.get(id) : undefined;
  if (node) await timed('image.add', () => uploadIntoNode(node, file));
}
