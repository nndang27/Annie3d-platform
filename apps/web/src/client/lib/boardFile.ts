import {
  type AssetDto,
  BOARD_FILE_EXT,
  BOARD_FILE_MANIFEST,
  BOARD_FILE_MAX_BYTES,
  BOARD_FILE_MIME,
  type BoardFileManifest,
  type BoardFileOutput,
  extForMime,
  FILE_REF_SETTINGS,
  type GraphOp,
  BoardFileManifest as ManifestSchema,
  NODE_DEFS,
  type NodeVersionDto,
  newId,
  VARIANTS,
} from '@annie3d/contracts';
import { strFromU8, strToU8, unzipSync, type Zippable, zipSync } from 'fflate';
import { ApiError } from '../api/client';
import { insertPayload } from '../canvas/clipboard';
import { applyRemote, upsertVersions, useBoard } from '../store/board';
import { saveGuestFile } from '../store/persist';
import { toast, useUi } from '../store/ui';
import { timed } from './perf';

type Variant = (typeof VARIANTS)[number];
const URL_VARIANT: Record<'poster' | 'thumb' | 'turntable', Variant> = {
  poster: 'poster_512',
  thumb: 'thumb_256',
  turntable: 'turntable_mp4',
};

/** Which stored variant a preview URL is (from `?variant=` or a fixture file name). */
function variantOf(key: keyof typeof URL_VARIANT, url: string): Variant {
  const q = new URL(url, location.href).searchParams.get('variant');
  if (q && (VARIANTS as readonly string[]).includes(q)) return q as Variant;
  if (key === 'poster' && url.includes('1024')) return 'poster_1024';
  return URL_VARIANT[key];
}

async function bytes(url: string): Promise<{ data: Uint8Array; mime: string }> {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`Could not read ${url} (${r.status})`);
  return {
    data: new Uint8Array(await r.arrayBuffer()),
    mime: (r.headers.get('content-type') ?? 'application/octet-stream').split(';')[0]!,
  };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '') || 'board';

