import { creditsFor, NODE_DEFS, STARTER_META, STARTERS } from '@annie3d/contracts';
import { useQuery } from '@tanstack/react-query';
import { useReactFlow, useViewport } from '@xyflow/react';
import { ChevronDown, Share2, Sparkles } from 'lucide-react';
import { memo, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { useMe } from '../api/me';
import { insertStarter } from '../canvas/actions';
import { signOut } from '../lib/auth';
import { useBoard } from '../store/board';
import { useRuns } from '../store/runs';
import { toast, useUi } from '../store/ui';
import { Popover } from './Popover';
import { ReelButton } from './ReelDialog';

const SAVE_LABEL = {
  saved: 'Saved',
  saving: 'Saving…',
  offline: 'Offline · will sync',
  error: 'Retrying…',
} as const;

export function TopBar() {
  return (
    <header className="topbar">
      <div className="pill">
        <a href="/home" className="logo-link" aria-label="Annie 3D home">
          <span className="logo-mark">A</span>
        </a>
        <Title />
        <SaveState />
      </div>
      <Starters />
      <RunAll />
      <ReelButton />
      <div className="spacer" />
      <div className="pill hide-sm">
        <Zoom />
      </div>
      <Account />
    </header>
  );
}

function Title() {
  const title = useBoard((s) => s.title);
  const boardId = useBoard((s) => s.boardId);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = async () => {
    const v = (draft ?? '').trim();
    setDraft(null);
    if (!v || v === title) return;
    useBoard.setState({ title: v });
    if (boardId) {
      try {
        await api.renameBoard(boardId, v);
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    }
  };
  return (
    <input
      className="title-input"
      aria-label="Board title"
      value={draft ?? title}
      maxLength={120}
      onFocus={() => setDraft(title)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(null);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function SaveState() {
  const mode = useBoard((s) => s.mode);
  const state = useBoard((s) => s.saveState);
  if (mode === 'guest')
    return (
      <span className="save-state" data-state="offline" title="Guest boards are kept in this browser">
        Not signed in
      </span>
    );
  return (
    <span className="save-state" data-state={state} data-testid="save-state">
      {SAVE_LABEL[state]}
    </span>
  );
}

function Starters() {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const rf = useReactFlow();
  const add = (id: (typeof STARTERS)[number]) => {
    setMenu(null);
    // Drop below everything already on the board, left-aligned with the viewport centre.
    const nodes = [...useBoard.getState().graph.nodes.values()];
    const maxY = nodes.length ? Math.max(...nodes.map((n) => n.y)) + 520 : 0;
    const c = rf.screenToFlowPosition({ x: innerWidth * 0.2, y: innerHeight / 2 });
    const ids = insertStarter(id, { x: Math.round(c.x), y: Math.round(maxY) });
    requestAnimationFrame(
      () => void rf.fitView({ nodes: ids.map((i) => ({ id: i })), duration: 300, padding: 0.15 }),
    );
  };
  return (
    <div className="pill">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMenu(menu ? null : { x: r.left, y: r.bottom + 6 });
        }}
        data-testid="starters-button"
      >
        <Sparkles size={16} aria-hidden="true" /> Starters <ChevronDown size={14} aria-hidden="true" />
      </button>
      {menu && (
        <Popover x={menu.x} y={menu.y} onClose={() => setMenu(null)} label="Starters" testId="starters-menu">
          <div role="menu">
            {STARTERS.map((id) => (
              <button
                type="button"
                role="menuitem"
                key={id}
                onClick={() => add(id)}
                data-testid={`starter-${id}`}
                style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 2 }}
              >
                <span>
                  <b>{STARTER_META[id].title}</b> · {STARTER_META[id].vertical}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {STARTER_META[id].description}
                </span>
              </button>
            ))}
          </div>
        </Popover>
      )}
    </div>
  );
}

/** Run all · cost. The client sum is a hint; the server estimate (with cache hits) is shown before charging. */
function RunAll() {
  const nodes = useBoard((s) => s.graph.nodes);
  const mode = useBoard((s) => s.mode);
  const boardId = useBoard((s) => s.boardId);
  const seq = useBoard((s) => s.seq);
  const running = useRuns((s) => s.activeRunId !== null);
  const naive = useMemo(() => {
    let c = 0;
    for (const n of nodes.values()) if (NODE_DEFS[n.kind].runnable) c += creditsFor(n.kind, n.settings);
    return c;
  }, [nodes]);
  // Signed-in boards show the server's number, which knows what is cached (free).
  const est = useQuery({
    queryKey: ['estimate', boardId, null, 'all', seq],
    queryFn: () => api.estimate(boardId!, null, 'all'),
    enabled: mode === 'remote' && !!boardId && !running,
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  });
  const cost = mode === 'remote' && est.data ? est.data.totalCredits : naive;
  const onClick = () => {
    if (mode === 'guest') return useUi.setState({ signInPrompt: { reason: 'run' } });
    useUi.setState({ dialog: { type: 'run', nodeId: null, scope: 'all' } });
  };
  const cancel = async () => {
    const id = useRuns.getState().activeRunId;
    if (!id) return;
    try {
      await api.cancelRun(id);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  if (running) {
    return (
      <div className="pill">
        <span className="running-dot" aria-hidden="true" />
        <span className="running-label" aria-live="polite">
          Running…
        </span>
        <button type="button" onClick={() => void cancel()} data-testid="cancel-run">
          Cancel
        </button>
      </div>
    );
  }
  const upToDate = mode === 'remote' && !!est.data && cost === 0;
  return (
    <div className="pill">
      <button
        type="button"
        className="primary"
        onClick={onClick}
        data-testid="run-all"
        title="Cached nodes are free; the exact cost is shown before you confirm"
      >
        {upToDate ? 'Up to date' : `Run all · ${cost} cr`}
      </button>
    </div>
  );
}

const ZOOM_STEP = 1.25;

const Zoom = memo(function Zoom() {
  const { zoom } = useViewport();
  const rf = useReactFlow();
  // Rapid clicks interrupt the running transition; stepping from the live (mid-animation) zoom
  // made five clicks move 54% → 43% (E2E, 2026-09-24). Step from the pending target instead.
  const target = useRef<number | null>(null);
  const step = (factor: number) => {
    const next = Math.min(2, Math.max(0.1, (target.current ?? rf.getZoom()) * factor));
    target.current = next;
    void rf.zoomTo(next, { duration: 150 }).then(() => {
      if (target.current === next) target.current = null;
    });
  };
  return (
    <>
      <button type="button" aria-label="Zoom out" onClick={() => step(1 / ZOOM_STEP)}>
        −
      </button>
      <button
        type="button"
        aria-label={`${Math.round(zoom * 100)}% zoom, fit to screen`}
        title="Fit to screen (Shift+1)"
        onClick={() => void rf.fitView({ duration: 250, padding: 0.1 })}
        style={{ minWidth: 52, justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}
        data-testid="zoom-level"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" aria-label="Zoom in" onClick={() => step(ZOOM_STEP)}>
        +
      </button>
    </>
  );
});

function Account() {
  const me = useMe();
  const mode = useBoard((s) => s.mode);
  const share = () =>
    mode === 'guest'
      ? useUi.setState({ signInPrompt: { reason: 'share' } })
      : useUi.setState({ dialog: { type: 'share' } });
  return (
    <div className="pill">
      {me.data ? (
        <button
          type="button"
          className="credits"
          onClick={() => useUi.setState({ dialog: { type: 'billing' } })}
          data-testid="credits"
          title="Credits"
        >
          {me.data.credits.balance} cr
        </button>
      ) : (
        <button
          type="button"
          onClick={() => useUi.setState({ signInPrompt: { reason: 'save' } })}
          data-testid="sign-in"
        >
          Sign in
        </button>
      )}
      <button type="button" onClick={share} data-testid="share">
        <Share2 size={16} aria-hidden="true" /> Share
      </button>
      {me.data && (
        <AccountMenu name={me.data.user.name} email={me.data.user.email} image={me.data.user.image} />
      )}
    </div>
  );
}

function AccountMenu({ name, email, image }: { name: string; email: string; image: string | null }) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  return (
    <>
      <button
        type="button"
        className="avatar-btn"
        aria-label={`Account: ${name}`}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMenu(menu ? null : { x: r.right - 220, y: r.bottom + 6 });
        }}
        data-testid="account"
      >
        {image ? (
          <img src={image} alt="" width={26} height={26} className="avatar" />
        ) : (
          <span className="avatar">{name.slice(0, 1)}</span>
        )}
      </button>
      {menu && (
        <Popover x={menu.x} y={menu.y} onClose={() => setMenu(null)} label="Account" testId="account-menu">
          <div className="account-head">
            <b>{name}</b>
            <span className="muted small">{email}</span>
          </div>
          <div role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null);
                useUi.setState({ dialog: { type: 'billing' } });
              }}
            >
              Credits & plan
            </button>
            <button type="button" role="menuitem" onClick={() => void signOut()} data-testid="sign-out">
              Sign out
            </button>
          </div>
        </Popover>
      )}
    </>
  );
}
