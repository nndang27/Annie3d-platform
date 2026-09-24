import {
  type EngineContext,
  type EngineOutput,
  type Graph,
  NODE_DEFS,
  newId,
  type ResolvedInput,
  type RunEvent,
} from '@annie3d/contracts';
import {
  assets,
  assetVariants,
  type Db,
  nodeVersionOutputs,
  nodeVersions,
  resultCache,
  runSteps,
  runs,
  settle,
} from '@annie3d/db';
import { and, asc, eq, sql } from 'drizzle-orm';
import { editEngineFor, engineFor } from '../engines/registry';
import { GateFailure } from '../engines/simulator';
import type { Env } from '../env';
import { bucketOf } from './assets';
import { applyBatch, computeInputHashes, loadGraph, versionDtos } from './boards';

/** Events without the envelope; the run room assigns `seq` and `at`. */
export type RunEventBody = RunEvent extends infer E
  ? E extends RunEvent
    ? Omit<E, 'seq' | 'at' | 'runId'>
    : never
  : never;

export interface Emitter {
  emit(e: RunEventBody): Promise<void>;
}

type RunRow = typeof runs.$inferSelect;
type StepRow = typeof runSteps.$inferSelect;

const DONE = new Set(['succeeded', 'cached', 'failed', 'skipped']);
const PROGRESS_EVERY_MS = 250;

async function hex(buf: ArrayBuffer) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Executes one run step by step. Idempotent: finished steps are skipped, so the run room can
 * call it again after an eviction (alarm retry) and it resumes where it stopped.
 */
export async function executeRun(env: Env, db: Db, runId: string, out: Emitter, signal: AbortSignal) {
  const run = await db.query.runs.findFirst({ where: (t, { eq }) => eq(t.id, runId) });
  if (!run || ['succeeded', 'failed', 'cancelled', 'partial'].includes(run.status)) return;
  if (run.status === 'queued') {
    await db.update(runs).set({ status: 'running', startedAt: new Date() }).where(eq(runs.id, runId));
    await out.emit({ type: 'run.started' });
  }
  const steps = await db.select().from(runSteps).where(eq(runSteps.runId, runId)).orderBy(asc(runSteps.seq));
  const failed = new Set<string>();
  for (const s of steps)
    if (s.nodeId && (s.status === 'failed' || s.status === 'skipped')) failed.add(s.nodeId);

  for (const step of steps) {
    if (DONE.has(step.status) || !step.nodeId) continue;
    if (signal.aborted) break;
    const { graph } = await loadGraph(db, run.boardId);
    const node = graph.nodes.get(step.nodeId);
    const upstreamFailed = [...graph.edges.values()].some(
      (e) => e.target === step.nodeId && failed.has(e.source),
    );
    if (!node || upstreamFailed) {
      await finishStep(db, step, 'skipped', { errorCode: node ? 'upstream_failed' : 'node_deleted' });
      failed.add(step.nodeId);
      await out.emit({ type: 'step.skipped', nodeId: step.nodeId, reason: 'upstream_failed' });
      continue;
    }
    try {
      await runStep(env, db, run, step, graph, out, signal);
    } catch (e) {
      if (signal.aborted || (e as Error).name === 'AbortError') break;
      failed.add(step.nodeId);
      const gate = e instanceof GateFailure ? e.gate : null;
      const code = e instanceof InputMissing ? 'input_missing' : gate ? 'gate_failed' : 'engine_error';
      const message = (e as Error).message.slice(0, 500);
      await finishStep(db, step, 'failed', { errorCode: code, errorMessage: message, gate });
      await out.emit({
        type: 'step.failed',
        nodeId: step.nodeId,
        code,
        gate,
        message,
        refundedCredits: step.credits,
      });
      if (code === 'engine_error') console.error('engine_error', runId, step.nodeId, e);
    }
  }
  await finalize(db, run, out, signal.aborted);
}

class InputMissing extends Error {}

async function finishStep(db: Db, step: StepRow, status: StepRow['status'], f: Partial<StepRow> = {}) {
  await db
    .update(runSteps)
    .set({ status, finishedAt: new Date(), ...f })
    .where(eq(runSteps.id, step.id));
}