/** Download the whole canvas as `<title>.annie3d` (nodes, wires, prompts and current results). */
export async function exportBoardFile() {
  const { graph, versions, title } = useBoard.getState();
  if (!graph.nodes.size) return toast('The board is empty');
  await timed('file.export', async () => {
    const zip: Zippable = {};
    const outputs: BoardFileManifest['outputs'] = [];
    const seen = new Map<string, { path: string; mime: string }>();
    const put = async (url: string, tag: string) => {
      const hit = seen.get(url);
      if (hit) return hit;
      const { data, mime } = await bytes(url);
      const file = { path: `assets/${tag}.${extForMime(mime)}`, mime };
      zip[file.path] = [data, { level: 0 }]; // media is already compressed
      seen.set(url, file);
      return file;
    };
    for (const n of graph.nodes.values()) {
      const v = n.currentVersionId ? versions.get(n.currentVersionId) : undefined;
      if (!v?.outputs.length) continue;
      const files: BoardFileOutput[] = [];
      for (const [i, o] of v.outputs.entries()) {
        if (!o.urls.original) continue;
        const main = await put(o.urls.original, `${o.sha256 || o.id}`);
        const variants: BoardFileOutput['variants'] = [];
        for (const key of ['poster', 'thumb', 'turntable'] as const) {
          const u = o.urls[key];
          if (!u || u === o.urls.original) continue;
          const f = await put(u, `${o.sha256 || o.id}-${key}`);
          variants.push({ variant: variantOf(key, u), path: f.path, mime: f.mime });
        }
        files.push({
          path: main.path,
          kind: o.kind,
          mime: o.mime,
          role: n.kind === 'packshot' ? 'packshot' : i === 0 ? 'primary' : 'extra',
          width: o.width,
          height: o.height,
          durationMs: o.durationMs,
          triangleCount: o.triangleCount,
          variants,
        });
      }
      if (files.length) outputs.push({ nodeId: n.id, files });
    }
    const manifest: BoardFileManifest = {
      format: 'annie3d',
      version: 1,
      exportedAt: new Date().toISOString(),
      title,
      nodes: [...graph.nodes.values()].map(({ id, kind, x, y, label, settings }) => ({
        id,
        kind,
        x,
        y,
        label,
        settings,
      })),
      edges: [...graph.edges.values()].map(({ id, source, target, targetPort }) => ({
        id,
        source,
        target,
        targetPort,
      })),
      outputs,
    };
    zip[BOARD_FILE_MANIFEST] = strToU8(JSON.stringify(manifest));
    const blob = new Blob([zipSync(zip, { comment: 'Annie 3D board' }) as BlobPart], {
      type: BOARD_FILE_MIME,
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug(title)}${BOARD_FILE_EXT}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  });
}

/**
 * Open a `.annie3d` file into the current board at `at` (flow coordinates). Guests keep the files
 * in this browser; signed-in users send the file to the server, which stores it in the workspace.
 */
export async function importBoardFile(file: File, at: { x: number; y: number }) {
  if (file.size > BOARD_FILE_MAX_BYTES) return toast('Board files up to 80 MB can be opened', 'error');
  try {
    await timed('file.import', () =>
      useBoard.getState().mode === 'remote' ? importRemote(file, at) : importGuest(file, at),
    );
  } catch (e) {
    toast(e instanceof ApiError || e instanceof Error ? e.message : 'Could not open the file', 'error');
  }
}

async function importRemote(file: File, at: { x: number; y: number }) {
  const { boardId } = useBoard.getState();
  const r = await fetch(`/api/boards/${boardId}/import?x=${Math.round(at.x)}&y=${Math.round(at.y)}`, {
    method: 'POST',
    headers: { 'content-type': BOARD_FILE_MIME },
    body: file,
    credentials: 'same-origin',
  });
  const body = (await r.json().catch(() => null)) as
    | { seq: number; ops: GraphOp[]; nodeIds: string[]; versions: NodeVersionDto[] }
    | { error?: { message?: string } }
    | null;
  if (!r.ok || !body || !('ops' in body))
    throw new Error((body as { error?: { message?: string } })?.error?.message ?? 'Could not open the file');
  upsertVersions(body.versions);
  applyRemote(body.ops, body.seq, { undoable: true });
  useUi.setState({ selected: new Set(body.nodeIds) });
  toast(`Opened ${file.name}`);
}

async function importGuest(file: File, at: { x: number; y: number }) {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error('Not an Annie 3D file');
  }
  const raw = files[BOARD_FILE_MANIFEST];
  const parsed = raw ? ManifestSchema.safeParse(JSON.parse(strFromU8(raw))) : null;
  if (!parsed?.success) throw new Error('Not an Annie 3D file (or a newer version)');
  const m = parsed.data;
  const versions: NodeVersionDto[] = [];
  const current = new Map<string, string>();
  for (const g of m.outputs) {
    const outs: AssetDto[] = [];
    for (const f of g.files) {
      const data = files[f.path];
      if (!data) continue;
      const id = newId();
      const blob = new Blob([data as BlobPart], { type: f.mime });
      await saveGuestFile(id, blob);
      const urls: AssetDto['urls'] = {
        original: URL.createObjectURL(blob),
        poster: null,
        thumb: null,
        turntable: null,
      };
      for (const v of f.variants) {
        const vd = files[v.path];
        if (!vd) continue;
        const key = v.variant.startsWith('poster')
          ? 'poster'
          : v.variant === 'thumb_256'
            ? 'thumb'
            : 'turntable';
        const vb = new Blob([vd as BlobPart], { type: v.mime });
        await saveGuestFile(`${id}:${key}`, vb);
        urls[key] = URL.createObjectURL(vb);
      }
      if (f.kind === 'image') {
        urls.poster ??= urls.original;
        urls.thumb ??= urls.original;
      }
      outs.push({
        id,
        kind: f.kind,
        mime: f.mime,
        byteSize: data.byteLength,
        sha256: '',
        width: f.width ?? null,
        height: f.height ?? null,
        durationMs: f.durationMs ?? null,
        triangleCount: f.triangleCount ?? null,
        status: 'ready',
        urls,
        createdAt: new Date().toISOString(),
      });
    }
    if (!outs.length) continue;
    const vid = newId();
    current.set(g.nodeId, vid);
    versions.push({
      id: vid,
      nodeId: g.nodeId,
      versionNo: 1,
      source: 'upload',
      runId: null,
      parentVersionId: null,
      outputAssetId: outs[0]!.id,
      outputs: outs,
      params: {},
      gates: [],
      createdAt: new Date().toISOString(),
    });
  }
  insertPayload(
    {
      mark: 'annie3d/nodes@1',
      mode: useBoard.getState().mode,
      nodes: m.nodes.map((n) => {
        const settings = { ...n.settings };
        for (const k of FILE_REF_SETTINGS) if (k in settings) settings[k] = null;
        const vid = current.get(n.id);
        const input = NODE_DEFS[n.kind].category === 'input';
        const out = vid ? versions.find((v) => v.id === vid)?.outputs[0] : undefined;
        if (input && out) settings.assetId = out.id;
        return { ...n, settings, currentVersionId: vid ?? null };
      }),
      edges: m.edges.map((e) => ({ ...e, sourcePort: 'out' as const })),
      versions,
      stale: [],
    },
    at,
  );
  toast(`Opened ${file.name}`);
}

/** Where opened files land: the centre of the canvas view (set by the canvas). */
let viewCentre: () => { x: number; y: number } = () => ({ x: 0, y: 0 });
export function setViewCentre(fn: () => { x: number; y: number }) {
  viewCentre = fn;
}
export const currentViewCentre = () => viewCentre();

export function openBoardFilePicker() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = `${BOARD_FILE_EXT},${BOARD_FILE_MIME},application/zip`;
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) void importBoardFile(f, viewCentre());
  };
  input.click();
}

export const isBoardFile = (f: File) => f.name.toLowerCase().endsWith(BOARD_FILE_EXT);
