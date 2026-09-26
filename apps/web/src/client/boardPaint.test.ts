/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Board content is re-rastered at every zoom level. Each new blur size or gradient compiles a GPU
 * pipeline on first use, which stalls a frame for 50–250 ms on a cold shader cache (measured with
 * tests/perf/cold-compare.mjs and tests/perf/pipeline-trace.mjs; docs/DESKTOP.md). So rules that
 * style things on the board use borders, spread-only rings, hard offsets and flat fills.
 */
const BOARD = /\.(node|wire|react-flow|sim-thumb|refs|port|open-sim|run-split|drop-slot|overlay-btn)\b/;
const FIXED_UI = /\.(popover|toast|modal|perf-panel|update-pill|topbar|toolbar|agent|editor|sim-overlay)\b/;

/** Design-system shadow tokens (app.css :root): all of them are blurred. */
const BLURRED_TOKENS = /var\(--(raised|raised-sm|pressed|floating|shadow-popover|shadow-floating)\)/;

/** `box-shadow` layers with a blur radius above zero (third length), or a blurred token. */
function blurredShadow(value: string) {
  if (BLURRED_TOKENS.test(value)) return true;
  return value.split(/,(?![^(]*\))/).some((layer) => {
    const lengths =
      layer.replace(/rgba?\([^)]*\)|#[0-9a-f]+|var\([^)]*\)|inset/gi, '').match(/-?[\d.]+(px)?/g) ?? [];
    return lengths.length >= 3 && Number.parseFloat(lengths[2]!) > 0;
  });
}

function violations(css: string) {
  const found: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1]!.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!BOARD.test(selector) || FIXED_UI.test(selector)) continue;
    for (const [, prop, value] of m[2]!.matchAll(
      /(box-shadow|filter|background(?:-image)?)\s*:\s*([^;]+)/g,
    )) {
      const bad =
        (prop === 'box-shadow' && blurredShadow(value!)) ||
        (prop === 'filter' &&
          (/blur\(/.test(value!) || /drop-shadow\([^)]*\s[1-9][\d.]*px\s*(?:rgb|#|\w+\))/.test(value!))) ||
        (prop!.startsWith('background') && /gradient\(/.test(value!));
      if (bad) found.push(`${selector.split('\n').pop()} { ${prop}: ${value!.trim()} }`);
    }
  }
  return found;
}

/**
 * Safari (WebKit) repaints the whole zoomed board for every frame of a transition on it (13
 * frames over 25 ms, up to 68 ms, in a pointer sweep; 0 in Chrome). An element that animates on
 * the board sits on its own layer (`will-change: opacity`, see app.css) so it does not. SVG parts
 * cannot have a layer (wires: a stroke colour, measured as minor), and the progress bar only moves
 * during a run.
 */
const TRANSITION_EXEMPT = new Set([
  '.wire .react-flow__edge-path',
  '.wire-delete circle',
  '.node-preview .progress > i',
]);
const selectorsOf = (raw: string) =>
  raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(',')
    .map((x) => x.trim().replace(/\s+/g, ' '))
    .filter(Boolean);

function transitionsWithoutLayer(css: string) {
  const layered = new Set<string>();
  const animated: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = m[2]!;
    if (/will-change\s*:\s*[^;]*opacity/.test(body)) for (const sel of selectorsOf(m[1]!)) layered.add(sel);
    const tr = body.match(/(?:^|;|\s)transition\s*:\s*([^;]+)/);
    if (tr && !/^none\b/.test(tr[1]!.trim()))
      for (const sel of selectorsOf(m[1]!)) if (BOARD.test(sel) && !FIXED_UI.test(sel)) animated.push(sel);
  }
  return animated.filter((sel) => !layered.has(sel) && !TRANSITION_EXEMPT.has(sel));
}

describe('board paint', () => {
  it('puts every transition on the board on its own layer (Safari)', () => {
    const css = readFileSync(join(process.cwd(), 'apps/web/src/client/app.css'), 'utf8');
    expect(transitionsWithoutLayer(css)).toEqual([]);
    expect(transitionsWithoutLayer('.node-x .badge { transition: opacity 120ms; }')).toEqual([
      '.node-x .badge',
    ]);
    expect(
      transitionsWithoutLayer(
        '.node-x .badge { transition: opacity 120ms; } .node-x .badge { will-change: opacity; }',
      ),
    ).toEqual([]);
  });

  it('uses no blurred shadows, blur filters or gradients on board content', () => {
    const css = readFileSync(join(process.cwd(), 'apps/web/src/client/app.css'), 'utf8');
    expect(violations(css)).toEqual([]);
  });

  it('flags the patterns it is meant to catch', () => {
    expect(violations('.node-card { box-shadow: 0 8px 24px rgb(0 0 0 / 0.1); }')).toHaveLength(1);
    expect(violations('.wire .glow { filter: blur(3px); }')).toHaveLength(1);
    expect(violations('.sim-thumb x { background: radial-gradient(#000, #fff); }')).toHaveLength(1);
    expect(violations('.node-card { box-shadow: 0 0 0 1px #2f7cf6, 0 1px 0 rgb(0 0 0 / 0.04); }')).toEqual(
      [],
    );
    expect(violations('.popover { box-shadow: 0 8px 24px rgb(0 0 0 / 0.1); }')).toEqual([]);
  });
});
