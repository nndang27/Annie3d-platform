import { expect, type Page, test } from '@playwright/test';
import { firstNode, openCanvas, signUp } from './helpers';

/**
 * Pseudo-locale sweep (docs/I18N.md): with `?lang=en-XA` every message is shown as ⟦Åççéñţéð⟧.
 * Any word on screen outside the brackets reached the page without going through t(), from a
 * constant, a server message, a canvas label, an aria-label… This catches what the static guard
 * (i18n.guard.test.ts) cannot see. Each screen and menu of the app is opened in turn.
 */

/** Words that stay literal in every language (docs/I18N.md rule 7), units and third-party credits. */
const LITERAL =
  /^(Annie|GLB|MP4|PNG|ZIP|WebP|TikTok|Google|Merchant|Swirl|React|Flow|px|KB|MB|fps|ms|TTFB|FCP|LCP|CLS|INP|v\d+|x)$/;

async function untranslated(page: Page, where: string): Promise<string[]> {
  const found = await page.evaluate((literal) => {
    const re = new RegExp(literal);
    // React Flow's credit link (the library's own) and people's own content (translate="no").
    const SKIP = 'script,style,noscript,.react-flow__attribution,[translate="no"]';
    const docLang = document.documentElement.lang;
    const out: string[] = [];
    // Messages can hold other messages (⟦Model or scene (⟦3D model⟧ or ⟦Scene⟧)⟧): innermost first.
    const strip = (text: string) => {
      let prev = '';
      let cur = text;
      while (cur !== prev) {
        prev = cur;
        cur = cur.replace(/⟦[^⟦⟧]*⟧/g, ' ');
      }
      return cur;
    };
    // Sample addresses shown as content (a mock shop URL, the phone link) are not words to translate.
    const URLISH = /\b(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+(?::\d+)?(?:\/\S*)?|localhost:\d+\S*/g;
    const bad = (text: string) =>
      (
        strip(text)
          .replace(URLISH, ' ')
          .match(/\p{L}{2,}/gu) ?? []
      ).filter((w) => !re.test(w));
    // A subtree in another language on purpose (the language list's native names) is skipped.
    const foreign = (el: Element | null) => {
      const l = el?.closest('[lang]')?.getAttribute('lang');
      return !!l && l !== docLang;
    };
    // Rich messages span several text nodes (⟦Open it through the <a>link</a> …⟧): track the
    // bracket depth across nodes in document order and check only text outside any message.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let depth = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      const text = n.textContent ?? '';
      let outside = '';
      for (const ch of text) {
        if (ch === '⟦') depth++;
        else if (ch === '⟧') depth = Math.max(0, depth - 1);
        else if (depth === 0) outside += ch;
      }
      if (!el || el.closest(SKIP) || foreign(el)) continue;
      if (bad(outside).length)
        out.push(
          `text "${text.trim().slice(0, 60)}" in <${el.tagName.toLowerCase()} class="${el.className}">`,
        );
    }
    for (const el of document.body.querySelectorAll('[aria-label],[title],[placeholder],[alt]')) {
      if (el.closest(SKIP) || foreign(el)) continue;
      for (const a of ['aria-label', 'title', 'placeholder', 'alt']) {
        const v = el.getAttribute(a);
        if (v && bad(v).length) out.push(`${a}="${v.slice(0, 60)}" on <${el.tagName.toLowerCase()}>`);
      }
    }
    if (bad(document.title).length) out.push(`document.title "${document.title}"`);
    return out;
  }, LITERAL.source);
  return [...new Set(found)].map((f) => `${where}: ${f}`);
}