async function runStep(
  env: Env,
  db: Db,
  run: RunRow,
  step: StepRow,
  graph: Graph,
  out: Emitter,
  signal: AbortSignal,
) {
  const nodeId = step.nodeId!;
  const node = graph.nodes.get(nodeId)!;
  const edit = run.kind === 'edit' ? await loadEdit(env, db, run) : null;
  // An edit refines its base version on the same inputs, so it inherits the base input hash
  // (the node stays fresh; an upstream change still makes it stale).
  const hash = edit?.baseHash ?? (await computeInputHashes(graph)).get(nodeId)!;

  // Cache: the current version (or an older version of this node) was made from identical inputs.
  const hit = edit ? null : await cachedVersion(db, run.workspaceId, nodeId, node.currentVersionId, hash);
  if (hit) {
    const boardSeq =
      hit === node.currentVersionId ? await boardSeqOf(db, run.boardId) : await pointAt(db, run, nodeId, hit);
    await db
      .update(runSteps)
      .set({
        status: 'cached',
        cacheHit: true,
        credits: 0,
        inputHash: hash,
        outputVersionId: hit,
        finishedAt: new Date(),
      })
      .where(eq(runSteps.id, step.id));
    const [version] = await versionDtos(db, env, [hit]);
    await out.emit({
      type: 'step.succeeded',
      nodeId,
      versionId: hit,
      cached: true,
      credits: 0,
      version: version!,
      boardSeq,
    });
    return;
  }

  await db
    .update(runSteps)
    .set({ status: 'running', startedAt: new Date(), inputHash: hash })
    .where(eq(runSteps.id, step.id));
  await out.emit({ type: 'step.started', nodeId });
  const simSpeed = (run.params as { simSpeed?: number }).simSpeed;
  const engine = edit ? editEngineFor(env, node.kind, { simSpeed }) : engineFor(env, node.kind, { simSpeed });
  if (!engine) throw new Error(`No engine for ${node.kind}`);
  const inputs = edit ? [edit.input] : await resolveInputs(db, graph, nodeId);
  if (!edit) {
    for (const port of NODE_DEFS[node.kind].inputs) {
      if (port.required && !inputs.some((i) => i.port === port.id))
        throw new InputMissing(`Connect "${port.label}" first`);
    }
  }

  let lastProgress = 0;
  const { putFile, putArtifact } = artifactStore(env, run.workspaceId);
  const ctx: EngineContext = {
    runId: run.id,
    stepId: step.id,
    nodeId,
    kind: node.kind,
    settings: node.settings,
    inputs,
    signal,
    async progress(p, stage, previewAssetId) {
      const now = Date.now();
      if (p < 1 && now - lastProgress < PROGRESS_EVERY_MS) return;
      lastProgress = now;
      await out.emit({
        type: 'step.progress',
        nodeId,
        progress: Math.max(0, Math.min(1, p)),
        stage: stage.slice(0, 80),
        previewAssetId: previewAssetId ?? null,
      });
    },
    putFile,
    putArtifact,
    readInput: (input) => readAsset(env, db, input.assetId!),
    edit: edit
      ? { baseVersionId: edit.baseVersionId, faces: edit.faces, instruction: edit.instruction }
      : undefined,
  };
  const result = await engine.run(ctx);
  if (signal.aborted) throw new DOMException('cancelled', 'AbortError');
  const versionId = await persistVersion(
    db,
    {
      workspaceId: run.workspaceId,
      boardId: run.boardId,
      runId: run.id,
      userId: run.requestedBy,
      source: edit ? 'edit' : 'run',
      parentVersionId: edit?.baseVersionId,
    },
    nodeId,
    hash,
    node.settings,
    result.outputs,
    result.gates,
  );
  if (edit) await inheritVariants(db, edit.input.assetId!, versionId);
  const boardSeq = await pointAt(db, run, nodeId, versionId);
  // Edited versions are not cache entries: re-running the node from its inputs must regenerate.
  if (!edit)
    await db
      .insert(resultCache)
      .values({
        workspaceId: run.workspaceId,
        inputHash: hash,
        nodeKind: node.kind,
        engineVersion: engine.version,
        versionId,
      })
      .onConflictDoUpdate({
        target: [resultCache.workspaceId, resultCache.inputHash],
        set: { versionId, engineVersion: engine.version },
      });
  await db
    .update(runSteps)
    .set({ status: 'succeeded', outputVersionId: versionId, finishedAt: new Date() })
    .where(eq(runSteps.id, step.id));
  const [version] = await versionDtos(db, env, [versionId]);
  await out.emit({
    type: 'step.succeeded',
    nodeId,
    versionId,
    cached: false,
    credits: step.credits,
    version: version!,
    boardSeq,
  });
}

