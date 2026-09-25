/**
 * Feature registry: the two lists the desktop app is planned around.
 *
 * - `surface: 'shared'`  — the same feature on the website and in the app (one code path).
 * - `surface: 'desktop'` — only in the app.
 * - `layer` says where its code ships: `web` files reach the app as a web-pack update (only the
 *   changed, content-hashed files are downloaded); `shell` files need a new app build.
 *
 * Every source file of the client and of the desktop shell must match one feature (checked by a
 * unit test), so the update planner can always say which features a deploy changes.
 * This module has no imports on purpose: build scripts load it directly with Node.
 */
export type FeatureSurface = 'shared' | 'desktop';
export type FeatureLayer = 'web' | 'shell';

export interface Feature {
  id: string;
  title: string;
  surface: FeatureSurface;
  layer: FeatureLayer;
  /** Repo-relative globs (`*` within a segment, `**` across segments, `{a,b}` alternatives). */
  paths: string[];
}

const C = 'apps/web/src/client';

export const FEATURES: Feature[] = [
  {
    id: 'core',
    title: 'App core',
    surface: 'shared',
    layer: 'web',
    paths: [
      `${C}/{main.tsx,App.tsx,app.css,zod-setup.ts}`,
      `${C}/api/**`,
      `${C}/store/**`,
      `${C}/lib/{media,throttleRaf,useMedia,zoom,preload,afterNextPaint}.ts`,
      'packages/contracts/src/**',
      'packages/ui/**',
      'index.html',
    ],
  },
  {
    id: 'canvas',
    title: 'Canvas and nodes',
    surface: 'shared',
    layer: 'web',
    paths: [
      `${C}/canvas/{Canvas,FlowNode,FlowEdge,Grid,useWheelZoom,useShortcuts,actions,example}.{ts,tsx}`,
      `${C}/chrome/{TopBar,Toolbar,ContextMenu,Palette,Popover,Toasts,Modal}.tsx`,
      `${C}/canvas/neu/**`,
    ],
  },
  {
    id: 'clipboard',
    title: 'Copy, paste and duplicate',
    surface: 'shared',
    layer: 'web',
    paths: [`${C}/canvas/clipboard.ts`],
  },
  {
    id: 'board-file',
    title: 'Board files (.annie3d)',
    surface: 'shared',
    layer: 'web',
    paths: [`${C}/lib/boardFile.ts`, `${C}/lib/doc.ts`, `${C}/lib/webDoc.ts`],
  },
  {
    id: 'runs',
    title: 'Runs',
    surface: 'shared',
    layer: 'web',
    paths: [`${C}/chrome/RunDialog.tsx`, `${C}/lib/runSocket.ts`],
  },
  {
    id: 'agent',
    title: 'Annie agent',
    surface: 'shared',
    layer: 'web',
    paths: [`${C}/chrome/{AgentDock.tsx,useAgent.ts}`, `${C}/lib/agentClient.ts`],
  },
  {
    id: 'editor',
    title: '3D editor',
    surface: 'shared',
    layer: 'web',
    paths: [
      `${C}/editor/**`,
      'packages/viewer-3d/src/{editor,environment,fixtures,presets,viewer,composite,index}.ts',
      'packages/viewer-3d/assets/**',
    ],
  },
  {
    id: 'simulation',
    title: 'Simulation',
    surface: 'shared',
    layer: 'web',
    paths: [`${C}/sim/**`, 'packages/viewer-3d/src/sim.ts'],
  },
  {
    id: 'export-share',
    title: 'Export and share',
    surface: 'shared',
    layer: 'web',
    paths: [`${C}/chrome/{ExportDialog,ShareDialog}.tsx`],
  },
  {
    id: 'accounts',
    title: 'Sign-in and credits',
    surface: 'shared',
    layer: 'web',
    paths: [`${C}/chrome/{BillingDialog,SignInPrompt}.tsx`, `${C}/lib/auth.ts`],
  },
  {
    id: 'reel',
    title: 'Process reel',
    surface: 'shared',
    layer: 'web',
    paths: [`${C}/chrome/ReelDialog.tsx`, `${C}/lib/reel.ts`],
  },
  {
    id: 'performance',
    title: 'Performance meter',
    surface: 'shared',
    layer: 'web',
    paths: [`${C}/chrome/PerfPanel.tsx`, `${C}/lib/perf.ts`],
  },
  // ---- desktop only ----
  {
    id: 'desktop-updates',
    title: 'App updates and file opening',
    surface: 'desktop',
    layer: 'web',
    paths: [`${C}/desktop/**`],
  },
  {
    id: 'desktop-shell',
    title: 'Desktop shell',
    surface: 'desktop',
    layer: 'shell',
    paths: ['apps/desktop/src/**', 'apps/desktop/electron-builder.yml'],
  },
];

/** Third-party code (React, three.js…) bundled into the web pack. */
export const VENDOR_FEATURE: Feature = {
  id: 'libraries',
  title: 'Libraries',
  surface: 'shared',
  layer: 'web',
  paths: ['node_modules/**'],
};

function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (c === '*') re += '[^/]*';
    else if (c === '{') re += '(?:';
    else if (c === '}') re += ')';
    else if (c === ',') re += '|';
    else re += c.replace(/[.+?^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

const compiled = new Map<string, RegExp>();
export function matchesGlob(path: string, glob: string): boolean {
  let r = compiled.get(glob);
  if (!r) {
    r = globToRegExp(glob);
    compiled.set(glob, r);
  }
  return r.test(path);
}

/** The feature a repo-relative source path belongs to (vendor code included), or null. */
export function featureOf(path: string): Feature | null {
  if (path.includes('node_modules/')) return VENDOR_FEATURE;
  return FEATURES.find((f) => f.paths.some((g) => matchesGlob(path, g))) ?? null;
}
