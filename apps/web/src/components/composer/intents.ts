import type { AdComposition, AnimationPreset, ExportPresetId, NodeKind, SceneDoc } from '@annie3d/contracts';

export type Intent =
  | { type: 'scene'; patch: { scene?: Partial<SceneDoc>; ad?: Partial<AdComposition> }; summary: string }
  | { type: 'template'; preset: AnimationPreset; summary: string }
  | { type: 'run'; onlyKind?: NodeKind; summary: string }
  | { type: 'cancel'; summary: string }
  | { type: 'retry'; summary: string }
  | { type: 'playback'; action: 'play' | 'pause'; summary: string }
  | { type: 'history'; action: 'undo' | 'redo'; summary: string }
  | { type: 'export'; preset: ExportPresetId; summary: string }
  | { type: 'tab'; tab: 'workflow' | 'studio' | 'outputs' | 'overview'; summary: string }
  | { type: 'help'; summary: string }
  | { type: 'unsupported'; reason: string; suggestions: string[] };

const COLORS: Record<string, string> = {
  black: '#17191d',
  white: '#ffffff',
  blue: '#2457d6',
  navy: '#1b2a52',
  red: '#b42332',
  green: '#17623b',
  teal: '#1c7f7a',
  gold: '#c9a27e',
  rose: '#b45f9a',
  pink: '#d66aa8',
  orange: '#d6742e',
  gray: '#7a8290',
  grey: '#7a8290',
  silver: '#c2c7cf',
  purple: '#7a4bd6',
  charcoal: '#2b2f36',
};

