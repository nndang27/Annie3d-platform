// @vitest-environment node
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without types
import { scan } from '../../../../scripts/i18n-scan.mjs';

/**
 * Every text a person can read goes through t() (docs/I18N.md). This fails on text written
 * straight into JSX, text attributes (aria-label, title, placeholder, alt, label) or toasts,
 * so a new feature cannot ship English-only by accident. The pseudo-locale E2E test catches
 * text that reaches the screen by other routes.
 */
describe('i18n guard', () => {
  it('finds no hard-coded UI text', () => {
    const found = (scan() as { file: string; line: number; text: string }[]).map(
      (f) => `${f.file}:${f.line} ${f.text}`,
    );
    expect(found).toEqual([]);
  });
});
