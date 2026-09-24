import type { NodeKind } from '@annie3d/contracts';

/** Engine version per runnable kind. Bumping one invalidates cached results for that kind. */
export const ENGINE_VERSIONS: Partial<Record<NodeKind, string>> = {
  model3d: 'sim-1',
  stage: 'sim-1',
  packshot: 'sim-1',
  adVideo: 'sim-1',
  export: 'sim-1',
};
