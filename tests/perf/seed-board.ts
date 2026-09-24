// Prints a guest board with ~N nodes (tiled Starter lines with fixture outputs) as JSON.
// Usage: npx -y tsx tests/perf/seed-board.ts 200

import { FIXTURE_FOR_STARTER, fixtureOutputs } from '../../fixtures/index';
import {
  generateKeyBetween,
  type NodeVersionDto,
  newId,
  STARTERS,
  starterGraph,
} from '../../packages/contracts/src/index';

const target = Number(process.argv[2] ?? 200);
const nodes = [];
const edges = [];
const versions: NodeVersionDto[] = [];
let z: string | null = null;
for (let i = 0; nodes.length < target; i++) {
  const starter = STARTERS[i % STARTERS.length]!;
  const g = starterGraph(starter, { x: (i % 4) * 2100, y: Math.floor(i / 4) * 900 });
  for (const raw of g.nodes) {
    z = generateKeyBetween(z, null);
    const n = { ...raw, zKey: z };
    const outputs = fixtureOutputs('', FIXTURE_FOR_STARTER[starter], n.kind);
    if (outputs.length) {
      const id = newId();
      versions.push({
        id,
        nodeId: n.id,
        versionNo: 1,
        source: 'run',
        runId: null,
        parentVersionId: null,
        outputAssetId: outputs[0]!.id,
        outputs,
        params: {},
        gates: [],
        createdAt: new Date().toISOString(),
      });
      n.currentVersionId = id;
    }
    nodes.push(n);
  }
  edges.push(...g.edges);
}
process.stdout.write(JSON.stringify({ title: `Perf board (${nodes.length} nodes)`, nodes, edges, versions }));
