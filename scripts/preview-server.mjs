// One-origin production preview: Astro site at /, Vite app at /app/ with SPA fallback.
// Never rewrites /api/*, missing assets or public 404s into the SPA shell.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SITE = join(root, 'apps/marketing/dist');
const APP = join(root, 'apps/web/dist');
const PORT = Number(process.env.PORT ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.map': 'application/json',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml', '.map']);
const encodedCache = new Map();

/** Serves a file; compresses text assets like a production host (brotli/gzip) so transfer sizes are realistic. */
function send(res, file, status = 200, extraHeaders = {}, req) {
  const ext = extname(file).toLowerCase();
  const stat = statSync(file);
  const immutable = /\/(assets|_astro)\//.test(file);
  const headers = {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': immutable
      ? 'public, max-age=31536000, immutable'
      : ext === '.html'
        ? 'no-cache'
        : 'public, max-age=3600',
    vary: 'accept-encoding',
    ...extraHeaders,
  };
  const accept = String(req?.headers?.['accept-encoding'] ?? '');
  const enc =
    COMPRESSIBLE.has(ext) && stat.size > 1024
      ? accept.includes('br')
        ? 'br'
        : accept.includes('gzip')
          ? 'gzip'
          : null
      : null;
  if (enc) {
    const cacheKey = `${file}:${stat.mtimeMs}:${enc}`;
    let body = encodedCache.get(cacheKey);
    if (!body) {
      const raw = readFileSync(file);
      body = enc === 'br' ? brotliCompressSync(raw) : gzipSync(raw);
      encodedCache.set(cacheKey, body);
    }
    res.writeHead(status, { ...headers, 'content-encoding': enc, 'content-length': body.length });
    res.end(body);
    return;
  }
  res.writeHead(status, { ...headers, 'content-length': stat.size });
  createReadStream(file).pipe(res);
}

function safe(base, urlPath) {
  const p = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const full = join(base, p);
  return full.startsWith(base) ? full : null;
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  if (path.startsWith('/api/')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found', message: 'No API is served by the demo preview.' }));
    return;
  }
  if (path === '/app') {
    res.writeHead(301, { location: '/app/' + url.search });
    res.end();
    return;
  }
  if (path.startsWith('/app/')) {
    const rel = path.slice('/app/'.length);
    const file = safe(APP, rel || 'index.html');
    if (file && existsSync(file) && statSync(file).isFile()) return send(res, file, 200, {}, req);
    // Missing hashed asset or fixture → real 404, never the SPA shell.
    if (rel.startsWith('assets/') || rel.startsWith('fixtures/') || /\.[a-z0-9]{2,5}$/i.test(rel)) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
      return;
    }
    return send(res, join(APP, 'index.html'), 200, {}, req);
  }
  // Marketing: exact file, then `<path>.html` (Astro build.format = 'file'), then directory index, else 404 page.
  const base = safe(SITE, path);
  if (base) {
    const candidates = [base, `${base}.html`, join(base, 'index.html')];
    for (const f of candidates) {
      if (existsSync(f) && statSync(f).isFile()) return send(res, f, 200, {}, req);
    }
  }
  const nf = join(SITE, '404.html');
  if (existsSync(nf)) return send(res, nf, 404, {}, req);
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Annie 3D preview: http://localhost:${PORT}/  (app at /app/)`);
});
