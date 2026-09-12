/** Only internal app destinations are valid `returnTo` targets. */
export const APP_BASE = '/app';

function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) < 32) return true;
  return false;
}

export function isSafeReturnTo(value: string | null | undefined): value is string {
  if (!value) return false;
  if (value.length > 512) return false;
  if (!value.startsWith(`${APP_BASE}/`) && value !== APP_BASE) return false;
  if (value.startsWith('//') || value.includes('://') || value.includes('\\')) return false;
  if (hasControlChars(value)) return false;
  return true;
}

export function safeReturnTo(value: string | null | undefined, fallback = APP_BASE): string {
  return isSafeReturnTo(value) ? value : fallback;
}

/** Intent that must survive sign-in / checkout. Kept small; never credentials or prompt text. */
export interface NavigationIntent {
  returnTo?: string;
  template?: string;
  plan?: string;
  interval?: string;
  project?: string;
}

export function intentToSearch(intent: NavigationIntent): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(intent)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function intentFromSearch(search: string | URLSearchParams): NavigationIntent {
  const p = typeof search === 'string' ? new URLSearchParams(search) : search;
  const out: NavigationIntent = {};
  const rt = p.get('returnTo');
  if (isSafeReturnTo(rt)) out.returnTo = rt;
  for (const k of ['template', 'plan', 'interval', 'project'] as const) {
    const v = p.get(k);
    if (v && /^[a-z0-9_-]{1,64}$/i.test(v)) out[k] = v;
  }
  return out;
}
