import { creditsFor, type Graph, NODE_DEFS, runPlan } from '@annie3d/contracts';
import type { Db } from '@annie3d/db';
import { nodeVersions } from '@annie3d/db';
import { inArray } from 'drizzle-orm';
import { computeInputHashes } from './boards';

export interface PlanStep {
  nodeId: string;
  kind: import('@annie3d/contracts').NodeKind;
  credits: number;
  cached: boolean;
  inputHash: string;
}

/**
 * Execution plan with cache prediction. A node is cached when its current version was produced
 * from the same input hash and nothing upstream will re-run. Cached steps cost nothing.
 */
export async function planRun(
  db: Db,
  graph: Graph,
  nodeId: string | null,
  scope: 'node' | 'from_here' | 'with_upstream' | 'all',
): Promise<PlanStep[]> {
  const order = runPlan(graph, nodeId, scope);
  const hashes = await computeInputHashes(graph);
  const current = [...graph.nodes.values()].map((n) => n.currentVersionId).filter((x): x is string => !!x);
  const vh = new Map(
    (current.length
      ? await db
          .select({ id: nodeVersions.id, h: nodeVersions.inputHash })
          .from(nodeVersions)
          .where(inArray(nodeVersions.id, current))
      : []
    ).map((r) => [r.id, r.h]),
  );
  const rerun = new Set<string>();
  const steps: PlanStep[] = [];
  for (const id of order) {
    const n = graph.nodes.get(id)!;
    const upstreamRerun = [...graph.edges.values()].some((e) => e.target === id && rerun.has(e.source));
    const hash = hashes.get(id)!;
    const cached = !upstreamRerun && !!n.currentVersionId && vh.get(n.currentVersionId) === hash;
    if (!cached) rerun.add(id);
    steps.push({
      nodeId: id,
      kind: n.kind,
      credits: cached || !NODE_DEFS[n.kind].runnable ? 0 : creditsFor(n.kind, n.settings),
      cached,
      inputHash: hash,
    });
  }
  return steps;
}
