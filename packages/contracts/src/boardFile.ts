import { z } from 'zod';
import { AssetKind } from './api';
import { VARIANTS } from './engine';
import { NodeKindSchema } from './nodes';

/**
 * `.annie3d` board file (like draw.io's `.drawio`): a ZIP holding `annie3d.json` (this manifest)
 * and `assets/…` (the current result of every node, with its poster/thumbnail/turntable
 * variants). It opens only in Annie 3D: the manifest format and version are checked on import,
 * node ids are replaced, and files are re-stored in the importing workspace.
 */
export const BOARD_FILE_EXT = '.annie3d';
export const BOARD_FILE_MIME = 'application/vnd.annie3d+zip';
export const BOARD_FILE_MANIFEST = 'annie3d.json';
/** Import limit (request body, and what the browser unzips). */
export const BOARD_FILE_MAX_BYTES = 80 * 1024 * 1024;

const id = z.string().uuid();
const coord = z.number().finite().min(-1e7).max(1e7);
const path = z.string().regex(/^assets\/[A-Za-z0-9._-]{1,120}$/);
const dims = {
  width: z.number().int().positive().max(20000).nullable().optional(),
  height: z.number().int().positive().max(20000).nullable().optional(),
};

export const BoardFileOutput = z.object({
  path,
  kind: AssetKind,
  mime: z.string().max(100),
  role: z.enum(['primary', 'poster', 'turntable', 'packshot', 'report', 'extra']),
  ...dims,
  durationMs: z.number().int().nonnegative().nullable().optional(),
  triangleCount: z.number().int().nonnegative().nullable().optional(),
  variants: z.array(z.object({ variant: z.enum(VARIANTS), path, mime: z.string().max(100), ...dims })).max(4),
});
export type BoardFileOutput = z.infer<typeof BoardFileOutput>;

export const BoardFileManifest = z.object({
  format: z.literal('annie3d'),
  version: z.literal(1),
  exportedAt: z.string().max(40),
  title: z.string().max(200),
  nodes: z
    .array(
      z.object({
        id,
        kind: NodeKindSchema,
        x: coord,
        y: coord,
        label: z.string().max(120).nullable(),
        settings: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1)
    .max(500),
  edges: z.array(z.object({ id, source: id, target: id, targetPort: z.string().min(1).max(32) })).max(2000),
  outputs: z.array(z.object({ nodeId: id, files: z.array(BoardFileOutput).min(1).max(16) })).max(500),
});
export type BoardFileManifest = z.infer<typeof BoardFileManifest>;

/** Settings that point at files of the exporting workspace; cleared on import. */
export const FILE_REF_SETTINGS = ['assetId'] as const;

export function extForMime(mime: string): string {
  const m: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'model/gltf-binary': 'glb',
    'video/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'application/zip': 'zip',
    'application/json': 'json',
  };
  return m[mime] ?? 'bin';
}
