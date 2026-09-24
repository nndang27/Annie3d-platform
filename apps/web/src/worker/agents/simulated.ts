import {
  ASPECTS,
  downstreamOf,
  type Graph,
  type GraphOp,
  LOOK_PRESETS,
  MOTION_PRESETS,
  NODE_DEFS,
  type NodeKind,
  type NodeRecord,
  newId,
  nextZKey,
  upstreamOf,
} from '@annie3d/contracts';
import type { Agent, AgentAction, AgentInput } from './types';

/**
 * Deterministic stand-in for the real agent: understands the board edits the MVP needs
 * (look, duration, aspect, motion, headline, detail, export preset, packshots, run) and asks
 * when a request is ambiguous instead of guessing. Replies stream word by word like an LLM.
 */
const LOOK_WORDS: [RegExp, string][] = [
  [/\b(dark|lab|moody|tech)\b/, 'dark-lab'],
  [/\b(stone|water|waterfall|wet)\b/, 'stone-water'],
  [/\bvelvet\b/, 'velvet'],
  [/\b(pastel|splash)\b/, 'splash-pastel'],
  [/\b(botanical|podium|plants?|leaves)\b/, 'podium-botanical'],
  [/\b(studio|white|clean|plain)\b/, 'studio-light'],
];
const MOTION_WORDS: [RegExp, string][] = [
  [/\bturntable|spin\b/, 'turntable'],
  [/\borbit\b/, 'hero-orbit'],
  [/\bteardown|exploded?\b/, 'teardown-reveal'],
  [/\bsplash\b/, 'splash-hero'],
];
const MOOD = /\b(warmer|cooler|brighter|darker|softer|dramatic|golden hour|sunset|moody)\b/g;

interface Change {
  ops: GraphOp[];
  label: string;
  nodeIds: string[];
}

function label(n: NodeRecord) {
  return n.label ?? NODE_DEFS[n.kind].label;
}

/** Nodes of a kind the request can mean: around the selection, else the only one on the board. */
function targets(g: Graph, kind: NodeKind, selected: string[]): { nodes: NodeRecord[]; ambiguous: number } {
  const all = [...g.nodes.values()].filter((n) => n.kind === kind);
  if (selected.length) {
    const near = new Set<string>();
    for (const id of selected) {
      near.add(id);
      for (const d of downstreamOf(g, id)) near.add(d);
      for (const u of upstreamOf(g, id)) near.add(u);
    }
    const hit = all.filter((n) => near.has(n.id));
    if (hit.length) return { nodes: hit, ambiguous: 0 };
  }
  if (all.length <= 1) return { nodes: all, ambiguous: 0 };
  return { nodes: [], ambiguous: all.length };
}

