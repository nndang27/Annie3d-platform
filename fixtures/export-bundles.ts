// Builds each product's example export bundle with the Worker's own exporter (preset "web"),
// so the seeded example board shows exactly what a real Export run produces.
// Usage: npx -y tsx fixtures/export-bundles.ts   (then node fixtures/upload.mjs)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { exportGlb, zip } from '../apps/web/src/worker/services/exporter';

const OUT = new URL('./out/', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(`${OUT}manifest.json`, 'utf8'));
// biome-ignore lint/suspicious/noExplicitAny: plain JSON manifest mutated in place.
for (const [product, p] of Object.entries<any>(manifest.products)) {
  const dir = `${OUT}${product}/`;
  const { glb, report } = await exportGlb(new Uint8Array(readFileSync(`${dir}model.glb`)), 'web');
  const files = [
    { name: `${product}-web.glb`, data: glb },
    { name: `${product}-ad.mp4`, data: new Uint8Array(readFileSync(`${dir}ad_9x16.mp4`)) },
    ...['three_quarter', 'front', 'top', 'detail'].map((a, i) => ({
      name: `${product}-image-${i + 1}.png`,
      data: new Uint8Array(readFileSync(`${dir}packshot_${a}.png`)),
    })),
  ];
  writeFileSync(`${dir}export_web.glb`, glb);
  writeFileSync(`${dir}export_web.zip`, zip(files));
  for (const f of ['export_web.glb', 'export_web.zip']) {
    const buf = readFileSync(`${dir}${f}`);
    p.files[f] = { bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
  }
  p.exportReport = report;
  p.exportFiles = files.map((f) => f.name);
  console.log(
    product,
    report.passed ? 'PASS' : 'FAIL',
    report.checks.map((c) => `${c.id}:${c.passed ? 'ok' : 'x'}`).join(' '),
  );
}
writeFileSync(`${OUT}manifest.json`, JSON.stringify(manifest, null, 2));
