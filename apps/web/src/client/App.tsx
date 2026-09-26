import type { DesktopBridge } from '@annie3d/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactFlowProvider } from '@xyflow/react';
import { Component, lazy, type ReactNode, Suspense, useEffect, useState } from 'react';
import { api } from './api/client';
import { useMe } from './api/me';
import { importGuestUploads } from './canvas/actions';
import { Canvas } from './canvas/Canvas';
import { exampleBoard } from './canvas/example';
import { useShortcuts } from './canvas/useShortcuts';
import { AgentDock } from './chrome/AgentDock';
import { BillingDialog } from './chrome/BillingDialog';
import { ContextMenu } from './chrome/ContextMenu';
import { ExportDialog } from './chrome/ExportDialog';
import { Palette } from './chrome/Palette';
import { ReelDialog } from './chrome/ReelDialog';
import { attachRun, RunDialog } from './chrome/RunDialog';
import { ShareDialog } from './chrome/ShareDialog';
import { SignInPrompt } from './chrome/SignInPrompt';
import { Toasts } from './chrome/Toasts';
import { Toolbar } from './chrome/Toolbar';
import { TopBar } from './chrome/TopBar';
import { grantAndLoad, loadDocument, startsAsDoc, useDoc } from './lib/doc';
import { timed } from './lib/perf';
import { editorOverlay, simulatorOverlay } from './lib/preload';
import { loadGuestBoard, loadSnapshot, useBoard } from './store/board';
import { clearGuest, clearGuestFiles, loadGuest, rehydrateGuestUrls } from './store/persist';
import { toast, useUi } from './store/ui';

// The 3D editor (three.js, ~700 kB) and the F13 simulator load only when needed
// (bundle-dynamic-imports), starting on hover over a node that opens them (lib/preload.ts).
const EditorOverlay = editorOverlay.Component;
const SimulatorOverlay = simulatorOverlay.Component;
const PerfPanel = lazy(() => import('./chrome/PerfPanel'));
// Desktop app only (window.annieDesktop from the Electron preload): a separate chunk the website never loads.
const DesktopIntegration = lazy(() => import('./desktop/DesktopIntegration'));
const desktopBridge = (window as { annieDesktop?: DesktopBridge }).annieDesktop ?? null;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

type GuestBoard = ReturnType<typeof exampleBoard>;

/** The guest board as a create-board payload (server ids stay; versions are rebuilt server-side). */
function guestPayload(g: Pick<GuestBoard, 'nodes' | 'edges'>) {
  return { nodes: g.nodes.map(({ version: _v, currentVersionId: _c, ...n }) => n), edges: g.edges };
}

function boardIdFromPath(): string | null {
  const m = /^\/b\/([0-9a-f-]{36})$/.exec(location.pathname);
  return m?.[1] ?? null;
}

/** Decides which board to open: /b/:id, the latest board, an imported guest board, or the example. */
function useBoot() {
  const me = useMe();
  const [error, setError] = useState<string | null>(null);
  // Desktop board file (`?doc=`): the file is the board, whoever is signed in.
  useEffect(() => {
    if (startsAsDoc) loadDocument().catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    if (startsAsDoc || me.isLoading) return;
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
              fromGuest: guestPayload(guest),
            });
            pendingUploads = guest.versions.filter(
              (v) => v.source === 'upload' && !v.outputs[0]?.urls.original?.includes('/api/public/'),
            );
            await clearGuest();
            id = snap.board.id;
          } else {
            const list = await api.boards();
            // New accounts start on the example board with its rendered outputs (F1).
            id =
              list.boards[0]?.id ??
              (
                await api.createBoard({
                  title: 'Example board',
                  starter: 'blank',
                  fromGuest: guestPayload(exampleBoard()),
                })
              ).board.id;
          }
          history.replaceState(null, '', `/b/${id}${location.search}`);
        }
        const snap = await timed('board.load', () => api.board(id));
        if (cancelled) return;
        loadSnapshot(snap);
        // A run still going (e.g. after a reload) keeps streaming into this tab.
        const active = (await api.runs(id)).runs.find((r) => r.status === 'queued' || r.status === 'running');
        if (active && !cancelled) attachRun(active.id, queryClient);
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

/** Back from checkout (`?checkout=success`): refresh credits, say so, clean the URL. */
function useCheckoutReturn() {
  useEffect(() => {
    const u = new URL(location.href);
    if (u.searchParams.get('checkout') !== 'success') return;
    u.searchParams.delete('checkout');
    history.replaceState(null, '', u);
    void queryClient.invalidateQueries({ queryKey: ['me'] });
    void queryClient.invalidateQueries({ queryKey: ['credits'] });
    toast('Payment complete. Credits added.');
  }, []);
}

function useEditParam() {
  useEffect(() => {
    const sync = () => useUi.setState({ editingNodeId: new URLSearchParams(location.search).get('edit') });
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
}

/**
 * The loading splash. A board file tab reloaded in Chrome/Edge may need the user's click before
 * the browser lets it read the file again.
 */
function DocAccess() {
  const name = useDoc((s) => s.needsPermission);
  if (!name) return <>Loading board…</>;
  return (
    <button type="button" className="doc-access" onClick={() => void grantAndLoad()} data-testid="doc-access">
      Open {name}
    </button>
  );
}

function Workspace() {
  const error = useBoot();
  const mode = useBoard((s) => s.mode);
  const agentOpen = useUi((s) => s.agentOpen);
  const editing = useUi((s) => s.editingNodeId);
  const simulating = useUi((s) => s.simulatingNodeId);
  const perfOpen = useUi((s) => s.perfOpen);
  useShortcuts();
  useEditParam();
  useCheckoutReturn();
  useEffect(() => {
    if (error) toast(error, 'error');
  }, [error]);
  return (
    <div className={`shell${agentOpen ? '' : ' agent-closed'}`}>
      <main className="canvas-wrap" aria-label="Board canvas" aria-busy={mode === 'loading'}>
        {mode === 'loading' ? (
          <div className="splash" data-testid="loading">
            <DocAccess />
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
      <RunDialog />
      <ExportDialog />
      <ShareDialog />
      <BillingDialog />
      <ReelDialog />
      <Toasts />
      {editing && (
        <EditorBoundary key={editing}>
          <Suspense fallback={<div className="editor-loading">Opening 3D…</div>}>
            <EditorOverlay nodeId={editing} />
          </Suspense>
        </EditorBoundary>
      )}
      {desktopBridge && (
        <Suspense fallback={null}>
          <DesktopIntegration bridge={desktopBridge} />
        </Suspense>
      )}
      {perfOpen && (
        <Suspense fallback={null}>
          <PerfPanel />
        </Suspense>
      )}
      {simulating && (
        <EditorBoundary key={simulating}>
          <Suspense fallback={<div className="editor-loading">Opening simulator…</div>}>
            <SimulatorOverlay nodeId={simulating} />
          </Suspense>
        </EditorBoundary>
      )}
    </div>
  );
}

/** A 3D failure (no WebGL, bad file) closes the editor instead of taking the canvas down. */
class EditorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    toast(`The 3D view could not start: ${error.message}`, 'error');
    useUi.setState({ editingNodeId: null, simulatingNodeId: null });
    const u = new URL(location.href);
    u.searchParams.delete('edit');
    history.replaceState(null, '', u);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
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
