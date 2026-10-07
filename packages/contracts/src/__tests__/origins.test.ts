import { describe, expect, it } from 'vitest';
import { CANONICAL_ORIGIN, LEGACY_ORIGINS, movedTo } from '../origins';

const at = (url: string) => {
  const u = new URL(url);
  return { origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash };
};

describe('origins', () => {
  it('moves a browser page from the old address to the same page on annie3d.app', () => {
    expect(movedTo(at(`${LEGACY_ORIGINS[0]}/s/abc?x=1#v`), false)).toBe(`${CANONICAL_ORIGIN}/s/abc?x=1#v`);
  });
  it('leaves the desktop app, annie3d.app itself and local builds where they are', () => {
    expect(movedTo(at(`${LEGACY_ORIGINS[0]}/`), true)).toBeNull();
    expect(movedTo(at(`${CANONICAL_ORIGIN}/home`), false)).toBeNull();
    expect(movedTo(at('http://localhost:4173/'), false)).toBeNull();
  });
});
