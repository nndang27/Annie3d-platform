import { createPrivateKey, sign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';

/**
 * A stand-in for the website: serves the web build (apps/web/dist/client) plus overrides, and a
 * desktop manifest the test controls. The API answers 404, so the app runs as a guest.
 */
export const DIST = join(__dirname, '../../apps/web/dist/client');
const devVars = existsSync(join(__dirname, '../../.dev.vars'))
  ? readFileSync(join(__dirname, '../../.dev.vars'), 'utf8')
  : '';
const keyB64 = process.env.ANNIE3D_PACK_KEY ?? devVars.match(/^ANNIE3D_PACK_KEY=(.+)$/m)?.[1];

export interface Manifest {
  version: string;
  builtAt: number;
  files: { path: string; sha256: string; size: number; features: string[] }[];
  [k: string]: unknown;
}

export function builtManifest(): Manifest {
  return JSON.parse(JSON.parse(readFileSync(join(DIST, 'desktop/manifest.json'), 'utf8')).manifest);
}

export function signed(m: Manifest, tamper = false) {
  const text = JSON.stringify(m);
  if (!keyB64) throw new Error('ANNIE3D_PACK_KEY missing (.dev.vars)');
  const key = createPrivateKey(Buffer.from(keyB64.trim(), 'base64').toString('utf8'));
  const sig = sign(null, Buffer.from(tamper ? `${text} ` : text), key).toString('base64');
  return JSON.stringify({ manifest: text, signature: sig, keyId: 'k1' });
}

export class FakeSite {
  manifest: string | null = null;
  overrides = new Map<string, Buffer>();
  requests: string[] = [];
  private server: Server | null = null;
  origin = '';

  async start() {
    this.server = createServer((req, res) => {
      const path = decodeURIComponent((req.url ?? '/').split('?')[0]!);
      this.requests.push(path);
      if (path === '/desktop/manifest.json' && this.manifest) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(this.manifest);
        return;
      }
      const o = this.overrides.get(path.slice(1));
      if (o) {
        res.writeHead(200);
        res.end(o);
        return;
      }
      const file = join(DIST, path);
      if (!path.startsWith('/api/') && existsSync(file) && !file.endsWith('/')) {
        try {
          res.writeHead(200);
          res.end(readFileSync(file));
          return;
        } catch {}
      }
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('{"error":{"code":"not_found","message":"not found"}}');
    });
    await new Promise<void>((r) => this.server!.listen(0, '127.0.0.1', () => r()));
    const addr = this.server.address() as { port: number };
    this.origin = `http://127.0.0.1:${addr.port}`;
  }

  stop() {
    this.server?.close();
  }
}