async function cachedVersion(
  db: Db,
  ws: string,
  nodeId: string,
  current: string | null,
  hash: string,
): Promise<string | null> {
  if (current) {
    const v = await db.query.nodeVersions.findFirst({ where: (t, { eq }) => eq(t.id, current) });
    if (v?.inputHash === hash) return current;
  }
  const rows = await db.execute<{ id: string }>(sql`
    SELECT v.id FROM result_cache c JOIN node_versions v ON v.id = c.version_id
    WHERE c.workspace_id = ${ws} AND c.input_hash = ${hash} AND v.node_id = ${nodeId} LIMIT 1`);
  if (rows.rows[0]) {
    await db.execute(
      sql`UPDATE result_cache SET hit_count = hit_count + 1, last_hit_at = now() WHERE workspace_id = ${ws} AND input_hash = ${hash}`,
    );
    return rows.rows[0].id;
  }
  return null;
}

async function boardSeqOf(db: Db, boardId: string) {
  const r = await db.execute<{ seq: number }>(sql`SELECT seq FROM boards WHERE id = ${boardId}`);
  return Number(r.rows[0]?.seq ?? 1);
}

/** Records the new current version as an ordinary op so every client and the op log agree. */
async function pointAt(db: Db, run: RunRow, nodeId: string, versionId: string) {
  const res = await applyBatch(db, run.workspaceId, run.requestedBy ?? '', run.boardId, newId(), [
    { type: 'node.update', id: nodeId, patch: { currentVersionId: versionId } },
  ]);
  return res.seq;
}

/** Inputs for the engine: upstream versions' primary assets, uploaded files, or text. */
export async function resolveInputs(db: Db, graph: Graph, nodeId: string): Promise<ResolvedInput[]> {
  const inputs: ResolvedInput[] = [];
  const node = graph.nodes.get(nodeId)!;
  for (const e of graph.edges.values()) {
    if (e.target !== nodeId) continue;
    const src = graph.nodes.get(e.source);
    if (!src) continue;
    const port = NODE_DEFS[node.kind].inputs.find((p) => p.id === e.targetPort);
    const type = NODE_DEFS[src.kind].output?.type;
    if (!port || !type) continue;
    if (src.kind === 'text' || src.kind === 'note') {
      const text = String(src.settings.text ?? '').trim();
      if (text) inputs.push({ port: port.id, type, text });
      continue;
    }
    let assetId: string | null = null;
    let versionId: string | undefined;
    if (NODE_DEFS[src.kind].runnable) {
      if (!src.currentVersionId) continue;
      const v = await db.query.nodeVersions.findFirst({
        where: (t, { eq }) => eq(t.id, src.currentVersionId!),
      });
      assetId = v?.outputAssetId ?? null;
      versionId = v?.id;
    } else {
      assetId = (src.settings.assetId as string | null) ?? null;
      versionId = src.currentVersionId ?? undefined;
    }
    if (!assetId) continue;
    const a = await db.query.assets.findFirst({ where: (t, { eq }) => eq(t.id, assetId!) });
    if (!a) continue;
    inputs.push({
      port: port.id,
      type,
      assetId: a.id,
      // Stable Worker route; external engines receive presigned GET URLs instead (engine protocol).
      url: `/api/assets/${a.id}/content`,
      mime: a.mime,
      versionId,
      meta: {
        ...(a.meta as Record<string, unknown>),
        sha256: a.sha256,
        width: a.width,
        height: a.height,
        triangleCount: a.triangleCount,
      },
    });
  }
  return inputs;
}

/** Where a new version comes from: a run, or a seeded example (runId null). */
export interface VersionOrigin {
  workspaceId: string;
  boardId: string;
  runId: string | null;
  userId: string | null;
  /** Where output objects live: engines write to artifacts; seeded examples reference public fixtures. */
  bucket?: 'artifacts' | 'public';
  source?: 'run' | 'edit';
  /** Defaults to the node's current version. */
  parentVersionId?: string;
}

/**
 * Content-addressed artifact storage for one workspace (used by runs and example seeding).
 * Primary outputs add their asset kind to the key: the same bytes may be a model3d and an
 * export file, and assets.storage_key is unique per row.
 */
