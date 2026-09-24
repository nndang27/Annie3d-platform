import {
  type AssetDto,
  defaultSettings,
  type GraphOp,
  generateKeyBetween,
  NODE_DEFS,
  type NodeKind,
  type NodeRecord,
  type NodeVersionDto,
  newId,
  nextZKey,
  type StarterId,
  starterGraph,
} from '@annie3d/contracts';
import { api } from '../api/client';
import { dispatch, upsertVersions, useBoard } from '../store/board';
import { loadGuestFileUrl, saveGuestFile } from '../store/persist';
import { toast, useUi } from '../store/ui';

const KIND_BY_NODE = { photo: 'image', upload3d: 'model3d', audio: 'audio' } as const;

async function sha256(file: Blob): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function guessMime(f: File): string {
  if (f.type) return f.type;
  if (f.name.toLowerCase().endsWith('.glb')) return 'model/gltf-binary';
  return 'application/octet-stream';
}

/** Presigned upload straight to R2 (single PUT or multipart), then server-side verification. */
export async function uploadAsset(file: File, kind: AssetDto['kind']): Promise<AssetDto> {
  const up = await api.createUpload({
    kind,
    filename: file.name,
    mime: guessMime(file),
    byteSize: file.size,
    sha256: await sha256(file),
  });
  if (up.mode === 'existing') return up.asset;
  if (up.mode === 'single') {
    const put = await fetch(up.url, { method: 'PUT', headers: up.headers, body: file });
    if (!put.ok) throw new Error(`Upload failed (${put.status})`);
    return api.completeUpload(up.assetId);
  }
  const parts: { partNumber: number; etag: string }[] = [];
  for (const p of up.parts) {
    const chunk = file.slice((p.partNumber - 1) * up.partSize, p.partNumber * up.partSize);
    const r = await fetch(p.url, { method: 'PUT', body: chunk });
    if (!r.ok) throw new Error(`Part ${p.partNumber} failed`);
    parts.push({ partNumber: p.partNumber, etag: r.headers.get('etag') ?? '' });
  }
  return api.completeUpload(up.assetId, parts);
}

