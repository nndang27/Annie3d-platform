import type { ProductFixtureId, ProductFixtureMeta } from '../scene';

/** approxTriangles is refreshed by packages/viewer-3d/scripts/report-fixtures.mjs (see fixtures/fixture-report.json). */
export const PRODUCT_FIXTURES: Record<ProductFixtureId, ProductFixtureMeta> = {
  'serum-bottle': {
    id: 'serum-bottle',
    name: 'Serum bottle',
    category: 'Beauty & skincare',
    approxTriangles: 3248,
    parts: [
      { id: 'body', label: 'Glass body' },
      { id: 'cap', label: 'Dropper cap' },
      { id: 'label', label: 'Label band' },
    ],
    primaryPart: 'body',
    defaultColor: '#c9a27e',
  },
  headphones: {
    id: 'headphones',
    name: 'Over-ear headphones',
    category: 'Consumer electronics',
    approxTriangles: 15000,
    parts: [
      { id: 'band', label: 'Headband' },
      { id: 'cup-left', label: 'Left cup' },
      { id: 'cup-right', label: 'Right cup' },
      { id: 'cushions', label: 'Cushions' },
    ],
    primaryPart: 'cup-left',
    defaultColor: '#2b2f36',
  },
  'smart-speaker': {
    id: 'smart-speaker',
    name: 'Smart speaker',
    category: 'Home & appliances',
    approxTriangles: 3840,
    parts: [
      { id: 'body', label: 'Fabric body' },
      { id: 'top', label: 'Top plate' },
      { id: 'ring', label: 'Light ring' },
      { id: 'base', label: 'Base' },
    ],
    primaryPart: 'body',
    defaultColor: '#7a8290',
  },
};

export const FIXTURE_IDS = Object.keys(PRODUCT_FIXTURES) as ProductFixtureId[];
