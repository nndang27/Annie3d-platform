import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactFlowProvider } from '@xyflow/react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { api } from './api/client';
import { useMe } from './api/me';
import { importGuestUploads } from './canvas/actions';
import { Canvas } from './canvas/Canvas';
import { exampleBoard } from './canvas/example';
import { useShortcuts } from './canvas/useShortcuts';
import { AgentDock } from './chrome/AgentDock';
import { ContextMenu } from './chrome/ContextMenu';
import { Palette } from './chrome/Palette';
import { SignInPrompt } from './chrome/SignInPrompt';
import { Toasts } from './chrome/Toasts';
import { Toolbar } from './chrome/Toolbar';
import { TopBar } from './chrome/TopBar';
import { loadGuestBoard, loadSnapshot, useBoard } from './store/board';
import { clearGuest, clearGuestFiles, loadGuest, rehydrateGuestUrls } from './store/persist';
import { toast, useUi } from './store/ui';

// The 3D editor (three.js, ~600 kB) loads only when a node is opened (bundle-dynamic-imports).
const EditorOverlay = lazy(() => import('./editor/EditorOverlay'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

type GuestBoard = ReturnType<typeof exampleBoard>;

function boardIdFromPath(): string | null {
  const m = /^\/b\/([0-9a-f-]{36})$/.exec(location.pathname);
  return m?.[1] ?? null;
}

/** Decides which board to open: /b/:id, the latest board, an imported guest board, or the example. */
function useBoot() {
  const me = useMe();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (me.isLoading) return;
    let cancelled = false;
    (async () => {
      try {
        if (!me.data) {
          const saved = await loadGuest<GuestBoard>();
          const board = saved?.nodes?.length
            ? { ...saved, versions: await rehydrateGuestUrls(saved.versions) }
            : exampleBoard();
          if (cancelled) return;
          useUi.setState({ initialFit: board.focus ?? null });
          loadGuestBoard(board);
          return;
        }
        let id = boardIdFromPath();
        let pendingUploads: GuestBoard['versions'] = [];
        if (!id) {
          // A guest who just signed in brings their board along (F1 → F11 hand-off).
          const guest = await loadGuest<GuestBoard>();
          if (guest?.nodes?.length) {
            const snap = await api.createBoard({
              title: guest.title === 'Example board' ? 'My first board' : guest.title,
              starter: 'blank',
              fromGuest: {
                nodes: guest.nodes.map(({ version: _v, currentVersionId: _c, ...n }) => n),
                edges: guest.edges,
              },
            });
            pendingUploads = guest.versions.filter(
              (v) => v.source === 'upload' && !v.outputs[0]?.urls.original?.includes('/api/public/'),
            );
            await clearGuest();
            id = snap.board.id;
          } else {
            const list = await api.boards();
            id =
              list.boards[0]?.id ??
              (await api.createBoard({ title: 'My first board', starter: 'splash-hero' })).board.id;
          }
          history.replaceState(null, '', `/b/${id}${location.search}`);
        }
        const snap = await api.board(id);
        if (cancelled) return;
        loadSnapshot(snap);
        if (pendingUploads.length) {
          await importGuestUploads(pendingUploads);
          await clearGuestFiles();
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me.isLoading, me.data]);
  return error;
}

function useEditParam() {
  useEffect(() => {
    const sync = () => useUi.setState({ editingNodeId: new URLSearchParams(location.search).get('edit') });
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
}

function Workspace() {
  const error = useBoot();
  const mode = useBoard((s) => s.mode);
  const agentOpen = useUi((s) => s.agentOpen);
  const editing = useUi((s) => s.editingNodeId);
  useShortcuts();
  useEditParam();
  useEffect(() => {
    if (error) toast(error, 'error');
  }, [error]);
  return (
    <div className={`shell${agentOpen ? '' : ' agent-closed'}`}>
      <main className="canvas-wrap" aria-label="Board canvas" aria-busy={mode === 'loading'}>
        {mode === 'loading' ? (
          <div className="splash" data-testid="loading">
            Loading board…
          </div>
        ) : (
          <Canvas />
        )}
        <TopBar />
        <Toolbar />
      </main>
      <AgentDock />
      <Palette />
      <ContextMenu />
      <SignInPrompt />
      <Toasts />
      {editing && (
        <Suspense fallback={<div className="editor-loading">Opening 3D…</div>}>
          <EditorOverlay nodeId={editing} />
        </Suspense>
      )}
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ReactFlowProvider>
        <Workspace />
      </ReactFlowProvider>
    </QueryClientProvider>
  );
}
