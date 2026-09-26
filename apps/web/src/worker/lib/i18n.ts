import {
  isLocale,
  type Locale,
  localeFromCookie,
  type MessageKey,
  negotiate,
  type Params,
  parseAcceptLanguage,
  type Translator,
} from '@annie3d/i18n';
import { translator } from '@annie3d/i18n/all';
import type { Context } from 'hono';

export type { Locale, MessageKey, Translator };
export { translator };

/**
 * The language of a request (docs/I18N.md): the person's pick (cookie `annie3d_lang`, set by the
 * web app), else the browser's languages (Accept-Language), else English.
 */
export function localeOf(req: Request): Locale {
  return (
    localeFromCookie(req.headers.get('cookie')) ??
    negotiate(parseAcceptLanguage(req.headers.get('accept-language')))
  );
}

/** A stored locale (run params, ...) or English. */
export const asLocale = (v: unknown): Locale => (isLocale(v) ? v : 'en');

/**
 * The translator for this request. Marks the response as being in that language
 * (`Content-Language`), so call it only for responses that carry translated text.
 */
export function tFor(c: Context): Translator {
  const t = translator(localeOf(c.req.raw));
  c.header('content-language', t.tag);
  return t;
}

type Values = Record<string, string | number>;
const call = (t: Translator, key: MessageKey, params?: Values) =>
  (t as unknown as (k: MessageKey, p?: Values) => string)(key, params);

/**
 * A key built at run time (`port.${kind}.${id}`, `api.gate.${id}`): its text, or `fallback`
 * when the catalog has no such key.
 */
export function tDynamic(t: Translator, key: string, fallback: string, params?: Values): string {
  const s = call(t, key as MessageKey, params);
  return s === key ? fallback : s;
}

/**
 * An error whose text is a message key, translated where it reaches a person: the error
 * handler for HTTP errors, the run's language for run events. `message` stays English for logs.
 */
export class LocalizedError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly params?: Values,
  ) {
    super(call(translator('en'), key, params));
  }
  in(t: Translator): string {
    return call(t, this.key, this.params);
  }
}

export function localized<K extends MessageKey>(key: K, ...params: Params<K>): LocalizedError {
  return new LocalizedError(key, params[0] as Values | undefined);
}

/** Text of any error for a person: translated when it has a key, else its own message. */
export const errorText = (e: unknown, t: Translator): string =>
  e instanceof LocalizedError ? e.in(t) : e instanceof Error ? e.message : String(e);

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );

export { escapeHtml };

/**
 * HTML for a message with markup inside the sentence: the translated text is escaped, then
 * each `{name}` is replaced by the given (already safe) HTML.
 */
export function richHtml(t: Translator, key: MessageKey, html: Record<string, string>): string {
  return escapeHtml(t.template(key)).replace(/\{(\w+)\}/g, (all, name: string) => html[name] ?? all);
}