export function artifactStore(env: Env, workspaceId: string) {
  const prefix = `${env.R2_KEY_PREFIX}ws/${workspaceId}/cas/`;
  const store = async (data: ArrayBuffer, meta: { ext: string; mime: string }, tag = '') => {
    const key = `${prefix}${await hex(data)}${tag}.${meta.ext}`;
    if (!(await env.ARTIFACTS.head(key)))
      await env.ARTIFACTS.put(key, data, { httpMetadata: { contentType: meta.mime } });
    return { storageKey: key, byteSize: data.byteLength };
  };
  const putFile: EngineContext['putFile'] = (data, meta) => store(data, meta);
  const putArtifact: EngineContext['putArtifact'] = async (data, meta) => {
    const buf = data instanceof ArrayBuffer ? data : await new Response(data).arrayBuffer();
    const sha256 = await hex(buf);
    const { ext: _ext, ...rest } = meta;
    const { storageKey, byteSize } = await store(buf, meta, `-${meta.kind}`);
    return { ...rest, storageKey, byteSize, sha256 };
  };
  return { putFile, putArtifact };
}

/**
 * Asset rows for engine outputs: same content in this workspace reuses its row (dedupe index),
 * so referencing an existing file (e.g. an export bundling the ad video) costs nothing.
 */
export async function ensureAssets(tx: Db, run: VersionOrigin, outputs: EngineOutput[]): Promise<string[]> {
  const ids: string[] = [];
  for (const o of outputs) {
    const existing = await tx.query.assets.findFirst({
      where: (t, { and, eq }) =>
        and(
          eq(t.workspaceId, run.workspaceId),
          eq(t.sha256, o.sha256),
          eq(t.kind, o.kind),
          eq(t.status, 'ready'),
        ),
    });
    const id = existing?.id ?? newId();
    if (!existing && !o.storageKey) throw new Error('Referenced output is not an asset of this workspace');
    if (!existing) {
      await tx.insert(assets).values({
        id,
        workspaceId: run.workspaceId,
        kind: o.kind,
        mime: o.mime,
        byteSize: o.byteSize,
        sha256: o.sha256,
        bucket: run.bucket ?? 'artifacts',
        storageKey: o.storageKey,
        status: 'ready',
        width: o.width ?? null,
        height: o.height ?? null,
        durationMs: o.durationMs ?? null,
        triangleCount: o.triangleCount ?? null,
        meta: o.meta ?? {},
        createdBy: run.userId,
      });
    }
    for (const v of o.variants ?? []) {
      await tx
        .insert(assetVariants)
        .values({
          assetId: id,
          variant: v.variant,
          mime: v.mime,
          byteSize: v.byteSize,
          storageKey: v.storageKey,
          width: v.width ?? null,
          height: v.height ?? null,
        })
        .onConflictDoNothing();
    }
    ids.push(id);
  }
  return ids;
}

export async function persistVersion(
  db: Db,
  run: VersionOrigin,
  nodeId: string,
  hash: string,
  settings: Record<string, unknown>,
  outputs: EngineOutput[],
  gates: { id: string; passed: boolean; value?: number; threshold?: number }[],
) {
  return db.transaction(async (tx0) => {
    const tx = tx0 as unknown as Db;
    const assetIds = await ensureAssets(tx, run, outputs);
    const max = await tx.execute<{ n: number }>(
      sql`SELECT coalesce(max(version_no), 0)::int AS n FROM node_versions WHERE node_id = ${nodeId}`,
    );
    const node = await tx.execute<{ current_version_id: string | null }>(
      sql`SELECT current_version_id FROM board_nodes WHERE id = ${nodeId}`,
    );
    const versionId = newId();
    await tx.insert(nodeVersions).values({
      id: versionId,
      nodeId,
      boardId: run.boardId,
      workspaceId: run.workspaceId,
      versionNo: (max.rows[0]?.n ?? 0) + 1,
      source: run.source ?? 'run',
      runId: run.runId,
      parentVersionId: run.parentVersionId ?? node.rows[0]?.current_version_id ?? null,
      outputAssetId: assetIds[0] ?? null,
      params: settings,
      gates,
      inputHash: hash,
      createdBy: run.userId,
    });
    const seen = new Set<string>();
    for (const [i, id] of assetIds.entries()) {
      if (seen.has(id)) continue;
      seen.add(id);
      await tx
        .insert(nodeVersionOutputs)
        .values({ versionId, assetId: id, role: outputs[i]!.role, position: i });
    }
    return versionId;
  });
}

