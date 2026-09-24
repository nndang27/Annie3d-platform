import { z } from 'zod';
import type { NodeKind } from './nodes';
import type { PortType } from './ports';

/**
 * ENGINE PLUG POINT.
 *
 * Every runnable node kind is executed by an Engine. Today the Worker registers the
 * deterministic simulator (apps/web/src/worker/engines/simulator.ts). Real agents plug in
 * either in-process (implement `Engine`) or out-of-process through the External Engine
 * Protocol below (HTTP job + signed callbacks), which is how GPU/Blender/CAD agents connect.
 */

export interface ResolvedInput {
  port: string;
  type: PortType;
  /** Asset inputs carry a short-lived signed URL; text inputs carry the text. */
  assetId?: string;
  url?: string;
  mime?: string;
  text?: string;
  /** The upstream node version this input came from (for lineage). */
  versionId?: string;
  /** Asset metadata (dimensions, triangle count, engine-specific notes). */
  meta?: Record<string, unknown>;
}

export interface EngineOutput {
  /** R2 object key already written by the engine (via `putArtifact` or a presigned URL). */
  storageKey: string;
  mime: string;
  byteSize: number;
  sha256: string;
  kind: 'image' | 'model3d' | 'video' | 'audio' | 'text' | 'file';
  role: 'primary' | 'poster' | 'turntable' | 'packshot' | 'report' | 'extra';
  meta?: Record<string, unknown>;
  width?: number;
  height?: number;
  durationMs?: number;
  triangleCount?: number;
  /** Derived files of this output (posters, thumbnails, turntable clip) stored as asset variants. */
  variants?: EngineVariant[];
}

export const VARIANTS = ['thumb_256', 'poster_512', 'poster_1024', 'turntable_mp4'] as const;
export interface EngineVariant {
  variant: (typeof VARIANTS)[number];
  storageKey: string;
  mime: string;
  byteSize: number;
  width?: number;
  height?: number;
}

export interface EngineContext {
  runId: string;
  stepId: string;
  nodeId: string;
  kind: NodeKind;
  settings: Record<string, unknown>;
  inputs: ResolvedInput[];
  /** Region-edit runs (F8): selected faces and the instruction. */
  edit?: { baseVersionId: string; faces: number[]; instruction: string };
  progress(p: number, stage: string, previewAssetId?: string): Promise<void>;
  putArtifact(
    data: ArrayBuffer | ReadableStream,
    meta: Omit<EngineOutput, 'storageKey' | 'byteSize' | 'sha256'> & { ext: string },
  ): Promise<EngineOutput>;
  /** Reads an input's bytes (in-process engines; external engines get presigned URLs). */
  readInput(input: ResolvedInput): Promise<ArrayBuffer>;
  /** Stores a derived file (poster, thumbnail, clip) and returns where it went. */
  putFile(
    data: ArrayBuffer,
    meta: { ext: string; mime: string },
  ): Promise<{ storageKey: string; byteSize: number }>;
  signal: AbortSignal;
}

export interface EngineResult {
  outputs: EngineOutput[];
  /** Quality gates evaluated by the engine (docs/MVP_VERTICAL_WORKFLOWS.md §7). */
  gates: { id: string; passed: boolean; value?: number; threshold?: number }[];
  meta?: Record<string, unknown>;
}

export interface Engine {
  kind: NodeKind;
  /** Bumping the version invalidates cached results for this kind. */
  version: string;
  run(ctx: EngineContext): Promise<EngineResult>;
}

// ------------------------------- External Engine Protocol v1 -------------------------------

/** POST {engineBaseUrl}/v1/jobs — sent by Annie 3D to an external engine. */
export const ExternalJobRequest = z.object({
  protocol: z.literal('annie3d.engine/v1'),
  jobId: z.string().uuid(),
  runId: z.string().uuid(),
  nodeId: z.string().uuid(),
  kind: z.string(),
  settings: z.record(z.string(), z.unknown()),
  inputs: z.array(
    z.object({
      port: z.string(),
      type: z.string(),
      assetId: z.string().optional(),
      url: z.string().url().optional(),
      mime: z.string().optional(),
      text: z.string().optional(),
      versionId: z.string().optional(),
    }),
  ),
  edit: z
    .object({ baseVersionId: z.string().uuid(), faces: z.array(z.number().int()), instruction: z.string() })
    .optional(),
  /** Presigned PUT URLs the engine uploads outputs to (one per expected output slot). */
  uploads: z.array(
    z.object({
      slot: z.string(),
      url: z.string().url(),
      storageKey: z.string(),
      expiresAt: z.string().datetime(),
    }),
  ),
  /** Where the engine posts progress and results. Requests must carry an HMAC signature. */
  callbackUrl: z.string().url(),
  deadline: z.string().datetime(),
});
export type ExternalJobRequest = z.infer<typeof ExternalJobRequest>;

/**
 * POST {callbackUrl} — sent by the engine. Header `x-annie3d-signature: t=<unix>,v1=<hex>`
 * where v1 = HMAC-SHA256(secret, `${t}.${rawBody}`) (Stripe-style scheme; 5-minute tolerance).
 */
export const ExternalJobCallback = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('progress'),
    jobId: z.string().uuid(),
    progress: z.number().min(0).max(1),
    stage: z.string().max(80),
  }),
  z.object({
    type: z.literal('succeeded'),
    jobId: z.string().uuid(),
    outputs: z.array(
      z.object({
        slot: z.string(),
        storageKey: z.string(),
        mime: z.string(),
        byteSize: z.number().int().positive(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        kind: z.enum(['image', 'model3d', 'video', 'audio', 'text', 'file']),
        role: z.enum(['primary', 'poster', 'turntable', 'packshot', 'report', 'extra']),
        meta: z.record(z.string(), z.unknown()).optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        durationMs: z.number().int().positive().optional(),
        triangleCount: z.number().int().nonnegative().optional(),
        variants: z
          .array(
            z.object({
              variant: z.enum(VARIANTS),
              storageKey: z.string(),
              mime: z.string(),
              byteSize: z.number().int().positive(),
              width: z.number().int().positive().optional(),
              height: z.number().int().positive().optional(),
            }),
          )
          .optional(),
      }),
    ),
    gates: z.array(
      z.object({
        id: z.string(),
        passed: z.boolean(),
        value: z.number().optional(),
        threshold: z.number().optional(),
      }),
    ),
  }),
  z.object({
    type: z.literal('failed'),
    jobId: z.string().uuid(),
    code: z.enum(['gate_failed', 'engine_error', 'timeout', 'input_missing']),
    gate: z.string().nullable(),
    message: z.string().max(500),
  }),
]);
export type ExternalJobCallback = z.infer<typeof ExternalJobCallback>;
