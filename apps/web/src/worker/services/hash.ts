/**
 * Input hash = sha256 of canonical JSON of (kind, engine version, settings, resolved inputs).
 * Equal hash ⇒ equal result, so the run can reuse a cached version and the node is not stale.
 */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(',')}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface HashInput {
  port: string;
  /** Upstream identity: version id for runnable nodes, asset id for uploads, text for text nodes. */
  ref: string;
}

export async function inputHash(
  kind: string,
  engineVersion: string,
  settings: Record<string, unknown>,
  inputs: HashInput[],
): Promise<string> {
  const sorted = [...inputs].sort((a, b) => (a.port + a.ref < b.port + b.ref ? -1 : 1));
  return sha256Hex(canonical({ kind, engineVersion, settings, inputs: sorted }));
}