/** Upload straight to R2 (presigned), then attach it to the node as a new "upload" version. */
export async function uploadIntoNode(node: NodeRecord, file: File) {
  const kind = KIND_BY_NODE[node.kind as keyof typeof KIND_BY_NODE];
  if (!kind) return;
  const { mode } = useBoard.getState();
  if (mode === 'guest') return attachGuestFile(node, file, kind);
  try {
    attachAsset(node, await uploadAsset(file, kind));
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}

function attachAsset(node: NodeRecord, asset: AssetDto) {
  const versionId = newId();
  const prev = node.currentVersionId ? useBoard.getState().versions.get(node.currentVersionId) : undefined;
  const version: NodeVersionDto = {
    id: versionId,
    nodeId: node.id,
    versionNo: (prev?.versionNo ?? 0) + 1,
    source: 'upload',
    runId: null,
    parentVersionId: prev?.id ?? null,
    outputAssetId: asset.id,
    outputs: [asset],
    params: {},
    gates: [],
    createdAt: new Date().toISOString(),
  };
  upsertVersions([version]);
  // The server creates the matching node_versions row for this id (applyBatch, upload versions).
  dispatch([
    {
      type: 'node.update',
      id: node.id,
      patch: { settings: { assetId: asset.id }, currentVersionId: versionId },
    },
  ]);
}

/** Guests keep files in the browser until they sign in; the board is imported with them later. */
async function attachGuestFile(node: NodeRecord, file: File, kind: AssetDto['kind']) {
  const url = URL.createObjectURL(file);
  const id = newId();
  await saveGuestFile(id, file);
  const asset: AssetDto = {
    id,
    kind,
    mime: guessMime(file),
    byteSize: file.size,
    sha256: await sha256(file),
    width: null,
    height: null,
    durationMs: null,
    triangleCount: null,
    status: 'ready',
    urls: {
      original: url,
      poster: kind === 'image' ? url : null,
      thumb: kind === 'image' ? url : null,
      turntable: null,
    },
    createdAt: new Date().toISOString(),
  };
  attachAsset(node, asset);
}

export function onRunNode(nodeId: string) {
  const { mode } = useBoard.getState();
  if (mode === 'guest') {
    useUi.setState({ signInPrompt: { reason: 'run', nodeId } });
    return;
  }
  // Runs this node and whatever upstream is stale or missing (cached nodes are free).
  useUi.setState({ dialog: { type: 'run', nodeId, scope: 'with_upstream' } });
}

export function openEditor(nodeId: string) {
  useUi.setState({ editingNodeId: nodeId });
  const u = new URL(location.href);
  u.searchParams.set('edit', nodeId);
  history.pushState(null, '', u);
}

// ------------------------------------------------------------------ graph helpers
/** Adds a node at a flow position; when dragged from a wire, connects it to the first compatible port. */
export function createNodeAt(
  kind: NodeKind,
  x: number,
  y: number,
  fromNodeId?: string,
  settings?: Record<string, unknown>,
): string | null {
  const g = useBoard.getState().graph;
  const id = newId();
  const ops: GraphOp[] = [
    {
      type: 'node.create',
      node: {
        id,
        kind,
        x: Math.round(x),
        y: Math.round(y),
        label: null,
        settings: { ...defaultSettings(kind), ...settings },
        zKey: nextZKey(g),
      },
    },
  ];
  if (fromNodeId) {
    const port = NODE_DEFS[kind].inputs.find((p) => {
      const src = g.nodes.get(fromNodeId);
      const out = src ? NODE_DEFS[src.kind].output?.type : undefined;
      return !!out && (p.accepts as readonly string[]).includes(out);
    });
    if (port)
      ops.push({
        type: 'edge.create',
        edge: { id: newId(), source: fromNodeId, sourcePort: 'out', target: id, targetPort: port.id },
      });
  }
  if (!dispatch(ops)) return null;
  useUi.setState({ selected: new Set([id]), palette: null, contextMenu: null });
  return id;
}

/** Drops a Starter line (ordinary pre-wired nodes) with its top-left at `origin`. */
export function insertStarter(id: StarterId, origin: { x: number; y: number }) {
  const g = useBoard.getState().graph;
  const s = starterGraph(id, origin);
  let z = nextZKey(g);
  const ops: GraphOp[] = [];
  for (const n of s.nodes) {
    ops.push({
      type: 'node.create',
      node: { id: n.id, kind: n.kind, x: n.x, y: n.y, label: n.label, settings: n.settings, zKey: z },
    });
    z = generateKeyBetween(z, null);
  }
  for (const e of s.edges) ops.push({ type: 'edge.create', edge: e });
  dispatch(ops);
  useUi.setState({ selected: new Set(s.nodes.map((n) => n.id)) });
  return s.nodes.map((n) => n.id);
}

export function deleteNodes(ids: string[]) {
  if (ids.length) dispatch([{ type: 'node.delete', ids }]);
  useUi.setState({ selected: new Set() });
}

/**
 * After a guest signs in, files they dropped into input nodes are uploaded to R2 and attached
 * to the imported nodes (same ids), so the "upload → Run → sign in" path loses nothing.
 */
export async function importGuestUploads(versions: NodeVersionDto[]) {
  const g = useBoard.getState().graph;
  for (const v of versions) {
    if (v.source !== 'upload') continue;
    const node = g.nodes.get(v.nodeId);
    const out = v.outputs[0];
    if (!node || !out) continue;
    const url = await loadGuestFileUrl(out.id);
    if (!url) continue;
    const blob = await (await fetch(url)).blob();
    URL.revokeObjectURL(url);
    await uploadIntoNode(node, new File([blob], `${node.kind}-${out.id.slice(0, 8)}`, { type: out.mime }));
  }
}