test.describe('every text is translated (pseudo-locale)', () => {
  test('board, menus, agent, palette, dialogs, editor and simulator', async ({ page }) => {
    const errors = await openCanvas(page, '/?lang=en-XA');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    const all: string[] = [];
    const sweep = async (where: string) => all.push(...(await untranslated(page, where)));
    const close = () => page.keyboard.press('Escape');

    await sweep('board');
    const model = await firstNode(page, 'model3d');
    await page.locator(`.react-flow__node[data-id="${model}"]`).hover();
    await page.locator(`.react-flow__node[data-id="${model}"] [data-testid=open-3d]`).click();
    await expect(page.getByTestId('editor')).toBeVisible();
    await expect(page.locator('.editor-loading-inline')).toHaveCount(0, { timeout: 20_000 });
    await sweep('editor');
    await page.getByTestId('editor-back').click();
    await expect(page.getByTestId('editor')).toHaveCount(0);
    await page.getByTestId('file-menu').click();
    await sweep('file menu');
    await close();
    await page.getByTestId('starters-button').click();
    await sweep('templates menu');
    await close();
    await page.getByTestId('language-button').click();
    await sweep('language menu');
    await close();
    await page.getByTestId('run-options').first().click();
    await sweep('run menu');
    await close();
    const node = page.locator('.react-flow__node').first();
    await node.click();
    await sweep('selected node toolbar');
    await page.getByTestId('node-more').first().click();
    await sweep('node more menu');
    await close();
    await page.getByTestId('more-nodes').click();
    await sweep('palette');
    await close();
    await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 30, y: 300 } });
    await sweep('context menu');
    await close();
    await page.getByTestId('toggle-agent').click();
    await sweep('agent panel');
    await page.getByTestId('toggle-agent').click();
    await page.getByTestId('run-all').click();
    await sweep('sign-in prompt');
    await close();

    const sim = await firstNode(page, 'simulation');
    await page.locator(`.react-flow__node[data-id="${sim}"]`).getByTestId('open-sim').click();
    const overlay = page.getByTestId('simulator');
    await expect(overlay).toBeVisible();
    for (const env of ['shop', 'sticker', 'showroom', 'tiktok'] as const) {
      await overlay.getByTestId(`sim-env-${env}`).click();
      await sweep(`simulator ${env}`);
    }
    await close();
    await expect(overlay).toHaveCount(0);

    expect(all).toEqual([]);
    // Google's sign-in script logs an abort when the sign-in prompt closes, and WebKit a benign
    // ResizeObserver notice (both not ours; helpers.ts ignores the latter too).
    expect(errors.filter((e) => !/GSI_LOGGER|request has been aborted|ResizeObserver/.test(e))).toEqual([]);
  });

  test('signed in: account, credits, run and export dialogs, and server messages', async ({ page }) => {
    await page.goto('/?lang=en-XA');
    await signUp(page);
    await openCanvas(page, '/?lang=en-XA');
    const all: string[] = [];
    const sweep = async (where: string) => all.push(...(await untranslated(page, where)));
    await sweep('signed-in board');
    await page.getByTestId('account').click();
    await sweep('account menu');
    await page.keyboard.press('Escape');
    await page.getByTestId('credits').click();
    await expect(page.getByTestId('billing-dialog')).toBeVisible();
    await sweep('billing dialog');
    await page.keyboard.press('Escape');
    await page.getByTestId('run-all').click();
    await expect(page.getByTestId('run-dialog')).toBeVisible();
    await sweep('run dialog');
    await page.keyboard.press('Escape');
    // A server error comes back in the page's language (the Worker reads the language cookie).
    const res = await page.evaluate(async () => {
      // biome-ignore lint/suspicious/noDocumentCookie: the app's own language cookie
      document.cookie = 'annie3d_lang=vi; path=/';
      const r = await fetch('/api/boards/00000000-0000-7000-8000-000000000000');
      return { lang: r.headers.get('content-language'), body: await r.json() };
    });
    expect(res.lang).toBe('vi');
    expect(res.body.error.code).toBeTruthy();
    expect(all).toEqual([]);
  });
});

/**
 * Every language fits: French or Russian run a third longer than English, and Chinese, Japanese
 * and Korean use other fonts. For each language, on a laptop and a phone: the bars do not
 * overflow and no button or label cuts its text. Screenshots land in test-results/i18n/.
 */
const CODES = ['en', 'vi', 'fr', 'pt', 'es', 'it', 'ru', 'ko', 'ja', 'zh'] as const;
test.describe('every language fits', () => {
  for (const code of CODES) {
    test(`${code}: top bar, toolbar and node controls fit`, async ({ page }) => {
      const problems: string[] = [];
      for (const size of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(size);
        await openCanvas(page, `/?lang=${code}`);
        expect(await page.evaluate(() => document.documentElement.lang)).toMatch(new RegExp(`^${code}`));
        problems.push(
          ...(await page.evaluate((w) => {
            const out: string[] = [];
            const visible = (el: Element) => (el as HTMLElement).offsetParent !== null;
            for (const bar of document.querySelectorAll('.topbar, .toolbar')) {
              const b = bar as HTMLElement;
              if (b.scrollWidth > b.clientWidth + 1)
                out.push(
                  `${w}px: .${b.className.split(' ')[0]} overflows by ${b.scrollWidth - b.clientWidth}px`,
                );
              const r = b.getBoundingClientRect();
              if (r.right > innerWidth + 1 || r.left < -1)
                out.push(`${w}px: .${b.className.split(' ')[0]} leaves the screen`);
            }
            const controls = document.querySelectorAll(
              '.topbar button, .toolbar button, .node-foot button, .node-foot select, .node-head, .run-split button',
            );
            for (const el of controls) {
              const e = el as HTMLElement;
              if (!visible(e)) continue;
              if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== 'ellipsis')
                out.push(
                  `${w}px: "${e.textContent?.trim().slice(0, 40)}" is cut (${e.scrollWidth} > ${e.clientWidth})`,
                );
            }
            return out;
          }, size.width)),
        );
        await page.screenshot({ path: `test-results/i18n/${code}-${size.width}.png` });
      }
      expect(problems).toEqual([]);
    });
  }
});

test('picking a language switches the page at once and is remembered', async ({ page }) => {
  await openCanvas(page);
  await expect(page.getByTestId('run-all')).toContainText('Run all');
  await page.getByTestId('language-button').click();
  await expect(page.getByTestId('language-menu').getByRole('menuitemradio')).toHaveText([
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
  await page.getByTestId('language-vi').click();
  await expect(page.getByTestId('run-all')).toContainText('Chạy tất cả');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('vi');
  await page.reload();
  await expect(page.getByTestId('run-all')).toContainText('Chạy tất cả');
  await page.getByTestId('language-button').click();
  await page.getByTestId('language-en').click();
  await expect(page.getByTestId('run-all')).toContainText('Run all');
});
