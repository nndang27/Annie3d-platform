// Reports compressed sizes of built assets per route chunk. Run after `pnpm build`.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
function report(label, dir, filter) {
  const files = walk(dir).filter(filter);
  const rows = files.map((f) => {
    const buf = readFileSync(f);
    return {
      file: f.replace(`${root}/`, ''),
      raw: buf.length,
      gzip: gzipSync(buf).length,
      brotli: brotliCompressSync(buf).length,
    };
  });
  rows.sort((a, b) => b.gzip - a.gzip);
  const total = rows.reduce((s, r) => s + r.gzip, 0);
  return { label, files: rows, totalGzip: total };
}
const web = report('apps/web (JS)', join(root, 'apps/web/dist/assets'), (f) => f.endsWith('.js'));
const webCss = report('apps/web (CSS)', join(root, 'apps/web/dist/assets'), (f) => f.endsWith('.css'));
const site = report('apps/marketing (JS)', join(root, 'apps/marketing/dist'), (f) => f.endsWith('.js'));
const siteCss = report('apps/marketing (CSS)', join(root, 'apps/marketing/dist'), (f) => f.endsWith('.css'));
const out = { generatedAt: new Date().toISOString(), reports: [web, webCss, site, siteCss] };
mkdirSync(join(root, 'perf-results'), { recursive: true });
writeFileSync(join(root, 'perf-results/bundle-report.json'), JSON.stringify(out, null, 2));
for (const r of out.reports) {
  console.log(`\n== ${r.label}: total gzip ${(r.totalGzip / 1024).toFixed(1)} KB`);
  for (const f of r.files)
    console.log(
      `${(f.gzip / 1024).toFixed(1).padStart(7)} KB gz  ${(f.brotli / 1024).toFixed(1).padStart(7)} KB br  ${f.file}`,
    );
}
