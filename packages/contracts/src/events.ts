import { z } from 'zod';

/**
 * Run events. Every event carries a per-run, gap-free sequence number so a client that
 * reconnects asks for "after = last seen seq" and receives exactly what it missed
 * (Linear sync engine: monotonically increasing sync ids; Figma: reconnect = fresh state +
 * replay). Transient progress is not persisted beyond the run room's replay buffer.
 */
const base = { runId: z.string().uuid(), seq: z.number().int().positive(), at: z.string().datetime() };

export const RunEvent = z.discriminatedUnion('type', [
  z.object({
    ...base,
    type: z.literal('run.queued'),
    plan: z.array(z.string().uuid()),
    estimatedCredits: z.number().int().nonnegative(),
  }),
  z.object({ ...base, type: z.literal('run.started') }),
  z.object({ ...base, type: z.literal('step.started'), nodeId: z.string().uuid() }),
  z.object({
    ...base,
    type: z.literal('step.progress'),
    nodeId: z.string().uuid(),
    progress: z.number().min(0).max(1),
    stage: z.string().max(80),
    previewAssetId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    ...base,
    type: z.literal('step.succeeded'),
    nodeId: z.string().uuid(),
    versionId: z.string().uuid(),
    cached: z.boolean(),
    credits: z.number().int().nonnegative(),
  }),
  z.object({
    ...base,
    type: z.literal('step.failed'),
    nodeId: z.string().uuid(),
    code: z.enum(['gate_failed', 'engine_error', 'timeout', 'input_missing', 'cancelled']),
    gate: z.string().max(80).nullable(),
    message: z.string().max(500),
    refundedCredits: z.number().int().nonnegative(),
  }),
  z.object({
    ...base,
    type: z.literal('step.skipped'),
    nodeId: z.string().uuid(),
    reason: z.enum(['upstream_failed', 'cancelled']),
  }),
  z.object({
    ...base,
    type: z.literal('run.finished'),
    status: z.enum(['succeeded', 'failed', 'cancelled', 'partial']),
    chargedCredits: z.number().int().nonnegative(),
  }),
]);
export type RunEvent = z.infer<typeof RunEvent>;
export type RunEventType = RunEvent['type'];

export const RUN_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'cancelled', 'partial'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
export const STEP_STATUSES = ['pending', 'running', 'succeeded', 'failed', 'skipped', 'cached'] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];
