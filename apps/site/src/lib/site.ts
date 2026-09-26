import { DEFAULT_LOCALE, LOCALES, type Locale, type Translator } from '@annie3d/i18n';
import { translator } from '@annie3d/i18n/all';

/** The canvas workspace is served at the site root; this static site only hosts /home and /legal. */
export const CANVAS = '/';
export const CONTACT_EMAIL = 'hello@annie3d.example';

/**
 * English pages stay at their paths (/home, /legal/terms); every other language lives under
 * its code (/vi/home, /vi/legal/terms). One template per page renders all of them through
 * `getStaticPaths` over a `[...lang]` segment, which is empty for English.
 */
export const localePath = (locale: Locale, path: string) =>
  locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;

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
  return hasPrefix ? p.slice(first!.length + 1) || '/' : p;
}
