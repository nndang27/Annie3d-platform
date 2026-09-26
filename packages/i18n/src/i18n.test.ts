import {
  GLB_PRESETS,
  LOOK_PRESETS,
  MOTION_PRESETS,
  NODE_DEFS,
  NODE_KINDS,
  PORT_TYPES,
  SIM_ENVIRONMENTS,
  STARTERS,
} from '@annie3d/contracts';
import { describe, expect, it } from 'vitest';
import { CATALOGS } from './all';
import {
  type Catalog,
  createTranslator,
  en,
  LOCALES,
  negotiate,
  type Plural,
  parseAcceptLanguage,
} from './index';
import { NAMESPACES } from './messages/en';
import { pseudo } from './pseudo';

const vars = (s: string) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
const forms = (v: string | Plural) => (typeof v === 'string' ? { other: v } : v) as Record<string, string>;

/** Area prefixes per English file: a key belongs to exactly one file. */
const PREFIXES: Record<keyof typeof NAMESPACES, string[]> = {
  common: ['common.'],
  contracts: [
    'node.',
    'engine.',
    'category.',
    'port.',
    'portType.',
    'look.',
    'motion.',
    'glbPreset.',
    'simEnv.',
    'starter.',
    'setting.',
  ],
  chrome: [
    'app.',
    'topbar.',
    'toolbar.',
    'palette.',
    'menu.',
    'agent.',
    'dialog.',
    'perf.',
    'signin.',
    'update.',
    'lang.',
  ],
  canvas: ['canvas.', 'board.', 'run.', 'reel.', 'file.'],
  editor: ['editor.'],
  sim: ['sim.'],
  api: ['api.'],
  desktop: ['desktop.'],
  site: ['site.', 'share.'],
};

describe('English source', () => {
  it('each file only uses its own prefixes, so no key is defined twice', () => {
    const seen = new Map<string, string>();
    for (const [ns, msgs] of Object.entries(NAMESPACES)) {
      for (const key of Object.keys(msgs)) {
        expect(
          PREFIXES[ns as keyof typeof NAMESPACES].some((p) => key.startsWith(p)),
          `${key} in ${ns}`,
        ).toBe(true);
        expect(seen.get(key), `${key} defined in ${seen.get(key)} and ${ns}`).toBeUndefined();
        seen.set(key, ns);
      }
    }
  });

  it('names every node kind, port, preset and starter from the contracts', () => {
    const keys = new Set(Object.keys(en));
    const need = [
      ...NODE_KINDS.flatMap((k) => [`node.${k}`, `engine.${k}`]),
      ...NODE_KINDS.flatMap((k) => [
        ...NODE_DEFS[k].inputs.map((p) => `port.${k}.${p.id}`),
        ...(NODE_DEFS[k].output ? [`port.${k}.out`] : []),
      ]),
      ...[...new Set(NODE_KINDS.map((k) => NODE_DEFS[k].category))].map((c) => `category.${c}`),
      ...PORT_TYPES.map((p) => `portType.${p}`),
      ...LOOK_PRESETS.map((p) => `look.${p.id}`),
      ...MOTION_PRESETS.map((p) => `motion.${p.id}`),
      ...Object.keys(GLB_PRESETS).map((p) => `glbPreset.${p}`),
      ...SIM_ENVIRONMENTS.map((e) => `simEnv.${e}`),
      ...STARTERS.flatMap((s) =>
        ['title', 'vertical', 'description', 'headline'].map((f) => `starter.${s}.${f}`),
      ),
    ];
    expect(need.filter((k) => !keys.has(k))).toEqual([]);
  });
});

