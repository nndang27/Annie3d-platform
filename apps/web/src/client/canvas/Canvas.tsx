import {
  canConnect,
  type EdgeRecord,
  type GraphOp,
  NODE_DEFS,
  type NodeRecord,
  newId,
} from '@annie3d/contracts';
import type { Translator } from '@annie3d/i18n';
import {
  type AriaLabelConfig,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnConnectEnd,
  type OnConnectStart,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  type Viewport,
} from '@xyflow/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { importBoardFile, isBoardFile, setViewCentre } from '../lib/boardFile';
import { markBoardReady } from '../lib/perf';
import { preloadEditorWhenIdle } from '../lib/preload';
import { throttleRAF } from '../lib/throttleRaf';
import { useMedia } from '../lib/useMedia';
import { MAX_ZOOM, MIN_ZOOM } from '../lib/zoom';
import { dispatch, setPositionsLocal, useBoard } from '../store/board';
import { lodFor, useUi } from '../store/ui';
import { createNodeAt } from './actions';
import { imageToNode } from './clipboard';
import { FlowEdge } from './FlowEdge';
import { FlowNode } from './FlowNode';
import { Grid } from './Grid';
import { useWheelZoom } from './useWheelZoom';

// Defined once at module level (React Flow custom-nodes guide: prevents re-mounting every render).
const nodeTypes = { annie: FlowNode };
const edgeTypes = { annie: FlowEdge };

const DIRECTION: Record<
  string,
  'canvas.a11y.up' | 'canvas.a11y.down' | 'canvas.a11y.left' | 'canvas.a11y.right'
> = {
  Up: 'canvas.a11y.up',
  Down: 'canvas.a11y.down',
  Left: 'canvas.a11y.left',
  Right: 'canvas.a11y.right',
};

/** React Flow's screen-reader texts in the current language (its defaults are English). */
function reactFlowLabels(t: Translator): Partial<AriaLabelConfig> {
  return {
    'node.a11yDescription.default': t('canvas.a11y.nodeDescription'),
    'node.a11yDescription.keyboardDisabled': t('canvas.a11y.nodeDescriptionKeyboard'),
    'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }) =>
      t('canvas.a11y.nodeMoved', {
        direction: DIRECTION[direction] ? t(DIRECTION[direction]) : direction,
        x,
        y,
      }),
    'edge.a11yDescription.default': t('canvas.a11y.edgeDescription'),
  };
}

/**
 * Measured node sizes, as React Flow reports them ('dimensions' changes). A controlled flow must
 * hand them back on every new node object (React Flow docs, "Controlled flow"): an object without
 * `measured` counts as unmeasured, so React Flow hid the node (visibility: hidden) until it had
 * measured it again. That happened on every selection and every record update, blinked the node
 * for a frame and blurred a prompt being typed in, saving it empty (E2E, 2026-09-25).
 */
const measuredSizes = new Map<string, { width: number; height: number }>();

/** Stable React Flow node objects: rebuilt only when the record or selection changes. */
const rfNodeCache = new WeakMap<NodeRecord, Node>();
function toRfNode(n: NodeRecord, selected: boolean): Node {
  const hit = rfNodeCache.get(n);
  if (hit && hit.selected === selected) return hit;
  const rf: Node = {
    id: n.id,
    type: 'annie',
    position: { x: n.x, y: n.y },
    data: {},
    selected,
    measured: measuredSizes.get(n.id),
  };
  rfNodeCache.set(n, rf);
  return rf;
}
const rfEdgeCache = new WeakMap<EdgeRecord, Edge>();
function toRfEdge(e: EdgeRecord, type: string): Edge {
  const hit = rfEdgeCache.get(e);
  if (hit && (hit.data as { type: string }).type === type) return hit;
  const rf: Edge = {
    id: e.id,
    type: 'annie',
    source: e.source,
    sourceHandle: 'out',
    target: e.target,
    targetHandle: e.targetPort,
    data: { type },
  };
  rfEdgeCache.set(e, rf);
  return rf;
}

