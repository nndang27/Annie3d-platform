import type { NodeKind } from './nodes';

/**
 * Credit prices per node run (simulator). Real prices are set after measuring cost per run
 * (docs/MVP_STRATEGY.md §10: price ≥ 3 × cost).
 */
export function creditsFor(kind: NodeKind, settings: Record<string, unknown>): number {
  switch (kind) {
    case 'model3d':
      return settings.detail === 'high' ? 20 : settings.detail === 'draft' ? 8 : 12;
    case 'stage':
      return 6;
    case 'packshot':
      return settings.size === '2k' ? 6 : 4;
    case 'adVideo':
      return settings.durationSec === 15 ? 20 : settings.durationSec === 6 ? 10 : 15;
    case 'export':
      return 1;
    default:
      return 0;
  }
}

/** Credits granted with the first sign-in: enough for one full Starter graph run. */
export const FREE_RUN_CREDITS = 60;
