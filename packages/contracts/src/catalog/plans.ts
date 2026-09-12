import type { Plan, PlanId } from '../billing';

/** Illustrative prices for the demonstration. No purchase is processed. */
export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Try the workflow on your own products.',
    monthlyUsd: 0,
    yearlyUsd: 0,
    creditsPerMonth: 20,
    seats: 1,
    maxProjects: 3,
    exportPresets: ['PNG snapshot', 'Scene JSON'],
    features: ['All templates', '3 active projects', 'Watermark-free stills', 'Community help'],
    limitsThatStopWork: ['Runs stop when 20 monthly credits are used', 'Video exports are unavailable'],
    limitsThatCharge: [],
  },
  {
    id: 'studio',
    name: 'Studio',
    tagline: 'For a brand team shipping weekly creatives.',
    monthlyUsd: 29,
    yearlyUsd: 290,
    creditsPerMonth: 300,
    seats: 3,
    maxProjects: 'unlimited',
    exportPresets: ['PNG snapshot', 'WebM preview', 'Scene JSON', 'MP4 render'],
    features: [
      'Unlimited projects',
      '3 seats',
      'Video exports',
      'Version history (90 days)',
      'Email support',
    ],
    limitsThatStopWork: ['Runs pause when 300 monthly credits are used unless overage is enabled'],
    limitsThatCharge: ['Optional overage at USD 0.12 per credit (illustrative)'],
  },
  {
    id: 'team',
    name: 'Team',
    tagline: 'For agencies and multi-brand teams.',
    monthlyUsd: 79,
    yearlyUsd: 790,
    creditsPerMonth: 1000,
    seats: 10,
    maxProjects: 'unlimited',
    exportPresets: ['PNG snapshot', 'WebM preview', 'Scene JSON', 'MP4 render'],
    features: [
      'Everything in Studio',
      '10 seats and roles',
      'Shared asset library',
      'Priority render queue',
      'Version history (1 year)',
    ],
    limitsThatStopWork: ['Runs pause when 1,000 monthly credits are used unless overage is enabled'],
    limitsThatCharge: [
      'Optional overage at USD 0.10 per credit (illustrative)',
      'Additional seats at USD 8 per seat (illustrative)',
    ],
  },
];

export function findPlan(id: string | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function planPrice(id: PlanId, interval: 'monthly' | 'yearly'): number {
  const p = findPlan(id)!;
  return interval === 'monthly' ? p.monthlyUsd : p.yearlyUsd;
}

/** Sample calculation shown on pricing pages. */
export const USAGE_UNIT = {
  name: 'render credit',
  explanation:
    'One credit covers one model build step or one 1080p clip up to 10 seconds. Stills cost one credit; a full turntable template uses about seven.',
  sample: {
    template: 'Turntable hero',
    steps: [
      ['Build 3D model', 2],
      ['Compose scene', 1],
      ['Animate 6 s', 2],
      ['Ad variants', 1],
      ['Export', 1],
    ] as [string, number][],
  },
};
