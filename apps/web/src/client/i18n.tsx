import type { DesktopBridge } from '@annie3d/contracts/desktop';
import {
  COOKIE,
  createTranslator,
  en,
  isLocale,
  type Locale,
  loadCatalog,
  type MessageKey,
  negotiate,
  type ParamsOf,
  PSEUDO,
  STORAGE_KEY,
  splitTemplate,
  type Translator,
} from '@annie3d/i18n';
import { Fragment, type ReactNode } from 'react';
import { create } from 'zustand';

/**
 * The app's language. Every text on screen goes through `t` (`useT()` in components), so a
 * change of language re-renders everything with no reload. See docs/I18N.md.
 *
 * Choice order: the person's pick (localStorage, and a cookie the Worker reads for its own
 * messages and pages), then the browser's languages, then English. `?lang=xx` overrides for a
 * link; `?lang=en-XA` is the test pseudo-locale.
 */
type Lang = Locale | typeof PSEUDO;
export const useI18n = create<{ t: Translator }>()(() => ({ t: createTranslator('en', en) }));

/** The translator; components re-render when the language changes. */
export const useT = () => useI18n((s) => s.t);
/** Outside React (toasts, sockets, canvas drawing): the current language at call time. */
export const t: Translator = new Proxy((() => '') as unknown as Translator, {
  apply: (_f, _this, args: Parameters<Translator>) =>
    (useI18n.getState().t as (...a: unknown[]) => string)(...args),
  get: (_f, p) => useI18n.getState().t[p as keyof Translator],
});

function stored(): Lang | null {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === PSEUDO || isLocale(q)) return q;
    const v = localStorage.getItem(STORAGE_KEY);
    if (isLocale(v)) return v;
  } catch {
    /* storage blocked: fall back to the browser's languages */
  }
  const c = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1];
  return isLocale(c) ? c : null;
}

export const initialLocale = (): Lang => stored() ?? negotiate(navigator.languages ?? [navigator.language]);

async function apply(locale: Lang) {
  const catalog = await loadCatalog(locale);
  const tr = createTranslator(locale, catalog);
  document.documentElement.lang = tr.tag;
  useI18n.setState({ t: tr });
  (window as { annieDesktop?: DesktopBridge }).annieDesktop?.setLocale?.(locale === PSEUDO ? 'en' : locale);
}

/** Before the first render: English is built in, another language loads its one file first. */
export async function initLocale() {
  const l = initialLocale();
  if (l !== 'en') await apply(l).catch(() => apply('en'));
  else document.documentElement.lang = 'en';
}

/** The person picks a language: remembered in this browser and sent to the server as a cookie. */
export async function setLocale(locale: Locale) {
  // Kept first, so a reload (below) opens in the chosen language.
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* private mode: the cookie still carries it */
  }
  // biome-ignore lint/suspicious/noDocumentCookie: a plain first-party cookie the Worker reads
  document.cookie = `${COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  try {
    await apply(locale);
  } catch {
    // The language's file could not load: after a deploy, a page opened earlier asks for a
    // file name that no longer exists. A reload gets the new names and the chosen language.
    location.reload();
  }
}

/**
 * Rich text: placeholders filled with React nodes (a <kbd>, a link, a styled number), so a
 * sentence stays one message and each language can put the pieces where its grammar wants.
 */
export function rich<K extends MessageKey>(
  tr: Translator,
  key: K,
  params: ParamsOf<K, ReactNode>,
): ReactNode {
  const count = (params as Record<string, unknown>).count;
  return splitTemplate(tr.template(key, typeof count === 'number' ? count : undefined)).map((p, i) =>
    typeof p === 'string' ? (
      <Fragment key={i}>{p}</Fragment>
    ) : (
      <Fragment key={i}>{fill((params as Record<string, ReactNode>)[p.name], tr)}</Fragment>
    ),
  );
}
const fill = (v: ReactNode, tr: Translator) => (typeof v === 'number' ? tr.number(v) : v);

/**
 * Names the product wrote in English into boards saved before the app spoke other languages
 * (a starter's "Stage", "Product photo (serum)", the title "Example board"). Shown in the chosen
 * language, like a label left empty; a name a person typed stays as typed.
 */
const PRODUCT_NAMES: Map<string, (tr: Translator) => string> = (() => {
  const m = new Map<string, (tr: Translator) => string>();
  for (const [k, v] of Object.entries(en) as [MessageKey, unknown][]) {
    if (typeof v !== 'string') continue;
    if (/^(node\.[^.]+|starter\.node\.[^.]+)$/.test(k))
      m.set(v, (tr) => tr(k as MessageKey & `node.${string}`));
  }
  for (const [k, v] of Object.entries(en) as [MessageKey, unknown][]) {
    if (!k.startsWith('board.product.') || typeof v !== 'string') continue;
    const product = k as MessageKey & `board.product.${string}`;
    const label = en['starter.node.photo'];
    m.set(`${label} (${v})`, (tr) =>
      tr('board.exampleLabel', { label: tr('starter.node.photo'), product: tr(product) }),
    );
  }
  return m;
})();
const DEFAULT_TITLES: Record<
  string,
  MessageKey & ('board.example' | 'board.untitled' | 'app.board.firstTitle')
> = {
  [en['board.example']]: 'board.example',
  [en['board.untitled']]: 'board.untitled',
  [en['app.board.firstTitle']]: 'app.board.firstTitle',
};

/** A node's name: its label, or the language's name for its kind (and for product-written names). */
export function nodeName(tr: Translator, n: { kind: string; label?: string | null }): string {
  if (!n.label) return tr(`node.${n.kind}` as MessageKey & `node.${string}`);
  return PRODUCT_NAMES.get(n.label)?.(tr) ?? n.label;
}

/** A board title: a default title the product wrote follows the language; a typed one stays. */
export function boardTitle(tr: Translator, title: string): string {
  const key = DEFAULT_TITLES[title];
  return key ? tr(key) : title;
}
