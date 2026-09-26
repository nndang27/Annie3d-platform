import { createTranslator } from '@annie3d/i18n';
import { CATALOGS } from '@annie3d/i18n/all';
import { describe, expect, it } from 'vitest';
import { boardTitle, nodeName } from './i18n';

describe('names the product wrote follow the language; names people typed stay', () => {
  const vi = createTranslator('vi', CATALOGS.vi);
  it('node names', () => {
    expect(nodeName(vi, { kind: 'stage', label: null })).toBe(vi('node.stage'));
    // A board saved before the app spoke Vietnamese: "Stage" was written by a starter.
    expect(nodeName(vi, { kind: 'stage', label: 'Stage' })).toBe(vi('node.stage'));
    expect(nodeName(vi, { kind: 'photo', label: 'Product photo' })).toBe(vi('starter.node.photo'));
    expect(nodeName(vi, { kind: 'photo', label: 'Product photo (serum)' })).toBe(
      vi('board.exampleLabel', { label: vi('starter.node.photo'), product: vi('board.product.serum') }),
    );
    expect(nodeName(vi, { kind: 'stage', label: 'Kệ gỗ sồi' })).toBe('Kệ gỗ sồi');
    expect(nodeName(vi, { kind: 'stage', label: 'My stage' })).toBe('My stage');
  });
  it('board titles', () => {
    expect(boardTitle(vi, 'Example board')).toBe(vi('board.example'));
    expect(boardTitle(vi, 'Untitled board')).toBe(vi('board.untitled'));
    expect(boardTitle(vi, 'Spring launch')).toBe('Spring launch');
  });
});
