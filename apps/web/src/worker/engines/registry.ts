import type { Engine, NodeKind } from '@annie3d/contracts';
import type { Env } from '../env';
import { applyRegionEdit } from './edit';
import { GateFailure, simulator } from './simulator';
import { ENGINE_VERSIONS } from './versions';

/**
 * ENGINE REGISTRY — the one place real agents are plugged in.
 * Replace `simulator(kind, …)` for a kind with an in-process Engine, or with an External
 * Engine Protocol client (packages/contracts/src/engine.ts). Keep ENGINE_VERSIONS in step:
 * bumping a version invalidates cached results for that kind.
 */
export function engineFor(env: Env, kind: NodeKind, opts: { simSpeed?: number } = {}): Engine | null {
  if (!ENGINE_VERSIONS[kind]) return null;
  return simulator(kind, {
    speed: opts.simSpeed ?? (Number(env.SIM_SPEED ?? '1') || 1),
    readFixture: async (key) => (await env.PUBLIC.get(key))?.arrayBuffer() ?? null,
  });
}

/**
 * Region edits (F8). The simulated editor really applies the instruction to the selected faces
 * (engines/edit.ts); replace with the real 3D edit agent here.
 */
export function editEngineFor(env: Env, kind: NodeKind, opts: { simSpeed?: number } = {}): Engine | null {
  if (kind !== 'model3d' && kind !== 'upload3d') return null;
  const speed = opts.simSpeed ?? (Number(env.SIM_SPEED ?? '1') || 1);
  const wait = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms * speed);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(new DOMException('cancelled', 'AbortError'));
        },
        { once: true },
      );
    });
  return {
    kind,
    version: 'sim-edit-1',
    async run(ctx) {
      if (!ctx.edit) throw new Error('edit parameters missing');
      await ctx.progress(0.1, 'Reading selection');
      await wait(1200, ctx.signal);
      const base = ctx.inputs[0]!;
      const bytes = await ctx.readInput(base);
      await ctx.progress(0.5, 'Applying edit');
      await wait(1800, ctx.signal);
      const { glb, changedFaces } = await applyRegionEdit(
        new Uint8Array(bytes),
        ctx.edit.faces,
        ctx.edit.instruction,
      );
      if (!changedFaces) throw new GateFailure('selection', 'The selected region is not on this version');
      await ctx.progress(0.9, 'Checking result');
      const buf = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer;
      const out = await ctx.putArtifact(buf, {
        ext: 'glb',
        mime: 'model/gltf-binary',
        kind: 'model3d',
        role: 'primary',
        meta: {
          ...(base.meta?.fixtureProduct ? { fixtureProduct: base.meta.fixtureProduct } : {}),
          editedFaces: changedFaces,
          instruction: ctx.edit.instruction,
        },
        triangleCount: typeof base.meta?.triangleCount === 'number' ? base.meta.triangleCount : undefined,
      });
      return { outputs: [out], gates: [{ id: 'edit_applied', passed: true, value: changedFaces }] };
    },
  };
}
