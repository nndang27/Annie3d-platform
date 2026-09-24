/// <reference types="node" />
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FEATURES, featureOf, matchesGlob } from '../features';

const root = join(__dirname, '../../../..');
function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (!/\.test\.tsx?$/.test(name)) out.push(relative(root, p).replaceAll('\\', '/'));
  }
  return out;
}

describe('feature registry (the two lists)', () => {
  it('every client and desktop-shell source file belongs to exactly one feature', () => {
    const all = [...files(join(root, 'apps/web/src/client')), ...files(join(root, 'apps/desktop/src'))];
    const orphans = all.filter((f) => !featureOf(f));
    expect(orphans).toEqual([]);
    const multi = all.filter(
      (f) => FEATURES.filter((x) => x.paths.some((g) => matchesGlob(f, g))).length > 1,
    );
    expect(multi).toEqual([]);
  });

  it('desktop-only code is marked as such, shared code is not', () => {
    expect(featureOf('apps/web/src/client/desktop/DesktopIntegration.tsx')?.surface).toBe('desktop');
    expect(featureOf('apps/desktop/src/main/webpack.ts')).toMatchObject({
      surface: 'desktop',
      layer: 'shell',
    });
    expect(featureOf('apps/web/src/client/canvas/clipboard.ts')).toMatchObject({
      surface: 'shared',
      layer: 'web',
    });
    expect(featureOf('node_modules/.pnpm/react@19/node_modules/react/index.js')?.id).toBe('libraries');
  });

  it('globs: * stays in one segment, ** crosses, {a,b} alternates', () => {
    expect(matchesGlob('a/b/c.ts', 'a/*/c.ts')).toBe(true);
    expect(matchesGlob('a/b/x/c.ts', 'a/*/c.ts')).toBe(false);
    expect(matchesGlob('a/b/x/c.ts', 'a/**')).toBe(true);
    expect(matchesGlob('a/y.tsx', 'a/{x,y}.{ts,tsx}')).toBe(true);
  });
});
