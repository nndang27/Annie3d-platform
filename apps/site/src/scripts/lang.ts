// The locale list only (the package entry also brings the English catalog: 44 KB for 3 constants).
import { movedTo } from '../../../../packages/contracts/src/origins';
import { COOKIE, isLocale, STORAGE_KEY } from '../../../../packages/i18n/src/locales';

// A page opened on the old workers.dev address moves to annie3d.app.
const moved = movedTo(location, false);
if (moved) location.replace(moved);

/**
 * A link with `data-lang` is a language choice: the language switcher, and the canvas links of
 * a page in another language than English. The choice is kept where the app reads it
 * (localStorage and the cookie the Worker reads), so the app opens in the same language.
 * External file: the site's CSP (apps/web/public/_headers) allows no inline scripts.
 */
document.addEventListener('click', (e) => {
  const link = e.target instanceof Element ? e.target.closest('a[data-lang]') : null;
  const code = link?.getAttribute('data-lang');
  if (!isLocale(code)) return;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* storage blocked: the cookie still carries it */
  }
  // biome-ignore lint/suspicious/noDocumentCookie: a plain first-party cookie the app and Worker read
  document.cookie = `${COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
});
