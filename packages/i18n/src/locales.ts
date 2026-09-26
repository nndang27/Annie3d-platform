/**
 * The languages Annie 3D speaks. Adding one: a row here, a catalog in `messages/<code>.ts`
 * (typed against English, so a missing key does not compile) and its loader in `index.ts`.
 * `tag` is the BCP 47 tag used for `<html lang>`, Intl formatting and fonts.
 */
export const LOCALES = [
  { code: 'en', tag: 'en', name: 'English' },
  { code: 'vi', tag: 'vi', name: 'Tiếng Việt' },
  { code: 'fr', tag: 'fr', name: 'Français' },
  { code: 'pt', tag: 'pt-BR', name: 'Português' },
  { code: 'es', tag: 'es', name: 'Español' },
  { code: 'it', tag: 'it', name: 'Italiano' },
  { code: 'ru', tag: 'ru', name: 'Русский' },
  { code: 'ko', tag: 'ko', name: '한국어' },
  { code: 'ja', tag: 'ja', name: '日本語' },
  { code: 'zh', tag: 'zh-CN', name: '简体中文' },
] as const;

export type Locale = (typeof LOCALES)[number]['code'];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Test-only pseudo-locale: English with accented letters in ⟦ ⟧ brackets. Text on screen
 * without the brackets did not go through t(). Never offered to people.
 */
export const PSEUDO = 'en-XA';

/** Where a chosen language is kept: localStorage in the app, a cookie for the server. */
export const STORAGE_KEY = 'annie3d.lang';
export const COOKIE = 'annie3d_lang';

const CODES = new Set<string>(LOCALES.map((l) => l.code));
export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && CODES.has(v);
export const tagOf = (l: Locale) => LOCALES.find((x) => x.code === l)!.tag;

/**
 * The best supported language for a list of preferred language tags (navigator.languages,
 * Accept-Language), by exact code, then primary subtag ("pt-PT" → pt, "zh-TW" → zh).
 */
export function negotiate(preferred: readonly string[]): Locale {
  for (const p of preferred) {
    const primary = p.trim().toLowerCase().split(/[-_]/)[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

/** Language tags from an Accept-Language header, best first. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => {
      const [tag, ...rest] = part.trim().split(';');
      const q = rest.find((r) => r.trim().startsWith('q='));
      return { tag: tag!.trim(), q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .filter((x) => x.tag && x.tag !== '*' && x.q > 0)
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
}

/** The language a cookie header asks for, if any. */
export function localeFromCookie(cookie: string | null | undefined): Locale | null {
  const m = cookie?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m && isLocale(m[1]) ? m[1] : null;
}