async function finalize(db: Db, run: RunRow, out: Emitter, cancelled: boolean) {
  const steps = await db.select().from(runSteps).where(eq(runSteps.runId, run.id));
  if (cancelled) {
    for (const s of steps) {
      if (DONE.has(s.status)) continue;
      await finishStep(db, s, 'skipped', { errorCode: 'cancelled' });
      if (s.nodeId) await out.emit({ type: 'step.skipped', nodeId: s.nodeId, reason: 'cancelled' });
    }
  }
  const after = await db.select().from(runSteps).where(eq(runSteps.runId, run.id));
  const charged = after.filter((s) => s.status === 'succeeded').reduce((a, s) => a + s.credits, 0);
  const ok = after.filter((s) => s.status === 'succeeded' || s.status === 'cached').length;
  const bad = after.filter((s) => s.status === 'failed').length;
  const status = cancelled ? 'cancelled' : bad === 0 ? 'succeeded' : ok > 0 ? 'partial' : 'failed';
  // Settle exactly once and atomically with the status change: the conditional update guards
  // against a retried alarm, and the shared transaction means a crash cannot strand a reservation.
  await db.transaction(async (tx0) => {
    const tx = tx0 as unknown as Db;
    const upd = await tx
      .update(runs)
      .set({ status, chargedCredits: charged, finishedAt: new Date() })
      .where(and(eq(runs.id, run.id), sql`${runs.status} IN ('queued', 'running')`))
      .returning({ id: runs.id });
    if (upd.length)
      await settle(
        tx,
        run.workspaceId,
        run.id,
        run.estimatedCredits,
        Math.min(charged, run.estimatedCredits),
      );
  });
  await out.emit({ type: 'run.finished', status, chargedCredits: charged });
}

/** Edit runs keep their parameters on the run row and the face list in R2 (it can be large). */
async function loadEdit(env: Env, db: Db, run: RunRow) {
  const p = run.params as { baseVersionId: string; facesKey: string; instruction: string };
  const base = await db.query.nodeVersions.findFirst({ where: (t, { eq }) => eq(t.id, p.baseVersionId) });
  if (!base?.outputAssetId) throw new InputMissing('The base version has no model');
  const a = await db.query.assets.findFirst({ where: (t, { eq }) => eq(t.id, base.outputAssetId!) });
  if (!a) throw new InputMissing('The base model file is missing');
  const obj = await env.ARTIFACTS.get(p.facesKey);
  if (!obj) throw new InputMissing('The selection expired; select the region again');
  const faces = [...new Uint32Array(await obj.arrayBuffer())];
  const input: ResolvedInput = {
    port: 'base',
    type: 'model3d',
    assetId: a.id,
    url: `/api/assets/${a.id}/content`,
    mime: a.mime,
    versionId: base.id,
    meta: { ...(a.meta as Record<string, unknown>), sha256: a.sha256, triangleCount: a.triangleCount },
  };
  return { baseVersionId: base.id, baseHash: base.inputHash, faces, instruction: p.instruction, input };
}

export async function readAsset(env: Env, db: Db, assetId: string): Promise<ArrayBuffer> {
  const a = await db.query.assets.findFirst({ where: (t, { eq }) => eq(t.id, assetId) });
  if (!a) throw new InputMissing('Input file not found');
  const obj = await bucketOf(env, a.bucket).get(a.storageKey);
  if (!obj) throw new InputMissing('Input file missing in storage');
  return obj.arrayBuffer();
}

/** The edited model keeps its base's preview images until a render engine refreshes them. */
async function inheritVariants(db: Db, baseAssetId: string, versionId: string) {
  const v = await db.query.nodeVersions.findFirst({ where: (t, { eq }) => eq(t.id, versionId) });
  if (!v?.outputAssetId || v.outputAssetId === baseAssetId) return;
  await db.execute(sql`
    INSERT INTO asset_variants (asset_id, variant, mime, byte_size, storage_key, width, height)
    SELECT ${v.outputAssetId}, variant, mime, byte_size, storage_key, width, height
    FROM asset_variants WHERE asset_id = ${baseAssetId}
    ON CONFLICT DO NOTHING`);
}
