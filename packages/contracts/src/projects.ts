import type { AspectRatio } from './identity';
import type { ProductFixtureId, SceneRevision } from './scene';

export type ProjectStatus = 'active' | 'archived';

export interface CampaignBrief {
  goal: string;
  audience: string;
  tone: 'clean' | 'bold' | 'warm' | 'technical';
  aspects: AspectRatio[];
  keyMessage: string;
}

export interface ProjectReference {
  /** 'upload' keeps the user's real image; 'fixture' uses a catalog product. */
  source: 'upload' | 'fixture';
  fixtureId: ProductFixtureId;
  uploadBlobKey?: string;
  uploadName?: string;
  uploadSizeBytes?: number;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  templateSlug?: string;
  productName: string;
  productDescription: string;
  brief: CampaignBrief;
  reference: ProjectReference;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  workflowId: string;
  /** Latest scene revision number; revisions are stored separately. */
  sceneRevision: number;
  /** Which artifact is currently selected for review/export. */
  selectedArtifactId?: string;
  /** True when the user chose the selection explicitly; automatic selection never overrides it. */
  selectedArtifactPinned?: boolean;
  lastRunId?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  productName: string;
  templateSlug?: string;
  status: ProjectStatus;
  updatedAt: number;
  fixtureId: ProductFixtureId;
  activeRunStatus?: string;
  artifactCount: number;
}

export interface ProjectDetail {
  project: Project;
  sceneRevisions: SceneRevision[];
}

export interface CreateProjectInput {
  operationId: string;
  name: string;
  templateSlug?: string;
  productName: string;
  productDescription: string;
  brief: CampaignBrief;
  reference:
    | { source: 'fixture'; fixtureId: ProductFixtureId }
    | { source: 'upload'; file: Blob; name: string; fixtureId: ProductFixtureId };
}
