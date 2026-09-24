import { type AssetDto, NODE_DEFS, type SimEnvironment } from '@annie3d/contracts';
import { useBoard } from '../store/board';

export const SIM_ENV_META: Record<SimEnvironment, { label: string; hint: string }> = {
  shop: { label: 'Shop page', hint: 'Product page of an online store' },
  tiktok: { label: 'TikTok', hint: 'Vertical social feed with a shop card' },
  sticker: { label: 'Sticker', hint: 'Chat sticker with a transparent background' },
  showroom: { label: 'Showroom', hint: 'Live stage you steer from your phone' },
};

export interface SimInputs {
  title: string;
  /** GLB of the wired 3D model, when the subject is a model. */
  glb: string | null;
  /** Still of the subject: model poster or the stage render. */
  poster: string | null;
  logo: string | null;
}

function primaryOf(nodeId: string | undefined): AssetDto | undefined {
  const s = useBoard.getState();
  const n = nodeId ? s.graph.nodes.get(nodeId) : undefined;
  return n?.currentVersionId ? s.versions.get(n.currentVersionId)?.outputs[0] : undefined;
}

/** What a Simulation node shows, read from the nodes wired into it. */
export function simInputs(nodeId: string): SimInputs {
  const s = useBoard.getState();
  const node = s.graph.nodes.get(nodeId);
  const into = (port: string) =>
    [...s.graph.edges.values()].find((e) => e.target === nodeId && e.targetPort === port)?.source;
  const subjectId = into('subject');
  const subject = primaryOf(subjectId);
  const headlineNode = s.graph.nodes.get(into('headline') ?? '');
  const subjectNode = subjectId ? s.graph.nodes.get(subjectId) : undefined;
  const headline = String(headlineNode?.settings.text ?? '').trim();
  const logo = primaryOf(into('logo'));
  return {
    title:
      headline ||
      (subjectNode?.label && subjectNode.label !== NODE_DEFS[subjectNode.kind].label
        ? subjectNode.label
        : '') ||
      node?.label ||
      'Your product',
    glb: subject?.kind === 'model3d' ? subject.urls.original : null,
    poster: subject ? (subject.urls.poster ?? subject.urls.thumb ?? subject.urls.original) : null,
    logo: logo ? (logo.urls.thumb ?? logo.urls.original) : null,
  };
}

/** Re-renders when anything the simulation reads changes; returns a stable string key. */
export function useSimKey(nodeId: string): string {
  return useBoard((s) => {
    const parts: string[] = [];
    for (const e of s.graph.edges.values()) {
      if (e.target !== nodeId) continue;
      const src = s.graph.nodes.get(e.source);
      parts.push(
        `${e.targetPort}:${src?.currentVersionId}:${String(src?.settings.text ?? '')}:${src?.label}`,
      );
    }
    return parts.sort().join('|');
  });
}