describe.each(LOCALES.filter((l) => l.code !== 'en'))('$name ($code)', ({ code, tag }) => {
  const catalog = CATALOGS[code] as Catalog;
  const categories = new Intl.PluralRules(tag).resolvedOptions().pluralCategories;

  it('has exactly the English keys', () => {
    expect(Object.keys(catalog).sort()).toEqual(Object.keys(en).sort());
  });

  it('keeps every placeholder, and has the plural forms the language needs', () => {
    const problems: string[] = [];
    for (const [key, source] of Object.entries(en) as [keyof Catalog, string | Plural][]) {
      const src = forms(source);
      const got = forms(catalog[key] as string | Plural);
      const allowed = vars(Object.values(src).join(' '));
      for (const [form, text] of Object.entries(got)) {
        if (!text.trim()) problems.push(`${key}.${form}: empty`);
        for (const v of vars(text)) if (!allowed.has(v)) problems.push(`${key}.${form}: unknown {${v}}`);
      }
      // `other` carries every placeholder (`one` may say "un crédit" without {count}).
      for (const v of vars(src.other!))
        if (!vars(got.other ?? '').has(v)) problems.push(`${key}: lost {${v}}`);
      if (typeof source !== 'string')
        for (const c of categories) if (!got[c]) problems.push(`${key}: no "${c}" form`);
    }
    expect(problems).toEqual([]);
  });

  it('is translated (text equal to English only where the file lists it)', async () => {
    const mod = (await import(`./messages/${code}.ts`)) as { sameAsEnglish?: readonly string[] };
    const allowed = new Set([...(mod.sameAsEnglish ?? []), ...SAME_EVERYWHERE]);
    const untranslated = (Object.keys(en) as (keyof Catalog)[]).filter(
      (k) =>
        !allowed.has(k) &&
        JSON.stringify(catalog[k]) === JSON.stringify(en[k]) &&
        /\p{L}{3}/u.test(JSON.stringify(en[k])),
    );
    expect(untranslated).toEqual([]);
  });
});

/** Names that stay as they are in every language. */
const SAME_EVERYWHERE = new Set([
  'common.brand',
  // Plan names are product names (like Canva's "Pro").
  'dialog.billing.plan.creator',
  'dialog.billing.plan.studio',
  'api.plan.creator',
  'api.plan.studio',
  'glbPreset.google_merchant',
  'glbPreset.google_swirl',
  'simEnv.tiktok',
]);

describe('language list', () => {
  it('names each language in that language, with no flags (a flag is a country, not a language)', () => {
    expect(LOCALES.map((l) => l.name)).toEqual([
      'English',
      'Tiếng Việt',
      'Français',
      'Português',
      'Español',
      'Italiano',
      'Русский',
      '한국어',
      '日本語',
      '简体中文',
    ]);
    // Regional-indicator pairs are how flag emoji are written.
    const flag = /\p{Regional_Indicator}/u;
    expect(LOCALES.filter((l) => flag.test(l.name))).toEqual([]);
    expect(
      Object.entries(CATALOGS)
        .filter(([, c]) => flag.test(JSON.stringify(c)))
        .map(([k]) => k),
    ).toEqual([]);
  });
});

describe('translator', () => {
  it('fills placeholders, formats numbers for the language and picks plural forms', () => {
    const t = createTranslator('en', en);
    expect(t('common.credits', { count: 1 })).toBe('1 credit');
    expect(t('common.credits', { count: 1234 })).toBe('1,234 credits');
    const ru = createTranslator('ru', {
      ...en,
      'common.credits': {
        one: '{count} кредит',
        few: '{count} кредита',
        many: '{count} кредитов',
        other: '{count} кредита',
      },
    });
    expect([1, 3, 5, 21, 1234.5].map((n) => ru('common.credits', { count: n }))).toEqual([
      '1 кредит',
      '3 кредита',
      '5 кредитов',
      '21 кредит',
      '1\u00a0234,5 кредита', // Intl groups with a no-break space
    ]);
  });

  it('negotiates languages from browser and header lists', () => {
    expect(negotiate(['pt-PT', 'en'])).toBe('pt');
    expect(negotiate(['zh-TW'])).toBe('zh');
    expect(negotiate(['de-DE', 'fr-CA'])).toBe('fr');
    expect(negotiate(['de'])).toBe('en');
    expect(parseAcceptLanguage('de;q=0.9, ja-JP, en;q=0.5')).toEqual(['ja-JP', 'de', 'en']);
  });

  it('pseudo-locale brackets text and keeps placeholders', () => {
    expect(pseudo('Run {count} nodes')).toMatch(/^⟦Ŕûñ \{count\} ñöðéš·+⟧$/);
  });
});
