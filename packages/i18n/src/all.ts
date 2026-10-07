import { type Catalog, createTranslator, type Translator } from './index';
import type { Locale } from './locales';
import en from './messages/en';
import es from './messages/es';
import fr from './messages/fr';
import it from './messages/it';
import ja from './messages/ja';
import ko from './messages/ko';
import pt from './messages/pt';
import vi from './messages/vi';

/** Every language at once, for the Worker, the desktop shell and the static site (no lazy loading there). */
export const CATALOGS: Record<Locale, Catalog> = { en, vi, fr, pt, es, it, ko, ja };

const cache = new Map<Locale, Translator>();
export function translator(locale: Locale): Translator {
  let t = cache.get(locale);
  if (!t) {
    t = createTranslator(locale, CATALOGS[locale]);
    cache.set(locale, t);
  }
  return t;
}
