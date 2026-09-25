import { z } from 'zod';
import { AssetKind } from './api';
import { VARIANTS } from './engine';
import { NodeKindSchema } from './nodes';

/**
 * `.annie3d` board file: a ZIP (like `.sketch`, `.docx`, `.3mf`) holding `annie3d.json` (this
 * manifest, deflated) and `assets/<sha256>.<ext>` (the current result of every node with its
 * poster/thumbnail/turntable variants, stored as they are: media are already compressed, and
 * stored entries can be read by range, see zip.ts). Each file is stored once, by content.
 *
 * Version 2 adds `stale`, `sha256` and `bundle`: an Export node's ZIP holds copies of files the
 * board already has, so the file keeps only its member list and the ZIP is rebuilt when needed.
 * Readers accept versions 1 and 2.
 */
export const BOARD_FILE_EXT = '.annie3d';
export const BOARD_FILE_MIME = 'application/vnd.annie3d+zip';
export const BOARD_FILE_MANIFEST = 'annie3d.json';

const id = z.string().uuid();
const coord = z.number().finite().min(-1e7).max(1e7);
const path = z.string().regex(/^assets\/[A-Za-z0-9._-]{1,120}$/);
const dims = {
  width: z.number().int().positive().max(20000).nullable().optional(),
  height: z.number().int().positive().max(20000).nullable().optional(),
};

export const BoardFileOutput = z.object({
  /** Where the bytes are; for a `bundle`, the name it had (the bytes are rebuilt, not stored). */
  path,
  /** SHA-256 of the original bytes (version 2). */
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  /** A stored ZIP made only of other files in this board file: its members, in order. */
  bundle: z
    .array(z.object({ name: z.string().min(1).max(200), path }))
    .min(1)
    .max(64)
    .optional(),
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
  version: z.union([z.literal(1), z.literal(2)]),
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
        /** Changed since its result was made: the result is kept but out of date. */
        stale: z.boolean().optional(),
      }),
    )
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
