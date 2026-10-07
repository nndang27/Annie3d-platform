import { DEFAULT_LOCALE, LOCALES, type Locale, type Translator } from '@annie3d/i18n';
import { translator } from '@annie3d/i18n/all';

/** The canvas opens at /app (packages/contracts APP_PATH); the English landing page is the root. */
export const CANVAS = '/app';
export const CONTACT_EMAIL = 'ngocdang.nguyen@annie3d.app';
/** The company page; the name stays "LinkedIn" in every language (a brand). */
export const LINKEDIN = 'https://www.linkedin.com/company/annie3d';

/**
 * English pages stay at their paths (/home, /legal/terms); every other language lives under
 * its code (/vi/home, /vi/legal/terms). One template per page renders all of them through
 * `getStaticPaths` over a `[...lang]` segment, which is empty for English.
 */
export const localePath = (locale: Locale, path: string) =>
  locale === DEFAULT_LOCALE ? (path === '/home' ? '/' : path) : `/${locale}${path}`;

export function localeStaticPaths() {
  return LOCALES.map((l) => ({
    params: { lang: l.code === DEFAULT_LOCALE ? undefined : l.code },
    props: { locale: l.code as Locale },
  }));
}

export interface LocaleProps {
  locale: Locale;
}

/** The page's translator, from the locale `getStaticPaths` handed it. */
export const pageT = (locale: Locale): Translator => translator(locale);

/** The page path without its language prefix (`/vi/legal/terms` → `/legal/terms`). */
export function basePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/';
  const first = p.split('/')[1];
  const hasPrefix = LOCALES.some((l) => l.code !== DEFAULT_LOCALE && l.code === first);
  const base = hasPrefix ? p.slice(first!.length + 1) || '/' : p;
  // The English landing page is served at the root (the Worker answers "/" with /home).
  return base === '/' ? '/home' : base;
}
