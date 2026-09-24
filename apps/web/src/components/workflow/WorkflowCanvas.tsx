import { checkConnection, NODE_KINDS, type NodeKind } from '@annie3d/contracts';
import { Button, useReducedMotion, useToast } from '@annie3d/ui';
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Crosshair, Maximize2, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectContext } from '@/routes/project/context';
import { useComposerStore } from '@/stores/composerStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { CanvasContextMenu, type CtxItem } from './CanvasContextMenu';
import { type CanvasMode, CanvasToolbar } from './CanvasToolbar';
import { FlowNode } from './FlowNode';
import { NodePalette, type PaletteAction } from './NodePalette';
import { recordNodeUsage } from './nodeMeta';

const nodeTypes = { flow: FlowNode };

interface Props {
  readOnly: boolean;
  onOpenRuns: () => void;
}

function Inner({ readOnly, onOpenRuns }: Props) {
  const doc = useWorkflowStore((s) => s.history.present);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const store = useWorkflowStore;
  const ctx = useProjectContext();
  const rf = useReactFlow();
  const toast = useToast();
  const reduced = useReducedMotion();
  const [dragging, setDragging] = useState(false);
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [mode, setMode] = useState<CanvasMode>('select');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [palette, setPalette] = useState<{
    x: number;
    y: number;
    mode: 'nodes' | 'actions';
    flow?: { x: number; y: number };
  } | null>(null);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dragging) return;
    setRfNodes(
      doc.nodes.map((n) => ({
        id: n.id,
        type: 'flow',
        position: n.position,
        data: {},
        selected: n.id === selectedNodeId,
        draggable: !readOnly,
      })),
    );
  }, [doc.nodes, selectedNodeId, dragging, readOnly]);

  const edges: Edge[] = useMemo(
    () =>
      doc.edges.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourcePort,
        target: e.target,
        targetHandle: e.targetPort,
        type: 'default',
        deletable: !readOnly,
      })),
    [doc.edges, readOnly],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setRfNodes((ns) => applyNodeChanges(changes, ns));
      for (const c of changes) {
        if (c.type === 'select')
          store
            .getState()
            .select(
              c.selected
                ? c.id
                : store.getState().selectedNodeId === c.id
                  ? null
                  : store.getState().selectedNodeId,
            );
        if (c.type === 'position' && c.position && c.dragging) {
          setDragging(true);
          store.getState().moveNode(c.id, c.position, { transient: true });
        }
      }
    },
    [store],
  );
  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      setDragging(false);
      store.getState().moveNode(node.id, node.position);
    },
    [store],
  );
  const isValidConnection = useCallback(
    (c: Connection | Edge) =>
      !!(c.source && c.target && c.sourceHandle && c.targetHandle) &&
      checkConnection(store.getState().history.present, {
        source: c.source,
        sourcePort: c.sourceHandle,
        target: c.target,
        targetPort: c.targetHandle,
      }).ok,
    [store],
  );
  const onConnect = useCallback(
    (c: Connection) => {
      if (readOnly || !c.source || !c.target || !c.sourceHandle || !c.targetHandle) return;
      const ok = store.getState().connect({
        source: c.source,
        sourcePort: c.sourceHandle,
        target: c.target,
        targetPort: c.targetHandle,
      });
      if (!ok)
        toast.push({ message: store.getState().lastConnectionError ?? 'Invalid connection', tone: 'danger' });
    },
    [store, toast, readOnly],
  );

  /** Screen → flow coordinates for placing new nodes. */
  const flowPointAt = useCallback(
    (clientX: number, clientY: number) => rf.screenToFlowPosition({ x: clientX, y: clientY }),
    [rf],
  );
  const centerPoint = useCallback(() => {
    const r = host.current?.getBoundingClientRect();
    return flowPointAt(
      (r?.left ?? 0) + (r?.width ?? 800) / 2 - 170,
      (r?.top ?? 0) + (r?.height ?? 600) / 2 - 150,
    );
  }, [flowPointAt]);

  const addNode = useCallback(
    (kind: NodeKind, at?: { x: number; y: number }) => {
      if (readOnly) return;
      const p = at ?? centerPoint();
      const id = store.getState().addNode(kind, { x: Math.round(p.x), y: Math.round(p.y) });
      recordNodeUsage(kind);
      toast.push({ message: `Added ${NODE_KINDS[kind].title}` });
      return id;
    },
    [readOnly, store, centerPoint, toast],
  );

  const fit = useCallback(
    () => rf.fitView({ padding: 0.12, minZoom: 0.35, maxZoom: 1, duration: reduced ? 0 : 250 }),
    [rf, reduced],
  );
  const focusSelected = useCallback(() => {
    const n = doc.nodes.find((x) => x.id === selectedNodeId);
    if (n) rf.setCenter(n.position.x + 170, n.position.y + 150, { zoom: 1, duration: reduced ? 0 : 250 });
  }, [doc.nodes, selectedNodeId, rf, reduced]);

  const openPalette = useCallback(
    (clientX?: number, clientY?: number, m: 'nodes' | 'actions' = 'nodes') => {
      const r = host.current?.getBoundingClientRect();
      const x = clientX ?? (r?.left ?? 0) + (r?.width ?? 800) / 2 - 170;
      const y = clientY ?? (r?.top ?? 0) + 80;
      setPalette({
        x,
        y,
        mode: m,
        flow: clientX !== undefined && clientY !== undefined ? flowPointAt(clientX, clientY) : undefined,
      });
      setCtxMenu(null);
    },
    [flowPointAt],
  );

  const quickActions: PaletteAction[] = useMemo(
    () => [
      {
        id: 'run',
        label: 'Run workflow',
        hint: ctx.activeRun ? 'a run is active' : `${NODE_KINDS.reconstruct.credits}+ credits`,
        run: () => void ctx.startRun().catch(() => {}),
      },
      {
        id: 'stop',
        label: 'Stop run',
        hint: ctx.activeRun ? 'active' : 'no active run',
        run: () => void ctx.cancelRun(),
      },
      { id: 'add', label: 'Add node…', hint: 'N', run: () => openPalette(undefined, undefined, 'nodes') },
      { id: 'fit', label: 'Fit view', hint: 'all nodes', run: fit },
      { id: 'undo', label: 'Undo', run: () => store.getState().undo() },
      { id: 'redo', label: 'Redo', run: () => store.getState().redo() },
      { id: 'runs', label: 'Show runs panel', run: onOpenRuns },
      { id: 'agent', label: 'Show agent', run: () => useComposerStore.getState().focus() },
      { id: 'studio', label: 'Open studio', run: ctx.openStudio },
    ],
    [ctx, fit, openPalette, store, onOpenRuns],
  );

  // Keyboard shortcuts on the canvas (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing =
        t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette(undefined, undefined, 'actions');
        return;
      }
      if (typing) return;
      const sel = store.getState().selectedNodeId;
      if (!mod) {
        if (e.key === 'n' || e.key === 'N') openPalette();
        else if (e.key === 'v' || e.key === 'V') setMode('select');
        else if (e.key === 'h' || e.key === 'H') setMode('hand');
        else if (e.key === 'c' || e.key === 'C') setMode('comment');
        else if (e.key === 'Escape') {
          setPalette(null);
          setCtxMenu(null);
          setMode('select');
        }
        return;
      }
      if (e.key === 'Enter' && sel) {
        e.preventDefault();
        void ctx.startRun(sel).catch(() => {});
      } else if (e.key.toLowerCase() === 'c' && sel) store.getState().copyNode(sel);
      else if (e.key.toLowerCase() === 'v' && !readOnly) {
        e.preventDefault();
        store.getState().pasteNode();
      } else if (e.key.toLowerCase() === 'd' && sel && !readOnly) {
        e.preventDefault();
        store.getState().duplicateNode(sel);
      } else if (e.key === '.' && sel) focusSelected();
      else if (e.key === '/' && sel) {
        e.preventDefault();
        const n = store.getState().history.present.nodes.find((x) => x.id === sel);
        if (n) useComposerStore.getState().insert(`@${n.title || NODE_KINDS[n.kind].title} `);
      } else if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.getState().redo();
        else store.getState().undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPalette, store, ctx, readOnly, focusSelected]);

  // Open at a readable zoom anchored on the left-most node; the user can fit/zoom from the toolbar.
  const defaultViewport = useMemo(() => {
    const first = store.getState().history.present.nodes;
    const minX = Math.min(...first.map((n) => n.position.x), 0);
    const minY = Math.min(...first.map((n) => n.position.y), 0);
    return { x: 48 - minX * 0.8, y: 120 - minY * 0.8, zoom: 0.8 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const canUndo = useWorkflowStore((s) => s.history.past.length > 0);
  const canRedo = useWorkflowStore((s) => s.history.future.length > 0);
  const hasClipboard = useWorkflowStore((s) => !!s.clipboard);

  const ctxItems: CtxItem[] = ctxMenu
    ? [
        {
          label: 'Add node',
          kbd: 'N',
          onSelect: () => openPalette(ctxMenu.x, ctxMenu.y),
          disabledReason: readOnly ? 'Editors only.' : undefined,
        },
        {
          label: 'Paste',
          kbd: 'MOD V',
          onSelect: () => store.getState().pasteNode(flowPointAt(ctxMenu.x, ctxMenu.y)),
          disabledReason: !hasClipboard ? 'Nothing copied yet.' : readOnly ? 'Editors only.' : undefined,
        },
        {
          label: 'Comment',
          kbd: 'C',
          onSelect: () => addNode('comment', flowPointAt(ctxMenu.x, ctxMenu.y)),
          disabledReason: readOnly ? 'Editors only.' : undefined,
        },
        { label: 'Show agent', sep: true, onSelect: () => useComposerStore.getState().focus() },
        {
          label: 'Quick actions',
          kbd: 'MOD K',
          onSelect: () => openPalette(ctxMenu.x, ctxMenu.y, 'actions'),
        },
      ]
    : [];

  return (
    <div ref={host} className="flow-page" data-testid="workflow-canvas" data-mode={mode}>
      <ReactFlow
        nodes={rfNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onConnectEnd={() => {
          const err = store.getState().lastConnectionError;
          if (err) toast.push({ message: err, tone: 'danger' });
        }}
        onEdgesDelete={(es) => {
          if (!readOnly) for (const e of es) store.getState().disconnect(e.id);
        }}
        onNodesDelete={(ns) => {
          if (!readOnly) for (const n of ns) store.getState().removeNode(n.id);
        }}
        isValidConnection={isValidConnection}
        onPaneClick={(e) => {
          if (mode === 'comment') {
            addNode('comment', flowPointAt(e.clientX, e.clientY));
            setMode('select');
          } else store.getState().select(null);
        }}
        onPaneContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY });
        }}
        onContextMenu={(e) => e.preventDefault()}
        defaultViewport={defaultViewport}
        minZoom={0.2}
        maxZoom={1.6}
        nodesConnectable={!readOnly}
        elementsSelectable
        panOnDrag={mode === 'hand' ? true : [1, 2]}
        selectionOnDrag={mode === 'select'}
        panOnScroll
        zoomOnScroll={false}
        deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
        proOptions={{ hideAttribution: true }}
        aria-label="Workflow canvas"
        onlyRenderVisibleElements={doc.nodes.length > 30}
        style={{ cursor: mode === 'hand' ? 'grab' : mode === 'comment' ? 'crosshair' : undefined }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#d8dce3" />
      </ReactFlow>

      <div className="flow-chrome-top">
        <div className="flow-pill" role="toolbar" aria-label="View tools">
          <Button
            variant="tertiary"
            icon
            size="sm"
            aria-label="Zoom in"
            onClick={() => rf.zoomIn({ duration: reduced ? 0 : 150 })}
          >
            <Plus size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="tertiary"
            icon
            size="sm"
            aria-label="Zoom out"
            onClick={() => rf.zoomOut({ duration: reduced ? 0 : 150 })}
          >
            <Minus size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="tertiary"
            icon
            size="sm"
            aria-label="Fit view"
            onClick={fit}
            data-testid="fit-view"
          >
            <Maximize2 size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="tertiary"
            icon
            size="sm"
            aria-label="Center on selected node"
            onClick={focusSelected}
            disabledReason={selectedNodeId ? undefined : 'Select a node first.'}
          >
            <Crosshair size={16} aria-hidden="true" />
          </Button>
          <span
            className="sep"
            style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 3px' }}
            aria-hidden="true"
          />
          <Button
            variant="tertiary"
            icon
            size="sm"
            aria-label="Undo"
            onClick={() => store.getState().undo()}
            disabledReason={canUndo ? undefined : 'Nothing to undo.'}
            data-testid="undo"
          >
            <Undo2 size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="tertiary"
            icon
            size="sm"
            aria-label="Redo"
            onClick={() => store.getState().redo()}
            disabledReason={canRedo ? undefined : 'Nothing to redo.'}
            data-testid="redo"
          >
            <Redo2 size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => openPalette()}
            disabledReason={readOnly ? 'Editors only.' : undefined}
            data-testid="add-step"
          >
            <Plus size={14} aria-hidden="true" /> Add node
          </Button>
        </div>
      </div>

      <div className="flow-bottom" style={{ pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto', width: '100%' }} id="flow-composer-slot" />
        <div style={{ pointerEvents: 'auto' }}>
          <CanvasToolbar mode={mode} onMode={setMode} onAdd={(k) => addNode(k)} readOnly={readOnly} />
        </div>
      </div>

      {ctxMenu ? (
        <CanvasContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxItems} onClose={() => setCtxMenu(null)} />
      ) : null}
      {palette ? (
        <NodePalette
          x={palette.x}
          y={palette.y}
          mode={palette.mode}
          actions={quickActions}
          onPick={(k) => addNode(k, palette.flow)}
          onClose={() => setPalette(null)}
        />
      ) : null}
    </div>
  );
}

export function WorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}

export default WorkflowCanvas;
