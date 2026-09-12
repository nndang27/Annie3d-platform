import type { AdComposition, SceneDoc } from './scene';

export type ArtifactKind =
  | 'reference-image'
  | 'image'
  | 'model'
  | 'scene'
  | 'clip'
  | 'audio'
  | 'ad-variant'
  | 'export';
export type Acceptance = 'unreviewed' | 'accepted' | 'rejected';

export interface Artifact {
  id: string;
  projectId: string;
  runId?: string;
  nodeId?: string;
  kind: ArtifactKind;
  title: string;
  revision: number;
  /** All revisions share a lineage id so versions can be listed and compared. */
  lineageId: string;
  createdAt: number;
  /** Preview availability is separate from execution status. */
  preview: { kind: 'image'; blobKey: string } | { kind: 'fixture'; fixtureId: string } | { kind: 'none' };
  acceptance: Acceptance;
  provenance: { source: 'upload' | 'template' | 'engine-demo' | 'browser' | 'manual'; note: string };
  sizeBytes?: number;
  mime?: string;
  /** Kept for scene/ad-variant artifacts so they stay editable and exportable separately. */
  scene?: SceneDoc;
  ad?: AdComposition;
  /** For downloadable files produced in the browser or from fixtures. */
  blobKey?: string;
  /** Superseded when a newer revision of the same lineage exists. */
  supersededBy?: string;
}

export type ExportPresetId = 'png-snapshot' | 'webm-preview' | 'scene-json' | 'mp4-render';

export interface ExportPreset {
  id: ExportPresetId;
  title: string;
  description: string;
  mime: string;
  extension: string;
  /** 'browser' exports are produced locally from the current scene; 'queue' exports are simulated renders. */
  mode: 'browser' | 'queue';
  /** Honest label displayed next to the result. */
  label: string;
  credits: number;
}

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'png-snapshot',
    title: 'PNG snapshot',
    description: 'Composited still of the current scene and ad layout, rendered by your browser.',
    mime: 'image/png',
    extension: 'png',
    mode: 'browser',
    label: 'Browser render of your scene',
    credits: 0,
  },
  {
    id: 'webm-preview',
    title: 'WebM preview clip',
    description: 'Records the animation from your browser canvas. Preview quality, real content.',
    mime: 'video/webm',
    extension: 'webm',
    mode: 'browser',
    label: 'Browser recording of your scene',
    credits: 0,
  },
  {
    id: 'scene-json',
    title: 'Scene + ad JSON',
    description: 'Editable scene and composition data for re-import or the future engine.',
    mime: 'application/json',
    extension: 'json',
    mode: 'browser',
    label: 'Editable data',
    credits: 0,
  },
  {
    id: 'mp4-render',
    title: 'MP4 render (simulated queue)',
    description: 'Queued render. In the demo the file is a labelled sample clip, not a render of your scene.',
    mime: 'video/mp4',
    extension: 'mp4',
    mode: 'queue',
    label: 'Sample media — not your scene',
    credits: 1,
  },
];

export type ExportJobStatus = 'queued' | 'rendering' | 'completed' | 'failed' | 'cancelled';

export interface ExportJob {
  id: string;
  projectId: string;
  artifactId: string;
  preset: ExportPresetId;
  operationId: string;
  status: ExportJobStatus;
  createdAt: number;
  finishedAt?: number;
  progress?: { done: number; total: number; unit: string };
  resultArtifactId?: string;
  error?: string;
  filename: string;
}
