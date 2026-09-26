import { type Locale, PSEUDO, tagOf } from './locales';
import en from './messages/en';
import { pseudoCatalog } from './pseudo';

export * from './locales';
export { en };

/**
 * Messages are flat keys (`topbar.runAll`) whose English text is the source of truth
 * (`messages/en/*.ts`). Every other language is a `Catalog`: the same keys, checked by the
 * compiler, so a key added in English does not build until each language has it.
 *
 * - `{name}` is a placeholder; numbers are formatted for the language (1,234 / 1.234 / 1 234).
 * - A plural is an object of CLDR categories (`one`, `few`, `many`, `other`, …) chosen by
 *   Intl.PluralRules from `{count}`; each language lists the categories it needs.
 */
type En = typeof en;
export type MessageKey = keyof En & string;
export type Plural = {
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
};
export type Catalog = { readonly [K in MessageKey]: En[K] extends string ? string : Plural };

type Vars<S extends string> = S extends `${string}{${infer P}}${infer R}` ? P | Vars<R> : never;
type KeyVars<K extends MessageKey> = En[K] extends string
  ? Vars<En[K]>
  : En[K] extends { readonly other: infer O extends string }
    ? Vars<O> | 'count'
    : never;
export type ParamsOf<K extends MessageKey, V = string | number> = { [P in KeyVars<K>]: V };
/** The arguments after the key: none, or an object with exactly the placeholders of the English text. */
export type Params<K extends MessageKey, V = string | number> = [KeyVars<K>] extends [never]
  ? []
  : [params: ParamsOf<K, V>];

export interface Translator {
  <K extends MessageKey>(key: K, ...params: Params<K>): string;
  readonly locale: Locale | typeof PSEUDO;
  /** BCP 47 tag for Intl and `<html lang>`. */
  readonly tag: string;
  /** The text of `key` with the plural form chosen, placeholders left in (for rich text). */
  template(key: MessageKey, count?: number): string;
  number(n: number, options?: Intl.NumberFormatOptions): string;
  date(d: Date | number, options?: Intl.DateTimeFormatOptions): string;
}

const PLACEHOLDER = /\{(\w+)\}/g;

export function createTranslator(locale: Locale | typeof PSEUDO, catalog: Catalog): Translator {
  const tag = locale === PSEUDO ? 'en' : tagOf(locale);
  const nf = new Intl.NumberFormat(tag);
  const pr = new Intl.PluralRules(tag);
  const template = (key: MessageKey, count?: number) => {
    const m = (catalog[key] ?? en[key]) as string | Plural | undefined;
    if (m === undefined) return key;
    if (typeof m === 'string') return m;
    return m[pr.select(count ?? 0)] ?? m.other;
  };
  const t = ((key: MessageKey, params?: Record<string, string | number>) => {
    const s = template(key, typeof params?.count === 'number' ? params.count : undefined);
    if (!params) return s;
    return s.replace(PLACEHOLDER, (all, name: string) => {
      const v = params[name];
      return v === undefined ? all : typeof v === 'number' ? nf.format(v) : v;
    });
  }) as Translator;
  return Object.assign(t, {
    locale,
    tag,
    template,
    number: (n: number, o?: Intl.NumberFormatOptions) => (o ? new Intl.NumberFormat(tag, o) : nf).format(n),
    date: (d: Date | number, o?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, o).format(d),
  });
}

/** Splits a template into text and placeholder names, for rich text (React nodes as values). */
export function splitTemplate(s: string): (string | { name: string })[] {
  const out: (string | { name: string })[] = [];
  let last = 0;
  for (const m of s.matchAll(PLACEHOLDER)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push({ name: m[1]! });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/**
 * Each language is its own chunk: English is built in, another language downloads only when
 * it is chosen (one file, ~15 KB compressed).
 */
const LOADERS: Record<Exclude<Locale, 'en'>, () => Promise<{ default: Catalog }>> = {
  vi: () => import('./messages/vi'),
  fr: () => import('./messages/fr'),
  pt: () => import('./messages/pt'),
  es: () => import('./messages/es'),
  it: () => import('./messages/it'),
  ru: () => import('./messages/ru'),
  ko: () => import('./messages/ko'),
  ja: () => import('./messages/ja'),
  zh: () => import('./messages/zh'),
};

export async function loadCatalog(locale: Locale | typeof PSEUDO): Promise<Catalog> {
  if (locale === PSEUDO) return pseudoCatalog(en);
  return locale === 'en' ? en : (await LOADERS[locale]()).default;
}
