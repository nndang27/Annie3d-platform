import { matchesGlob } from '@annie3d/contracts/features';

/**
 * The site's `_headers` rules (Cloudflare Workers static assets format), applied to files the app
 * serves from disk so the page gets the same CSP and security headers as on the website.
 */
export function parseHeaders(text: string | null): (path: string) => Record<string, string> {
  const rules: { glob: string; headers: Record<string, string> }[] = [];
  let cur: { glob: string; headers: Record<string, string> } | null = null;
  for (const line of (text ?? '').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      cur = { glob: line.trim().replace(/\*$/, '**'), headers: {} };
      rules.push(cur);
    } else if (cur) {
      const i = line.indexOf(':');
      if (i > 0) cur.headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }
  }
  return (path) => {
    const out: Record<string, string> = {};
    for (const r of rules) if (matchesGlob(path, r.glob)) Object.assign(out, r.headers);
    // HSTS means nothing for a local response and the app never frames itself.
    delete out['strict-transport-security'];
    return out;
  };
}
