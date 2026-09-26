import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isLocale, type Locale, negotiate, type Translator, tagOf } from '@annie3d/i18n';
import { translator } from '@annie3d/i18n/all';
import { app } from 'electron';

/**
 * The shell's language (menus, dialogs, window titles). The person's pick in the page reaches
 * the shell through `annieDesktop.setLocale` and is kept in `<userData>/locale.json`, so the
 * next start shows the menus in that language before any page loads. Without a pick: the
 * system's preferred languages, as the web app negotiates from `navigator.languages`.
 */
const file = () => join(app.getPath('userData'), 'locale.json');

function stored(): Locale | null {
  try {
    const v = (JSON.parse(readFileSync(file(), 'utf8')) as { locale?: unknown }).locale;
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

let current: Locale | null = null;
export function locale(): Locale {
  current ??= stored() ?? negotiate(app.getPreferredSystemLanguages());
  return current;
}
export const t = (): Translator => translator(locale());

/**
 * Chromium's own text in the page (form validation bubbles, file inputs, date pickers) and
 * `navigator.languages` follow `--lang`, which only applies at start: a pick made in this
 * session reaches them at the next start. Call before `ready`, after userData is set.
 */
export function applyStartupLanguage() {
  const l = stored();
  if (l) app.commandLine.appendSwitch('lang', tagOf(l));
}

/** The page picked a language: remember it; returns whether it changed (menus to rebuild). */
export function setLocale(code: unknown): boolean {
  if (!isLocale(code)) return false;
  const changed = code !== locale();
  current = code;
  if (stored() !== code) {
    try {
      writeFileSync(file(), JSON.stringify({ locale: code }));
    } catch {
      /* read-only profile: the pick still applies to this session */
    }
  }
  return changed;
}

/**
 * Board-file errors come from the shared ZIP reader (packages/contracts/src/zip.ts) in English;
 * each known message is shown in the shell's language. Unknown ones (system errors) stay as is.
 */
const ZIP_MESSAGES: [RegExp, (tr: Translator, name: string) => string][] = [
  [/^The file is larger than 2 GB$/, (tr) => tr('desktop.file.tooLarge')],
  [/^Not an Annie 3D file \(or a newer version\)$/, (tr) => tr('desktop.file.notBoardOrNewer')],
  [/^Not an Annie 3D file$/, (tr) => tr('desktop.file.notBoard')],
  [/^The file is damaged$/, (tr) => tr('desktop.file.damaged')],
  [/^Multi-part archives are not board files$/, (tr) => tr('desktop.file.multiPart')],
  [/^ZIP64 archives are not board files$/, (tr) => tr('desktop.file.zip64')],
  [/^The file has too many entries$/, (tr) => tr('desktop.file.tooManyEntries')],
  [/^Encrypted files are not board files$/, (tr) => tr('desktop.file.encrypted')],
  [/^Duplicate entry (.*)$/s, (tr, name) => tr('desktop.file.duplicateEntry', { name })],
  [/^Unsupported compression$/, (tr) => tr('desktop.file.unsupportedCompression')],
  [/^The board description is too large$/, (tr) => tr('desktop.file.descriptionTooLarge')],
  [/^Unexpected entry (.*)$/s, (tr, name) => tr('desktop.file.unexpectedEntry', { name })],
  [
    /^(.*) is compressed; board files store media as they are$/s,
    (tr, name) => tr('desktop.file.compressedMedia', { name }),
  ],
];

export function zipErrorText(message: string): string {
  for (const [re, text] of ZIP_MESSAGES) {
    const m = re.exec(message);
    if (m) return text(t(), m[1] ?? '');
  }
  return message;
}
