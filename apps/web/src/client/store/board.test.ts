import { starterGraph } from '@annie3d/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const applyOps = vi.fn();
const board = vi.fn();
vi.mock('../api/client', () => ({
  api: { applyOps: (...a: unknown[]) => applyOps(...a), board: (...a: unknown[]) => board(...a) },
}));
vi.mock('./persist', () => ({
  loadOutbox: async () => [],
  saveOutbox: async () => {},
  saveGuest: async () => {},
}));

const { dispatch, loadGuestBoard, loadSnapshot, redo, undo, useBoard } = await import('./board');

function snapshot() {
  const g = starterGraph('splash-hero');
  const model = g.nodes.find((n) => n.kind === 'model3d')!;
  const stage = g.nodes.find((n) => n.kind === 'stage')!;
  // Give model and stage a current version so staleness can be observed.
  const nodes = g.nodes.map((n) => ({
    ...n,
    stale: false,
    currentVersionId: n.id === model.id || n.id === stage.id ? crypto.randomUUID() : null,
  }));
  return {
    snap: {
      board: {
        id: crypto.randomUUID(),
        title: 'T',
        updatedAt: new Date().toISOString(),
        thumbnailUrl: null,
        seq: 1,
        role: 'owner' as const,
      },
      nodes,
      edges: g.edges,
      versions: [],
    },
    model,
    stage,
  };
}

describe('board store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    applyOps.mockReset();
    board.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('applies, undoes and redoes through inverse ops', () => {
    const g = starterGraph('stone-water');
    loadGuestBoard({ title: 'g', nodes: g.nodes, edges: g.edges, versions: [] });
    const id = g.nodes[0]!.id;
    expect(dispatch([{ type: 'node.update', id, patch: { label: 'Renamed' } }])).toBe(true);
    expect(useBoard.getState().graph.nodes.get(id)!.label).toBe('Renamed');
    undo();
    expect(useBoard.getState().graph.nodes.get(id)!.label).toBe('Product photo');
    redo();
    expect(useBoard.getState().graph.nodes.get(id)!.label).toBe('Renamed');
  });

  it('rejects an invalid op without touching state', () => {
    const g = starterGraph('stone-water');
    loadGuestBoard({ title: 'g', nodes: g.nodes, edges: g.edges, versions: [] });
    const before = useBoard.getState().graph;
    expect(dispatch([{ type: 'node.delete', ids: [crypto.randomUUID()] }])).toBe(false);
    expect(useBoard.getState().graph).toBe(before);
    expect(useBoard.getState().lastError).toBeTruthy();
  });

  it('marks downstream versioned nodes stale when an input changes, not on moves', () => {
    const { snap, model, stage } = snapshot();
    loadSnapshot(snap);
    applyOps.mockResolvedValue({ seq: 2, duplicate: false });
    dispatch([{ type: 'node.move', moves: [{ id: model.id, x: 5, y: 5 }] }]);
    expect(useBoard.getState().stale.size).toBe(0);
    dispatch([{ type: 'node.update', id: model.id, patch: { settings: { detail: 'high' } } }]);
    expect(useBoard.getState().stale.has(model.id)).toBe(true);
    expect(useBoard.getState().stale.has(stage.id)).toBe(true);
  });

  it('batches edits made within 250 ms into one request', async () => {
    const { snap, model } = snapshot();
    loadSnapshot(snap);
    applyOps.mockResolvedValue({ seq: 2, duplicate: false });
    dispatch([{ type: 'node.update', id: model.id, patch: { label: 'a' } }]);
    dispatch([{ type: 'node.update', id: model.id, patch: { label: 'b' } }]);
    dispatch([{ type: 'node.update', id: model.id, patch: { label: 'c' } }]);
    await vi.advanceTimersByTimeAsync(300);
    expect(applyOps).toHaveBeenCalledTimes(1);
    expect(applyOps.mock.calls[0]![2]).toHaveLength(3);
    expect(useBoard.getState().saveState).toBe('saved');
  });

  it('retries a failed batch with the same opId (idempotent), then saves', async () => {
    const { snap, model } = snapshot();
    loadSnapshot(snap);
    applyOps
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 503 }))
      .mockResolvedValue({ seq: 2, duplicate: false });
    dispatch([{ type: 'node.update', id: model.id, patch: { label: 'x' } }]);
    await vi.advanceTimersByTimeAsync(300);
    expect(useBoard.getState().saveState).toBe('error');
    await vi.advanceTimersByTimeAsync(2100);
    expect(applyOps).toHaveBeenCalledTimes(2);
    expect(applyOps.mock.calls[0]![1]).toBe(applyOps.mock.calls[1]![1]);
    expect(useBoard.getState().saveState).toBe('saved');
  });

  it('drops a rejected batch and resyncs from the server snapshot', async () => {
    const { snap, model } = snapshot();
    loadSnapshot(snap);
    applyOps.mockRejectedValueOnce(Object.assign(new Error('conflict'), { status: 409 }));
    board.mockResolvedValue(snap);
    dispatch([{ type: 'node.update', id: model.id, patch: { label: 'lost' } }]);
    await vi.advanceTimersByTimeAsync(300);
    expect(board).toHaveBeenCalledTimes(1);
    expect(useBoard.getState().graph.nodes.get(model.id)!.label).toBeNull();
  });

  it('keeps known versions when the same board resyncs, not across boards', () => {
    const { snap, model } = snapshot();
    const version = (id: string, versionNo: number) =>
      ({ id, nodeId: model.id, versionNo, outputs: [] }) as unknown as (typeof snap.versions)[number];
    // v1 is known; the resync snapshot carries only the current v2 (as the server sends it).
    loadSnapshot({ ...snap, versions: [version('v1', 1)] });
    loadSnapshot({ ...snap, versions: [version('v2', 2)] });
    expect([...useBoard.getState().versions.keys()].sort()).toEqual(['v1', 'v2']);
    // Another board starts clean.
    loadSnapshot({
      ...snap,
      board: { ...snap.board, id: crypto.randomUUID() },
      versions: [version('v3', 1)],
    });
    expect([...useBoard.getState().versions.keys()]).toEqual(['v3']);
  });
});
