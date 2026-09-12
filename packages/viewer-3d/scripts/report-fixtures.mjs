// Records fixture complexity (triangles, parts) into fixtures/fixture-report.json.
// Runs in Node with type stripping; three.js geometry works without a GPU.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, set fillStyle(_v) {} }) }),
};
const { buildFixture, FIXTURE_IDS } = await import('../src/fixtures.ts');
const out = {};
for (const id of FIXTURE_IDS) {
  const f = buildFixture(id, '#888888', 'satin');
  let meshes = 0;
  f.root.traverse((o) => {
    if (o.isMesh) meshes += 1;
  });
  out[id] = {
    triangles: f.triangles,
    parts: f.parts.map((p) => p.id),
    meshes,
    radius: f.radius,
    height: f.height,
  };
  f.dispose();
}
const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../../../fixtures/fixture-report.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify({ generatedAt: new Date().toISOString(), fixtures: out }, null, 2));
console.log(JSON.stringify(out));
