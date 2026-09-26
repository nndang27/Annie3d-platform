import { type Engine, GLB_PRESETS, type GlbPresetId, type NodeKind } from '@annie3d/contracts';
import type { Env } from '../env';
import { type Translator, translator } from '../lib/i18n';
import { applyRegionEdit } from './edit';
import { buildBundle } from './export';
import { GateFailure, simulator } from './simulator';
import { ENGINE_VERSIONS } from './versions';

/**
 * ENGINE REGISTRY — the one place real agents are plugged in.
 * Replace `simulator(kind, …)` for a kind with an in-process Engine, or with an External
 * Engine Protocol client (packages/contracts/src/engine.ts). Keep ENGINE_VERSIONS in step:
 * bumping a version invalidates cached results for that kind.
 */
/** `t`: the run's language, for progress stages and failure messages a person reads. */
export interface EngineOptions {
  simSpeed?: number;
  t?: Translator;
}

export function engineFor(env: Env, kind: NodeKind, opts: EngineOptions = {}): Engine | null {
  if (!ENGINE_VERSIONS[kind]) return null;
  const t = opts.t ?? translator('en');
  // Export is real already: optimise + check the GLB for the preset and zip the bundle (F6).
  if (kind === 'export') return exportEngine(t);
  return simulator(kind, {
    speed: opts.simSpeed ?? (Number(env.SIM_SPEED ?? '1') || 1),
    readFixture: async (key) => (await env.PUBLIC.get(key))?.arrayBuffer() ?? null,
    t,
  });
}

/**
 * Region edits (F8). The simulated editor really applies the instruction to the selected faces
 * (engines/edit.ts); replace with the real 3D edit agent here.
 */
export function editEngineFor(env: Env, kind: NodeKind, opts: EngineOptions = {}): Engine | null {
  if (kind !== 'model3d' && kind !== 'upload3d') return null;
  const t = opts.t ?? translator('en');
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
      await ctx.progress(0.1, t('api.stage.edit.readingSelection'));
      await wait(1200, ctx.signal);
      const base = ctx.inputs[0]!;
      const bytes = await ctx.readInput(base);
      await ctx.progress(0.5, t('api.stage.edit.applying'));
      await wait(1800, ctx.signal);
      const { glb, changedFaces } = await applyRegionEdit(
        new Uint8Array(bytes),
        ctx.edit.faces,
        ctx.edit.instruction,
      );
      if (!changedFaces) throw new GateFailure('selection', t('api.run.regionNotOnVersion'));
      await ctx.progress(0.9, t('api.stage.edit.checking'));
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

function exportEngine(t: Translator): Engine {
  return {
    kind: 'export',
    version: 'export-1',
    async run(ctx) {
      const s = ctx.settings as { glbPreset?: string; includeMp4?: boolean; includePng?: boolean };
      const preset = (s.glbPreset && s.glbPreset in GLB_PRESETS ? s.glbPreset : 'web') as GlbPresetId;
      const { outputs, report } = await buildBundle(ctx, ctx.inputs, {
        preset,
        includeMp4: s.includeMp4 ?? true,
        includePng: s.includePng ?? true,
        name: String(ctx.settings.name ?? 'annie3d'),
        t,
      });
      await ctx.progress(
        1,
        report?.passed === false
          ? t('api.stage.export.exportedWithFailures')
          : t('api.stage.export.exported'),
      );
      // Preset checks are reported as gates; a failed check does not fail the export (the files
      // are still useful), the node shows which limit to fix.
      return {
        outputs,
        gates: (report?.checks ?? []).map((c) => ({
          id: `${preset}:${c.id}`,
          passed: c.passed,
          value: c.value,
          threshold: c.limit,
        })),
      };
    },
  };
}