const VP_KEY = (id: string) => `annie3d.vp.${id}`;
function loadViewport(boardId: string | null): Viewport | undefined {
  if (!boardId) return undefined;
  try {
    const v = JSON.parse(localStorage.getItem(VP_KEY(boardId)) ?? 'null') as Viewport | null;
    return v && Number.isFinite(v.x) && Number.isFinite(v.y) && v.zoom > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}
function saveViewport(boardId: string | null, vp: Viewport) {
  if (!boardId) return;
  try {
    localStorage.setItem(
      VP_KEY(boardId),
      JSON.stringify({ x: Math.round(vp.x), y: Math.round(vp.y), zoom: +vp.zoom.toFixed(3) }),
    );
  } catch {
    /* storage unavailable: the viewport simply is not remembered */
  }
}

export function Canvas() {
  const t = useT();
  const ariaLabelConfig = useMemo(() => reactFlowLabels(t), [t]);
  const graph = useBoard((s) => s.graph);
  const selected = useUi((s) => s.selected);
  const tool = useUi((s) => s.tool);
  const touch = useMedia('(pointer: coarse)');
  const rf = useReactFlow();
  const dragStart = useRef(new Map<string, { x: number; y: number }>());
  const connectFrom = useRef<{ nodeId: string } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  useWheelZoom(host);

  const nodes = useMemo(
    () =>
      [...graph.nodes.values()]
        .sort((a, b) => (a.zKey < b.zKey ? -1 : 1))
        .map((n) => toRfNode(n, selected.has(n.id))),
    [graph.nodes, selected],
  );
  const edges = useMemo(
    () =>
      [...graph.edges.values()].map((e) => {
        const src = graph.nodes.get(e.source);
        const dst = graph.nodes.get(e.target);
        const out = src ? NODE_DEFS[src.kind].output?.type : undefined;
        // Screen readers hear node names, not React Flow's default "Edge from <id> to <id>".
        const name = (n: typeof src) => (n ? (n.label ?? t(`node.${n.kind}`)) : '');
        return {
          ...toRfEdge(e, out ?? 'file'),
          ariaLabel: t('canvas.edge.label', { from: name(src), to: name(dst) }),
        };
      }),
    [graph.edges, graph.nodes, t],
  );

  // Drag frames: coalesce to one store update per animation frame (Excalidraw throttleRAF).
  const moveLocal = useMemo(
    () => throttleRAF((moves: { id: string; x: number; y: number }[]) => setPositionsLocal(moves)),
    [],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const moves: { id: string; x: number; y: number }[] = [];
      let sel: Set<string> | null = null;
      for (const c of changes) {
        if (c.type === 'position' && c.position) {
          const cur = useBoard.getState().graph.nodes.get(c.id);
          if (cur && c.dragging && !dragStart.current.has(c.id))
            dragStart.current.set(c.id, { x: cur.x, y: cur.y });
          moves.push({ id: c.id, x: c.position.x, y: c.position.y });
        } else if (c.type === 'select') {
          sel ??= new Set(useUi.getState().selected);
          if (c.selected) sel.add(c.id);
          else sel.delete(c.id);
        } else if (c.type === 'dimensions' && c.dimensions) {
          measuredSizes.set(c.id, c.dimensions);
        } else if (c.type === 'remove') {
          measuredSizes.delete(c.id);
        }
      }
      if (moves.length) moveLocal(...[moves]);
      if (sel) useUi.setState({ selected: sel });
    },
    [moveLocal],
  );

  /** One undoable node.move op per drag gesture, sent on drag stop. */
  const onNodeDragStop = useCallback(() => {
    moveLocal.flush();
    const starts = dragStart.current;
    dragStart.current = new Map();
    const g = useBoard.getState().graph;
    const moves = [...starts.keys()]
      .map((id) => g.nodes.get(id))
      .filter((n): n is NodeRecord => !!n)
      .map((n) => ({ id: n.id, x: n.x, y: n.y }));
    if (!moves.length) return;
    // Reset to start positions, then apply the move through the op path so undo has the inverse.
    setPositionsLocal([...starts.entries()].map(([id, p]) => ({ id, ...p })));
    dispatch([{ type: 'node.move', moves }]);
  }, [moveLocal]);

  /**
   * Delete key: nodes and wires go in ONE batch, so one ⌘Z brings everything back (React Flow
   * reports edge and node removals separately; two batches needed two undos). Wires attached to
   * deleted nodes are removed — and restored — by node.delete itself.
   */
  const onDelete = useCallback(({ nodes: ns, edges: es }: { nodes: Node[]; edges: Edge[] }) => {
    const ids = new Set(ns.map((n) => n.id));
    const ops: GraphOp[] = [];
    const lone = es.filter((e) => !ids.has(e.source) && !ids.has(e.target)).map((e) => e.id);
    if (lone.length) ops.push({ type: 'edge.delete', ids: lone });
    if (ids.size) ops.push({ type: 'node.delete', ids: [...ids] });
    if (ops.length) dispatch(ops);
  }, []);

  const isValidConnection = useCallback((c: Connection | Edge) => {
    if (!c.source || !c.target || !c.targetHandle) return false;
    return canConnect(useBoard.getState().graph, {
      source: c.source,
      sourcePort: 'out',
      target: c.target,
      targetPort: c.targetHandle,
    }).ok;
  }, []);

  const onConnect = useCallback((c: Connection) => {
    connectFrom.current = null;
    if (!c.targetHandle) return;
    dispatch([
      {
        type: 'edge.create',
        edge: {
          id: newId(),
          source: c.source,
          sourcePort: 'out',
          target: c.target,
          targetPort: c.targetHandle,
        },
      },
    ]);
  }, []);

  const onConnectStart: OnConnectStart = useCallback((_, { nodeId, handleType }) => {
    connectFrom.current = nodeId && handleType === 'source' ? { nodeId } : null;
  }, []);

  /** Wire dropped on empty canvas → palette filtered to nodes accepting that type (xyflow AddNodeOnEdgeDrop, MIT). */
  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      const from = connectFrom.current;
      connectFrom.current = null;
      if (!from) return;
      const targetIsPane = (event.target as Element | null)?.classList?.contains('react-flow__pane');
      if (!targetIsPane || !('clientX' in event)) return;
      const pos = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const src = useBoard.getState().graph.nodes.get(from.nodeId);
      const accepts = src ? NODE_DEFS[src.kind].output?.type : undefined;
      useUi.setState({
        palette: {
          x: event.clientX,
          y: event.clientY,
          flowX: pos.x,
          flowY: pos.y,
          accepts,
          fromNodeId: from.nodeId,
        },
      });
    },
    [rf],
  );

  /**
   * LOD from the SETTLED zoom only (tldraw getEfficientZoomLevel: debounced while the camera moves).
   * A timer after the last move, not onMoveEnd alone: WebKit/Firefox skip onMoveEnd when a zoom
   * transition is interrupted by the next one (E2E, 2026-09-24).
   */
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyZoom = useCallback((zoom: number) => {
    const lod = lodFor(zoom);
    const s = useUi.getState();
    if (s.lod !== lod || Math.abs(s.zoom - zoom) > 0.05) useUi.setState({ lod, zoom });
  }, []);
  const onMove = useCallback(
    (_: unknown, vp: Viewport) => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => applyZoom(vp.zoom), 150);
    },
    [applyZoom],
  );
  const onMoveEnd = useCallback(
    (_: unknown, vp: Viewport) => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      applyZoom(vp.zoom);
      saveViewport(useBoard.getState().boardId, vp);
    },
    [applyZoom],
  );

  /**
   * First paint frames `initialFit` (the example's first line) or the whole board. Passed as the `fitView` prop so
   * React Flow waits until nodes are measured (a manual fitView in onInit ran before measuring).
   */
  const [initial] = useState(() => {
    // tldraw keeps the camera per page: reopening a board returns to where you were.
    const saved = loadViewport(useBoard.getState().boardId);
    if (saved) return { saved, fit: undefined };
    // Otherwise frame the first line (lowest z-keys), not a whole large board at unreadable zoom.
    const ids =
      useUi.getState().initialFit ??
      [...useBoard.getState().graph.nodes.values()]
        .sort((a, b) => (a.zKey < b.zKey ? -1 : 1))
        .slice(0, 7)
        .map((n) => n.id);
    return {
      saved: undefined,
      fit: {
        nodes: ids.map((id) => ({ id })),
        padding: { top: '84px', bottom: '84px', left: '40px', right: '40px' } as const,
        maxZoom: 1,
      },
    };
  });
  const onInit = useCallback(() => {
    applyZoom(rf.getZoom());
    setViewCentre(() => rf.screenToFlowPosition({ x: innerWidth / 2 - 200, y: innerHeight / 2 - 150 }));
    // "Board ready": the first frame with node previews decoded (Performance panel).
    requestAnimationFrame(() => {
      const imgs = [...document.querySelectorAll<HTMLImageElement>('.node-preview img')];
      void Promise.all(imgs.map((i) => i.decode().catch(() => {}))).then(() => {
        markBoardReady();
        preloadEditorWhenIdle(() => {
          const { graph, versions } = useBoard.getState();
          return [...graph.nodes.values()].some(
            (n) =>
              !!n.currentVersionId &&
              !!versions.get(n.currentVersionId)?.outputs.some((o) => o.kind === 'model3d'),
          );
        });
      });
    });
  }, [rf, applyZoom]);

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault();
      const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      useUi.setState({
        contextMenu: { x: e.clientX, y: e.clientY, flowX: pos.x, flowY: pos.y, nodeId: node.id },
      });
    },
    [rf],
  );

  const onPaneContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      e.preventDefault();
      const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      useUi.setState({ contextMenu: { x: e.clientX, y: e.clientY, flowX: pos.x, flowY: pos.y } });
    },
    [rf],
  );

  /** Double-click on empty canvas: a Text node, ready to type (Miro/FigJam sticky on double-click). */
  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!(e.target as Element).classList.contains('react-flow__pane')) return;
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = createNodeAt('text', p.x - 150, p.y - 24);
      if (id) useUi.setState({ editPromptId: id });
    },
    [rf],
  );

  /** Image files dropped from the desktop become Photo nodes where they land. */
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const board = [...e.dataTransfer.files].find(isBoardFile);
      if (board) {
        e.preventDefault();
        void importBoardFile(board, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
        return;
      }
      const files = [...e.dataTransfer.files].filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type));
      if (!files.length) return;
      e.preventDefault();
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      files.forEach((f, i) => void imageToNode(f, { x: p.x - 150 + i * 40, y: p.y - 100 + i * 40 }));
    },
    [rf],
  );

  return (
    <ReactFlow
      ref={host}
      edgeTypes={edgeTypes}
      onDoubleClick={onDoubleClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      zoomOnDoubleClick={false}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onDelete={onDelete}
      onNodeDragStop={onNodeDragStop}
      onConnect={onConnect}
      onConnectStart={onConnectStart}
      onConnectEnd={onConnectEnd}
      isValidConnection={isValidConnection}
      onMove={onMove}
      onMoveEnd={onMoveEnd}
      onInit={onInit}
      fitView={!initial.saved}
      fitViewOptions={initial.fit}
      defaultViewport={initial.saved}
      onPaneContextMenu={onPaneContextMenu}
      onNodeContextMenu={onNodeContextMenu}
      onPaneClick={() => useUi.setState({ contextMenu: null, palette: null })}
      // Viewport culling: off-screen nodes are not rendered (React Flow perf guide; tldraw culling).
      onlyRenderVisibleElements
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      // Touch screens: one finger pans (a marquee would fight scrolling), two fingers pinch-zoom.
      panOnDrag={tool === 'hand' || touch ? true : [1, 2]}
      selectionOnDrag={tool === 'select' && !touch}
      // A marquee picks every node it touches (Figma), not only fully enclosed ones.
      selectionMode={SelectionMode.Partial}
      panOnScroll
      zoomOnPinch
      deleteKeyCode={['Backspace', 'Delete']}
      multiSelectionKeyCode={['Meta', 'Shift']}
      nodeDragThreshold={2}
      connectionRadius={28}
      elevateNodesOnSelect={false}
      proOptions={{ hideAttribution: false }}
      ariaLabelConfig={ariaLabelConfig}
      style={{ background: 'var(--canvas-bg)' }}
    >
      <Grid />
    </ReactFlow>
  );
}
