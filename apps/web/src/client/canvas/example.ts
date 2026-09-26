import {
  type EdgeRecord,
  generateKeyBetween,
  type NodeRecord,
  type NodeVersionDto,
  newId,
  STARTERS,
  type StarterId,
  type StarterWords,
  starterGraph,
} from '@annie3d/contracts';
import { FIXTURE_FOR_STARTER, fixtureOutputs } from '@annie3d/fixtures';
import { t } from '../i18n';

const ROW_GAP = 900;

/**
 * The words a Starter writes into its nodes (labels, sample headline, call to action) in the
 * current language: product defaults are translated when they are created (docs/I18N.md rule 6).
 */
export function starterWords(id: StarterId): StarterWords {
  return {
    photo: t('starter.node.photo'),
    headline: t('starter.node.headline'),
    pack: t('starter.node.pack'),
    headlineText: t(`starter.${id}.headline`),
    cta: t('setting.simulation.cta'),
  };
}

/**
 * F1: the canvas opens on an example board that has already run: the three Starter lines
 * (one per vertical), every node showing real rendered outputs from the fixture pack.
 */
export function exampleBoard() {
  const nodes: NodeRecord[] = [];
  const edges: EdgeRecord[] = [];
  const versions: NodeVersionDto[] = [];
  // One z-order across the whole board: each starterGraph() call restarts its keys at 'a0'.
  let z: string | null = null;
  const zNext = () => (z = generateKeyBetween(z, null));
  const focus: string[] = [];
  const order: StarterId[] = ['splash-hero', ...STARTERS.filter((s) => s !== 'splash-hero')];
  order.forEach((starter, row) => {
    const g = starterGraph(starter, { x: 0, y: row * ROW_GAP }, starterWords(starter));
    const product = FIXTURE_FOR_STARTER[starter];
    for (const raw of g.nodes) {
      const n = { ...raw, zKey: zNext() };
      if (row === 0) focus.push(n.id);
      const outputs = fixtureOutputs('', product, n.kind);
      if (!outputs.length) {
        nodes.push(n);
        continue;
      }
      const id = newId();
      versions.push({
        id,
        nodeId: n.id,
        versionNo: 1,
        source: n.kind === 'photo' ? 'upload' : 'run',
        runId: null,
        parentVersionId: null,
        outputAssetId: outputs[0]!.id,
        outputs,
        params: {},
        gates: [],
        createdAt: '2026-09-24T00:00:00.000Z',
      });
      // Input nodes point at their file like an upload does (settings.assetId); the server uses it
      // to recognise the shared fixture photo when this board is imported on sign-in.
      nodes.push({
        ...n,
        settings: n.kind === 'photo' ? { ...n.settings, assetId: outputs[0]!.id } : n.settings,
        currentVersionId: id,
        label:
          row === 0 || n.kind !== 'photo'
            ? n.label
            : t('board.exampleLabel', { label: n.label ?? '', product: t(`board.product.${product}`) }),
      });
    }
    edges.push(...g.edges);
  });
  return { title: t('board.example'), nodes, edges, versions, focus };
}
