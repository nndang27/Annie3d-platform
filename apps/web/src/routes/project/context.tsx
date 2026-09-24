import type { Artifact, Project, Run } from '@annie3d/contracts';
import { createContext, type ReactNode, useContext } from 'react';

export interface ProjectContextValue {
  project: Project;
  role: 'owner' | 'editor' | 'viewer';
  canEdit: boolean;
  artifacts: Artifact[];
  latestArtifactFor(nodeId: string): Artifact | undefined;
  activeRun: Run | null;
  startRun(onlyNodeId?: string): Promise<void>;
  cancelRun(): Promise<void>;
  retryRun(runId: string): Promise<void>;
  openStudio(): void;
  refreshArtifacts(): void;
}

const Ctx = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ value, children }: { value: ProjectContextValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProjectContext(): ProjectContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('ProjectProvider missing');
  return v;
}