export function plan(input: AgentInput): {
  changes: Change[];
  questions: string[];
  wantsRun: boolean;
  notes: string[];
} {
  const t = input.message.toLowerCase();
  const g = input.graph;
  const changes: Change[] = [];
  const questions: string[] = [];
  const notes: string[] = [];
  const edit = (kind: NodeKind, what: string, patch: (n: NodeRecord) => Record<string, unknown>) => {
    const { nodes, ambiguous } = targets(g, kind, input.nodeIds);
    if (ambiguous) {
      questions.push(
        `There are ${ambiguous} ${NODE_DEFS[kind].label} nodes. Select the one you mean (or a node in its line) and ask again.`,
      );
      return;
    }
    if (!nodes.length) {
      notes.push(`There is no ${NODE_DEFS[kind].label} node yet, so I skipped “${what}”.`);
      return;
    }
    // Skip nodes that already have these values: a no-op edit would only confuse the user.
    const real = nodes.filter((n) => Object.entries(patch(n)).some(([k, v]) => n.settings[k] !== v));
    if (!real.length) {
      notes.push(
        `${nodes.map(label).join(', ')} already ${nodes.length > 1 ? 'have' : 'has'} ${what.replace(/^.*→\s*/, '')}.`,
      );
      return;
    }
    changes.push({
      ops: real.map((n) => ({ type: 'node.update' as const, id: n.id, patch: { settings: patch(n) } })),
      label: `${real.map(label).join(', ')}: ${what}`,
      nodeIds: real.map((n) => n.id),
    });
  };

  const look = LOOK_WORDS.find(([re]) => re.test(t))?.[1];
  const moods = [...new Set(t.match(MOOD) ?? [])];
  if (look && /\b(stage|look|scene|background|set)\b|dark|stone|velvet|pastel|botanical|studio/.test(t)) {
    const l = LOOK_PRESETS.find((p) => p.id === look)!;
    edit('stage', `look → ${l.label}`, () => ({ look }));
  }
  if (moods.length) {
    edit('stage', `direction: ${moods.join(', ')}`, (n) => {
      const prev = String(n.settings.prompt ?? '').trim();
      return { prompt: [prev, `${moods.join(', ')} light`].filter(Boolean).join('; ').slice(0, 2000) };
    });
  }
  const dur = /(\d{1,2})\s*-?\s*(?:s\b|sec|second)/.exec(t);
  if (dur) {
    const want = Number(dur[1]);
    const nearest = [6, 10, 15].reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
    edit('adVideo', `duration → ${nearest}s${nearest !== want ? ` (closest to ${want}s)` : ''}`, () => ({
      durationSec: nearest,
    }));
  }
  const aspect =
    ASPECTS.find((a) => t.includes(a)) ??
    (/\bsquare\b/.test(t)
      ? '1:1'
      : /\b(vertical|story|reel|tiktok)\b/.test(t)
        ? '9:16'
        : /\b(landscape|wide|youtube)\b/.test(t)
          ? '16:9'
          : null);
  if (aspect) edit('adVideo', `aspect → ${aspect}`, () => ({ aspect }));
  const motion = /\b(motion|move|camera|animation|animate)\b/.test(t)
    ? MOTION_WORDS.find(([re]) => re.test(t))?.[1]
    : undefined;
  if (motion)
    edit('adVideo', `motion → ${MOTION_PRESETS.find((m) => m.id === motion)!.label}`, () => ({ motion }));
  const headline = /headline\s*(?:to|:|=|is)?\s*["“'](.+?)["”']/.exec(input.message);
  if (headline) {
    const { nodes, ambiguous } = targets(g, 'text', input.nodeIds);
    const heads = nodes.filter((n) => n.settings.role === 'headline' || /headline/i.test(n.label ?? ''));
    if (ambiguous && !heads.length) {
      const all = [...g.nodes.values()].filter(
        (n) => n.kind === 'text' && (n.settings.role === 'headline' || /headline/i.test(n.label ?? '')),
      );
      if (all.length === 1) heads.push(all[0]!);
      else questions.push(`There are ${all.length} headlines. Select the line you mean and ask again.`);
    }
    if (heads.length)
      changes.push({
        ops: heads.map((n) => ({
          type: 'node.update' as const,
          id: n.id,
          patch: { settings: { text: headline[1]!.slice(0, 200) } },
        })),
        label: `Headline → “${headline[1]}”`,
        nodeIds: heads.map((n) => n.id),
      });
  }
  if (/\b(high|more) detail\b/.test(t)) edit('model3d', 'detail → high', () => ({ detail: 'high' }));
  if (/\bdraft\b/.test(t)) edit('model3d', 'detail → draft', () => ({ detail: 'draft' }));
  if (/\bswirl\b/.test(t)) edit('export', 'preset → Google Swirl', () => ({ glbPreset: 'google_swirl' }));
  else if (/\bmerchant|shopping\b/.test(t))
    edit('export', 'preset → Google Merchant', () => ({ glbPreset: 'google_merchant' }));
  if (/\badd (a |some |more )?packshots?\b/.test(t)) {
    const { nodes: models, ambiguous } = targets(g, 'model3d', input.nodeIds);
    const model = models[0];
    if (ambiguous) questions.push('Select the 3D model the packshots should come from.');
    else if (model) {
      const id = newId();
      changes.push({
        ops: [
          {
            type: 'node.create',
            node: {
              id,
              kind: 'packshot',
              x: model.x + 380,
              y: model.y + 360,
              label: 'Packshots (agent)',
              settings: { angles: 'four', size: '1k', camera: null },
              zKey: nextZKey(g),
            },
          },
          {
            type: 'edge.create',
            edge: { id: newId(), source: model.id, sourcePort: 'out', target: id, targetPort: 'subject' },
          },
        ],
        label: `Added a Packshot node from ${label(model)}`,
        nodeIds: [id],
      });
    }
  }
  // Not "make it": "make it square" is an edit, not a request to run (E2E, 2026-09-24).
  const wantsRun = /\b(run|render|generate|go ahead|do it)\b/.test(t);
  return { changes, questions, wantsRun, notes };
}

async function* words(text: string): AsyncGenerator<AgentAction> {
  for (const w of text.split(/(?<=\s)/)) {
    yield { type: 'text', delta: w };
    await new Promise((r) => setTimeout(r, 18));
  }
}

export const simulatedAgent: Agent = {
  id: 'sim-agent-1',
  async *respond(input) {
    const { changes, questions, wantsRun, notes } = plan(input);
    if (!changes.length && !questions.length && !wantsRun) {
      yield* words(
        'I can change the look of a Stage (dark lab, stone & water, velvet, pastel splash, botanical, studio), make it warmer or cooler, set the video to 6, 10 or 15 seconds, switch to 9:16, 1:1 or 16:9, change the motion, set the headline ("headline: ..."), add packshots, pick an export preset, and run it. Select nodes first to point me at a line.',
      );
      return;
    }
    for (const q of questions) yield* words(`${q} `);
    if (changes.length) {
      yield* words(changes.length === 1 ? 'Done: ' : `I made ${changes.length} changes: `);
      for (const c of changes) {
        yield { type: 'ops', ops: c.ops, label: c.label };
        yield* words(`${c.label}. `);
      }
    }
    for (const n of notes) yield* words(`${n} `);
    if (wantsRun && !questions.length) {
      const ids = changes.flatMap((c) => c.nodeIds);
      yield* words(
        ids.length
          ? 'Running what changed; unchanged nodes stay cached. '
          : 'Running the board; unchanged nodes stay cached. ',
      );
      yield { type: 'run', nodeId: null, scope: 'all' };
    } else if (changes.length) {
      yield* words('Say “run it” when you want to see the result.');
    }
  },
};
