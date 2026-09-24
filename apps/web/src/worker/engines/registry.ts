import type { Engine, NodeKind } from '@annie3d/contracts';
import type { Env } from '../env';
import { simulator } from './simulator';
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
