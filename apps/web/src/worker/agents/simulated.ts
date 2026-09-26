import {
  ASPECTS,
  downstreamOf,
  type Graph,
  type GraphOp,
  type LookPresetId,
  type MotionPresetId,
  type NodeKind,
  type NodeRecord,
  newId,
  nextZKey,
  upstreamOf,
} from '@annie3d/contracts';
import { type Translator, translator } from '../lib/i18n';
import type { Agent, AgentAction, AgentInput } from './types';

/**
 * Deterministic stand-in for the real agent: understands the board edits the MVP needs
 * (look, duration, aspect, motion, headline, detail, export preset, packshots, run) and asks
 * when a request is ambiguous instead of guessing. Replies stream word by word like an LLM, in
 * the person's language (`input.locale`); it understands English requests only.
 */
const LOOK_WORDS: [RegExp, LookPresetId][] = [
  [/\b(dark|lab|moody|tech)\b/, 'dark-lab'],
  [/\b(stone|water|waterfall|wet)\b/, 'stone-water'],
  [/\bvelvet\b/, 'velvet'],
  [/\b(pastel|splash)\b/, 'splash-pastel'],
  [/\b(botanical|podium|plants?|leaves)\b/, 'podium-botanical'],
  [/\b(studio|white|clean|plain)\b/, 'studio-light'],
];
const MOTION_WORDS: [RegExp, MotionPresetId][] = [
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

/** A node's name: the label people gave it, else its kind's name in their language. */
function label(t: Translator, n: NodeRecord) {
  return n.label ?? t(`node.${n.kind}`);
}

type ChangeKey =
  | 'api.agent.change.look'
  | 'api.agent.change.duration'
  | 'api.agent.change.aspect'
  | 'api.agent.change.motion'
  | 'api.agent.change.detail'
  | 'api.agent.change.preset';

/** A change to describe: its label (`look → Velvet`) and the value alone (`Velvet`). */
interface What {
  change: string;
  value: string;
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
  const tr = translator(input.locale);
  const name = (n: NodeRecord) => label(tr, n);
  const t = input.message.toLowerCase();
  const g = input.graph;
  const changes: Change[] = [];
  const questions: string[] = [];
  const notes: string[] = [];
  const edit = (kind: NodeKind, what: What, patch: (n: NodeRecord) => Record<string, unknown>) => {
    const { nodes, ambiguous } = targets(g, kind, input.nodeIds);
    if (ambiguous) {
      questions.push(tr('api.agent.ambiguous', { count: ambiguous, kind: tr(`node.${kind}`) }));
      return;
    }
    if (!nodes.length) {
      notes.push(tr('api.agent.noNode', { kind: tr(`node.${kind}`), change: what.change }));
      return;
    }
    // Skip nodes that already have these values: a no-op edit would only confuse the user.
    const real = nodes.filter((n) => Object.entries(patch(n)).some(([k, v]) => n.settings[k] !== v));
    if (!real.length) {
      notes.push(
        tr('api.agent.alreadySet', {
          count: nodes.length,
          nodes: nodes.map(name).join(', '),
          value: what.value,
        }),
      );
      return;
    }
    changes.push({
      ops: real.map((n) => ({ type: 'node.update' as const, id: n.id, patch: { settings: patch(n) } })),
      label: tr('api.agent.changeOn', { nodes: real.map(name).join(', '), change: what.change }),
      nodeIds: real.map((n) => n.id),
    });
  };
  /** `look → Velvet`: the change and its value. */
  const to = (key: ChangeKey, value: string): What => ({
    change: tr(key, { value }),
    value,
  });

  const look = LOOK_WORDS.find(([re]) => re.test(t))?.[1];
  const moods = [...new Set(t.match(MOOD) ?? [])];
  if (look && /\b(stage|look|scene|background|set)\b|dark|stone|velvet|pastel|botanical|studio/.test(t)) {
    edit('stage', to('api.agent.change.look', tr(`look.${look}`)), () => ({ look }));
  }
  if (moods.length) {
    const direction = tr('api.agent.change.direction', { value: moods.join(', ') });
    // The value of a direction is the whole change ("already has direction: warmer").
    edit('stage', { change: direction, value: direction }, (n) => {
      const prev = String(n.settings.prompt ?? '').trim();
      return { prompt: [prev, `${moods.join(', ')} light`].filter(Boolean).join('; ').slice(0, 2000) };
    });
  }
  const dur = /(\d{1,2})\s*-?\s*(?:s\b|sec|second)/.exec(t);
  if (dur) {
    const want = Number(dur[1]);
    const nearest = [6, 10, 15].reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
    const value =
      nearest !== want
        ? tr('api.agent.value.secondsClosest', { seconds: nearest, wanted: want })
        : tr('api.agent.value.seconds', { seconds: nearest });
    edit('adVideo', to('api.agent.change.duration', value), () => ({ durationSec: nearest }));
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
  if (aspect) edit('adVideo', to('api.agent.change.aspect', aspect), () => ({ aspect }));
  const motion = /\b(motion|move|camera|animation|animate)\b/.test(t)
    ? MOTION_WORDS.find(([re]) => re.test(t))?.[1]
    : undefined;
  if (motion) edit('adVideo', to('api.agent.change.motion', tr(`motion.${motion}`)), () => ({ motion }));
  const headline = /headline\s*(?:to|:|=|is)?\s*["“'](.+?)["”']/.exec(input.message);
  if (headline) {
    const { nodes, ambiguous } = targets(g, 'text', input.nodeIds);
    const heads = nodes.filter((n) => n.settings.role === 'headline' || /headline/i.test(n.label ?? ''));
    if (ambiguous && !heads.length) {
      const all = [...g.nodes.values()].filter(
        (n) => n.kind === 'text' && (n.settings.role === 'headline' || /headline/i.test(n.label ?? '')),
      );
      if (all.length === 1) heads.push(all[0]!);
      else questions.push(tr('api.agent.ambiguousHeadline', { count: all.length }));
    }
    if (heads.length)
      changes.push({
        ops: heads.map((n) => ({
          type: 'node.update' as const,
          id: n.id,
          patch: { settings: { text: headline[1]!.slice(0, 200) } },
        })),
        label: tr('api.agent.change.headline', { text: headline[1]! }),
        nodeIds: heads.map((n) => n.id),
      });
  }
  if (/\b(high|more) detail\b/.test(t))
    edit('model3d', to('api.agent.change.detail', tr('api.agent.value.detailHigh')), () => ({
      detail: 'high',
    }));
  if (/\bdraft\b/.test(t))
    edit('model3d', to('api.agent.change.detail', tr('api.agent.value.detailDraft')), () => ({
      detail: 'draft',
    }));
  if (/\bswirl\b/.test(t))
    edit('export', to('api.agent.change.preset', tr('glbPreset.google_swirl')), () => ({
      glbPreset: 'google_swirl',
    }));
  else if (/\bmerchant|shopping\b/.test(t))
    edit('export', to('api.agent.change.preset', tr('glbPreset.google_merchant')), () => ({
      glbPreset: 'google_merchant',
    }));
  if (/\badd (a |some |more )?packshots?\b/.test(t)) {
    const { nodes: models, ambiguous } = targets(g, 'model3d', input.nodeIds);
    const model = models[0];
    if (ambiguous) questions.push(tr('api.agent.pickModel'));
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
              label: tr('api.agent.packshotLabel'),
              settings: { angles: 'four', size: '1k', camera: null },
              zKey: nextZKey(g),
            },
          },
          {
            type: 'edge.create',
            edge: { id: newId(), source: model.id, sourcePort: 'out', target: id, targetPort: 'subject' },
          },
        ],
        label: tr('api.agent.change.addPackshot', { node: name(model) }),
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
    const tr = translator(input.locale);
    const { changes, questions, wantsRun, notes } = plan(input);
    if (!changes.length && !questions.length && !wantsRun) {
      yield* words(tr('api.agent.help'));
      return;
    }
    for (const q of questions) yield* words(`${q} `);
    if (changes.length) {
      yield* words(
        `${changes.length === 1 ? tr('api.agent.done') : tr('api.agent.madeChanges', { count: changes.length })} `,
      );
      for (const c of changes) {
        yield { type: 'ops', ops: c.ops, label: c.label };
        yield* words(`${c.label}. `);
      }
    }
    for (const n of notes) yield* words(`${n} `);
    if (wantsRun && !questions.length) {
      const ids = changes.flatMap((c) => c.nodeIds);
      yield* words(`${ids.length ? tr('api.agent.runningChanged') : tr('api.agent.runningBoard')} `);
      yield { type: 'run', nodeId: null, scope: 'all' };
    } else if (changes.length) {
      yield* words(tr('api.agent.sayRun'));
    }
  },
};
