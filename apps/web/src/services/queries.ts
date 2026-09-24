import {
  type Artifact,
  type ArtifactFilter,
  isRetryable,
  isServiceError,
  type ProjectFilter,
  type Run,
} from '@annie3d/contracts';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '@/stores/sessionStore';
import { useServices } from './context';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (count, err) => isRetryable(err) && count < 3,
        retryDelay: (attempt, err) =>
          isServiceError(err) && err.retryAfterMs ? err.retryAfterMs : Math.min(1500, 300 * 2 ** attempt),
      },
      mutations: { retry: false },
    },
  });
}

/** Query keys always include the workspace so a session change cannot serve another user's cache. */
export const keys = {
  me: (ws: string) => ['me', ws] as const,
  projects: (ws: string, f: ProjectFilter) => ['projects', ws, f] as const,
  project: (ws: string, id: string) => ['project', ws, id] as const,
  workflow: (ws: string, id: string) => ['workflow', ws, id] as const,
  runs: (ws: string, projectId: string) => ['runs', ws, projectId] as const,
  run: (ws: string, id: string) => ['run', ws, id] as const,
  activeRuns: (ws: string) => ['activeRuns', ws] as const,
  artifacts: (ws: string, f: ArtifactFilter) => ['artifacts', ws, f] as const,
  artifact: (ws: string, id: string) => ['artifact', ws, id] as const,
  versions: (ws: string, lineage: string) => ['versions', ws, lineage] as const,
  exports: (ws: string, projectId?: string) => ['exports', ws, projectId ?? 'all'] as const,
  subscription: (ws: string) => ['subscription', ws] as const,
  usage: (ws: string) => ['usage', ws] as const,
  invoices: (ws: string) => ['invoices', ws] as const,
  checkout: (ws: string, id: string) => ['checkout', ws, id] as const,
  workspace: (ws: string) => ['workspace', ws] as const,
  members: (ws: string) => ['members', ws] as const,
  invitations: (ws: string) => ['invitations', ws] as const,
  prefs: (ws: string) => ['prefs', ws] as const,
  notifications: (ws: string) => ['notifications', ws] as const,
  blob: (ws: string, key: string) => ['blob', ws, key] as const,
};

export function useWorkspaceId(): string {
  return useSessionStore((s) => s.session?.workspaceId ?? 'anonymous');
}

export function useMe() {
  const s = useServices();
  const ws = useWorkspaceId();
  return useQuery({ queryKey: keys.me(ws), queryFn: () => s.session.me(), staleTime: 60_000 });
}

export function useProjects(filter: ProjectFilter) {
  const s = useServices();
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: keys.projects(ws, filter),
    queryFn: () => s.projects.list(filter),
    placeholderData: (prev) => prev,
  });
}

export function useProject(id: string) {
  const s = useServices();
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: keys.project(ws, id),
    queryFn: () => s.projects.get(id),
    retry: (n, e) => !isServiceError(e, 'not_found') && isRetryable(e) && n < 2,
  });
}

export function useWorkflow(id: string | undefined) {
  const s = useServices();
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: keys.workflow(ws, id ?? ''),
    queryFn: () => s.workflows.get(id!),
    enabled: !!id,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useRuns(projectId: string) {
  const s = useServices();
  const ws = useWorkspaceId();
  return useQuery({ queryKey: keys.runs(ws, projectId), queryFn: () => s.runs.list(projectId) });
}

export function useActiveRuns() {
  const s = useServices();
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: keys.activeRuns(ws),
    queryFn: () => s.runs.activeForWorkspace(),
    refetchInterval: (q) => ((q.state.data?.length ?? 0) > 0 ? 2500 : false),
  });
}

export function useArtifacts(filter: ArtifactFilter) {
  const s = useServices();
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: keys.artifacts(ws, filter),
    queryFn: () => s.artifacts.list(filter),
    placeholderData: (prev) => prev,
  });
}

export function useArtifact(id: string | undefined) {
  const s = useServices();
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: keys.artifact(ws, id ?? ''),
    queryFn: () => s.artifacts.get(id!),
    enabled: !!id,
    retry: false,
  });
}

export function useVersions(lineageId: string | undefined) {
  const s = useServices();
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: keys.versions(ws, lineageId ?? ''),
    queryFn: () => s.artifacts.versions(lineageId!),
    enabled: !!lineageId,
  });
}

export function useBlobUrl(blobKey: string | undefined) {
  const s = useServices();
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: keys.blob(ws, blobKey ?? ''),
    queryFn: async () => {
      const b = await s.projects.readBlob(blobKey!);
      return b ? URL.createObjectURL(b) : null;
    },
    enabled: !!blobKey,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 10 * 60_000,
  });
}

export function useExports(projectId?: string) {
  const s = useServices();
  const ws = useWorkspaceId();
  return useQuery({ queryKey: keys.exports(ws, projectId), queryFn: () => s.exports.list(projectId) });
}

export function useSubscription() {
  const s = useServices();
  const ws = useWorkspaceId();
  return useQuery({ queryKey: keys.subscription(ws), queryFn: () => s.billing.subscription() });
}

export function useInvalidate() {
  const qc = useQueryClient();
  const ws = useWorkspaceId();
  return {
    projects: () => qc.invalidateQueries({ queryKey: ['projects', ws] }),
    project: (id: string) => qc.invalidateQueries({ queryKey: keys.project(ws, id) }),
    runs: (projectId: string) => {
      qc.invalidateQueries({ queryKey: keys.runs(ws, projectId) });
      qc.invalidateQueries({ queryKey: keys.activeRuns(ws) });
    },
    artifacts: () => qc.invalidateQueries({ queryKey: ['artifacts', ws] }),
    versions: () => qc.invalidateQueries({ queryKey: ['versions', ws] }),
    exports: () => qc.invalidateQueries({ queryKey: ['exports', ws] }),
    billing: () => {
      qc.invalidateQueries({ queryKey: keys.subscription(ws) });
      qc.invalidateQueries({ queryKey: keys.usage(ws) });
      qc.invalidateQueries({ queryKey: keys.invoices(ws) });
    },
    workspace: () => {
      qc.invalidateQueries({ queryKey: keys.workspace(ws) });
      qc.invalidateQueries({ queryKey: keys.members(ws) });
      qc.invalidateQueries({ queryKey: keys.invitations(ws) });
      qc.invalidateQueries({ queryKey: keys.me(ws) });
    },
    setRun: (run: Run) => qc.setQueryData(keys.run(ws, run.id), run),
    setArtifact: (a: Artifact) => qc.setQueryData(keys.artifact(ws, a.id), a),
    all: () => qc.invalidateQueries(),
  };
}

export { useMutation, useQueryClient };