const quoted = (s: string) => {
  const m = s.match(/["“'‘](.+?)["”'’]/);
  return m?.[1]?.trim();
};

/** Deterministic, rule-based command parsing. This is not a language model. */
export function parseIntent(raw: string): Intent {
  const text = raw.trim();
  const t = text.toLowerCase();
  if (!t)
    return { type: 'unsupported', reason: 'Type a command first.', suggestions: HELP_EXAMPLES.slice(0, 3) };
  if (/^(help|what can you do|\?)/.test(t))
    return { type: 'help', summary: 'Showing what the composer can do.' };
  if (/^(undo)\b/.test(t)) return { type: 'history', action: 'undo', summary: 'Undid the last edit.' };
  if (/^(redo)\b/.test(t)) return { type: 'history', action: 'redo', summary: 'Redid the last edit.' };
  if (/^(play|start playback|preview animation)\b/.test(t))
    return { type: 'playback', action: 'play', summary: 'Playing the animation.' };
  if (/^(pause|stop playback)\b/.test(t))
    return { type: 'playback', action: 'pause', summary: 'Paused the animation.' };
  if (/\b(cancel|stop) (the )?run\b/.test(t)) return { type: 'cancel', summary: 'Stopping the active run.' };
  if (/\bretry\b/.test(t)) return { type: 'retry', summary: 'Retrying the last failed run.' };
  if (/\b(open|go to|show) (the )?(workflow|canvas)\b/.test(t))
    return { type: 'tab', tab: 'workflow', summary: 'Opened the workflow.' };
  if (/\b(open|go to|show) (the )?studio\b/.test(t))
    return { type: 'tab', tab: 'studio', summary: 'Opened the studio.' };
  if (/\b(open|go to|show) (the )?(outputs|versions|library)\b/.test(t))
    return { type: 'tab', tab: 'outputs', summary: 'Opened outputs.' };
  if (/\bexport\b.*\b(png|snapshot|still)\b/.test(t))
    return { type: 'export', preset: 'png-snapshot', summary: 'Opened export with the PNG snapshot preset.' };
  if (/\bexport\b.*\b(webm|preview clip|recording)\b/.test(t))
    return { type: 'export', preset: 'webm-preview', summary: 'Opened export with the WebM preview preset.' };
  if (/\bexport\b.*\b(json|scene data)\b/.test(t))
    return { type: 'export', preset: 'scene-json', summary: 'Opened export with the scene JSON preset.' };
  if (/\b(export|render)\b.*\b(mp4|video)\b/.test(t))
    return { type: 'export', preset: 'mp4-render', summary: 'Opened export with the MP4 render preset.' };
  if (/\bexport\b/.test(t)) return { type: 'export', preset: 'png-snapshot', summary: 'Opened export.' };

  // Workflow presets
  const tpl = t.match(
    /\b(create|build|make|set up|setup|start)\b.*\b(turntable|orbit|dolly|reveal)\b.*\b(workflow|flow|pipeline)?/,
  );
  if (tpl && /\b(workflow|flow|pipeline|template)\b/.test(t)) {
    const preset: AnimationPreset = /orbit/.test(t)
      ? 'orbit-sweep'
      : /dolly|reveal/.test(t)
        ? 'dolly-in'
        : 'turntable';
    return {
      type: 'template',
      preset,
      summary: `Applied the ${preset} workflow preset. Unsaved manual edits to the graph were replaced; use Undo to restore them.`,
    };
  }

  // Run
  const runOnly = t.match(
    /\b(run|execute|start)\b.*\b(model|build|reconstruct|scene|animation|animate|ad variants|variants|export)\b/,
  );
  if (/\b(run|execute|start)\b/.test(t)) {
    const kind: NodeKind | undefined = runOnly
      ? /model|build|reconstruct/.test(t)
        ? 'reconstruct'
        : /scene/.test(t)
          ? 'scene'
          : /anim/.test(t)
            ? 'animation'
            : /variant/.test(t)
              ? 'ad-variants'
              : /export/.test(t)
                ? 'export'
                : undefined
      : undefined;
    return {
      type: 'run',
      onlyKind: kind,
      summary: kind ? `Started a run for the ${kind} step only.` : 'Started a run of the whole workflow.',
    };
  }

  // Scene / ad edits
  const patch: { scene?: Partial<SceneDoc>; ad?: Partial<AdComposition> } = {};
  const notes: string[] = [];
  const bg = t.match(
    /\b(background|backdrop)\b[^a-z]*(to |=)?\s*(studio white|white|cool gray|gray|grey|charcoal|dark|brand)/,
  );
  if (bg) {
    const v = bg[3]!;
    const background: SceneDoc['background'] = /white/.test(v)
      ? 'studio-white'
      : /gr[ae]y/.test(v)
        ? 'cool-gray'
        : /charcoal|dark/.test(v)
          ? 'charcoal'
          : 'brand';
    patch.scene = { ...patch.scene, background };
    notes.push(`background → ${background}`);
  }
  const light = t.match(/\b(light|lighting)\b[^a-z]*(to |=)?\s*(soft|studio|dramatic|daylight|day)/);
  if (light) {
    const v = light[3]!;
    const l: SceneDoc['light'] = /dramatic/.test(v) ? 'dramatic' : /day/.test(v) ? 'daylight' : 'studio-soft';
    patch.scene = { ...patch.scene, light: l };
    notes.push(`light → ${l}`);
  }
  const cam = t.match(/\b(camera|view)\b[^a-z]*(to |=)?\s*(front|top|detail|close|three[- ]quarter|default)/);
  if (cam) {
    const v = cam[3]!;
    const c: SceneDoc['cameraPreset'] = /front/.test(v)
      ? 'front'
      : /top/.test(v)
        ? 'top'
        : /detail|close/.test(v)
          ? 'detail'
          : 'three-quarter';
    patch.scene = { ...patch.scene, cameraPreset: c };
    notes.push(`camera → ${c}`);
  }
  const finish = t.match(/\b(finish|material)\b[^a-z]*(to |=)?\s*(matte|satin|gloss|glossy)/);
  if (finish) {
    const f: SceneDoc['finish'] = /matte/.test(finish[3]!)
      ? 'matte'
      : /satin/.test(finish[3]!)
        ? 'satin'
        : 'gloss';
    patch.scene = { ...patch.scene, finish: f };
    notes.push(`finish → ${f}`);
  }
  const anim = t.match(/\b(animation|preset|motion)\b[^a-z]*(to |=)?\s*(turntable|orbit|dolly)/);
  if (anim) {
    const a: AnimationPreset = /orbit/.test(anim[3]!)
      ? 'orbit-sweep'
      : /dolly/.test(anim[3]!)
        ? 'dolly-in'
        : 'turntable';
    patch.scene = { ...patch.scene, animation: { preset: a } as SceneDoc['animation'] };
    notes.push(`animation → ${a}`);
  }
  const dur =
    t.match(/\b(duration|length)\b[^0-9]*(\d{1,2})\s*(s|sec|seconds)?/) ??
    t.match(/(\d{1,2})\s*(s|sec|seconds)\b.*\b(long|clip|animation)/);
  if (dur) {
    const n = Math.max(2, Math.min(15, Number(dur[2] ?? dur[1])));
    patch.scene = {
      ...patch.scene,
      animation: { ...(patch.scene?.animation ?? {}), durationSec: n } as SceneDoc['animation'],
    };
    notes.push(`duration → ${n}s`);
  }
  const aspect =
    t.match(/\b(aspect|ratio|format)\b[^0-9]*(1:1|4:5|9:16|square|vertical|story|portrait)/) ??
    t.match(/\b(1:1|4:5|9:16)\b/);
  if (aspect) {
    const v = aspect[2] ?? aspect[1]!;
    const a: AdComposition['aspect'] = /9:16|vertical|story/.test(v)
      ? '9:16'
      : /4:5|portrait/.test(v)
        ? '4:5'
        : '1:1';
    patch.ad = { ...patch.ad, aspect: a };
    notes.push(`aspect → ${a}`);
  }
  const layout = t.match(/\b(layout)\b[^a-z]*(to |=)?\s*(left|bottom|center|centred|centered)/);
  if (layout) {
    const l: AdComposition['layout'] = /left/.test(layout[3]!)
      ? 'text-left'
      : /bottom/.test(layout[3]!)
        ? 'text-bottom'
        : 'centered';
    patch.ad = { ...patch.ad, layout: l };
    notes.push(`layout → ${l}`);
  }
  const headline = /\b(headline|title)\b/.test(t)
    ? (quoted(text) ?? text.match(/\b(?:headline|title)\b\s*(?:to|:|=)\s*(.+)$/i)?.[1]?.trim())
    : undefined;
  if (headline) {
    patch.ad = { ...patch.ad, headline };
    notes.push(`headline → “${headline}”`);
  }
  const sub = /\b(subheadline|subtitle|sub)\b/.test(t)
    ? (quoted(text) ?? text.match(/\b(?:subheadline|subtitle|sub)\b\s*(?:to|:|=)\s*(.+)$/i)?.[1]?.trim())
    : undefined;
  if (sub && !headline) {
    patch.ad = { ...patch.ad, subheadline: sub };
    notes.push(`subheadline → “${sub}”`);
  }
  const cta = /\b(cta|button|call to action)\b/.test(t)
    ? (quoted(text) ?? text.match(/\b(?:cta|button|call to action)\b\s*(?:to|:|=)\s*(.+)$/i)?.[1]?.trim())
    : undefined;
  if (cta && !headline && !sub) {
    patch.ad = { ...patch.ad, cta };
    notes.push(`CTA → “${cta}”`);
  }
  const hex = t.match(/#([0-9a-f]{6})\b/);
  const named = t.match(
    /\b(black|white|blue|navy|red|green|teal|gold|rose|pink|orange|gray|grey|silver|purple|charcoal)\b/,
  );
  const colorValue = hex ? `#${hex[1]}` : named ? COLORS[named[1]!] : undefined;
  if (colorValue && /\b(brand|accent|cta colou?r|button colou?r)\b/.test(t)) {
    patch.ad = { ...patch.ad, brandColor: colorValue };
    notes.push(`brand colour → ${colorValue}`);
  } else if (colorValue && /\b(colou?r|material|paint|make (it|the product))\b/.test(t) && !bg) {
    patch.scene = { ...patch.scene, materialColor: colorValue };
    notes.push(`material colour → ${colorValue}`);
  }
  const scale = t.match(/\b(scale|size)\b[^0-9]*(\d+(\.\d+)?)\s*(%|x)?/);
  if (scale) {
    const n = Number(scale[2]);
    const factor = scale[4] === '%' ? n / 100 : n;
    if (factor >= 0.5 && factor <= 2) {
      patch.scene = { ...patch.scene, placement: { scale: factor } as SceneDoc['placement'] };
      notes.push(`scale → ${factor}×`);
    }
  }
  const rot = t.match(/\b(rotate|turn)\b[^0-9-]*(-?\d{1,3})\s*(deg|°)?/);
  if (rot) {
    const n = Number(rot[2]);
    patch.scene = {
      ...patch.scene,
      placement: { ...(patch.scene?.placement ?? {}), rotationY: n } as SceneDoc['placement'],
    };
    notes.push(`rotation → ${n}°`);
  }
  if (notes.length) return { type: 'scene', patch, summary: `Applied: ${notes.join(', ')}.` };

  return {
    type: 'unsupported',
    reason:
      'That request is outside what the demo composer can do. It handles scene and ad properties, workflow presets, runs and exports with rule-based commands; it does not generate free-form content.',
    suggestions: HELP_EXAMPLES.slice(0, 4),
  };
}

export const HELP_EXAMPLES = [
  'Set background to charcoal',
  'Change headline to “Glow, bottled”',
  'Brand colour blue',
  'Aspect 9:16',
  'Duration 8 s',
  'Camera front',
  'Create an orbit workflow',
  'Run the workflow',
  'Run the animation step',
  'Export PNG',
  'Undo',
];
