import type { Catalog, Plural } from './index';

const ACCENTS: Record<string, string> = {
  a: 'å',
  b: 'ƀ',
  c: 'ç',
  d: 'ð',
  e: 'é',
  f: 'ƒ',
  g: 'ĝ',
  h: 'ĥ',
  i: 'î',
  j: 'ĵ',
  k: 'ķ',
  l: 'ļ',
  m: 'ɱ',
  n: 'ñ',
  o: 'ö',
  p: 'þ',
  q: 'ǫ',
  r: 'ŕ',
  s: 'š',
  t: 'ţ',
  u: 'û',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ý',
  z: 'ž',
  A: 'Å',
  B: 'Ɓ',
  C: 'Ç',
  D: 'Ð',
  E: 'É',
  F: 'Ƒ',
  G: 'Ĝ',
  H: 'Ĥ',
  I: 'Î',
  J: 'Ĵ',
  K: 'Ķ',
  L: 'Ļ',
  M: 'Ṁ',
  N: 'Ñ',
  O: 'Ö',
  P: 'Þ',
  Q: 'Ǫ',
  R: 'Ŕ',
  S: 'Š',
  T: 'Ţ',
  U: 'Û',
  V: 'Ṽ',
  W: 'Ŵ',
  X: 'Ẋ',
  Y: 'Ý',
  Z: 'Ž',
};

/** Marks one message: accented letters in ⟦ ⟧, placeholders kept, a third longer (as French or Russian can be). */
export function pseudo(s: string): string {
  const body = s.replace(/(\{\w+\})|[A-Za-z]/g, (m, ph: string | undefined) => ph ?? ACCENTS[m] ?? m);
  const pad = '·'.repeat(Math.ceil(s.replace(/\{\w+\}/g, '').length * 0.3));
  return `⟦${body}${pad}⟧`;
}

export function pseudoCatalog(en: Catalog): Catalog {
  const out: Record<string, string | Plural> = {};
  for (const [k, v] of Object.entries(en) as [string, string | Plural][])
    out[k] =
      typeof v === 'string'
        ? pseudo(v)
        : (Object.fromEntries(Object.entries(v).map(([c, s]) => [c, pseudo(s as string)])) as Plural);
  return out as Catalog;
}
