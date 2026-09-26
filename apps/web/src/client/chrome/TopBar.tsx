import { creditsFor, NODE_DEFS, STARTER_META, STARTERS } from '@annie3d/contracts';
import { useQuery } from '@tanstack/react-query';
import { useReactFlow, useViewport } from '@xyflow/react';
import {
  ChevronDown,
  Download,
  FilePlus,
  FolderOpen,
  LayoutTemplate,
  LogIn,
  MoreHorizontal,
  Save,
  Share2,
} from 'lucide-react';
import { memo, type ReactNode, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { useMe } from '../api/me';
import { insertStarter } from '../canvas/actions';
import { signOut } from '../lib/auth';
import { openBoardFilePicker } from '../lib/boardFile';
import { docs, isDoc, openBoardFile, saveDocument, useDoc, webFiles, withCloud } from '../lib/doc';
import { MAX_ZOOM, MIN_ZOOM, zoomStep } from '../lib/zoom';
import { useBoard } from '../store/board';
import { useRuns } from '../store/runs';
import { toast, useUi } from '../store/ui';
import { Popover } from './Popover';
import { ReelButton } from './ReelDialog';

const SAVE_LABEL = {
  saved: 'Saved',
  saving: 'Saving…',
  offline: 'Offline, will sync',
  error: 'Retrying…',
} as const;

/**
 * One bar across the top (not a row of floating cards): the board on the left, what to do with
 * it in the middle, the view and the account on the right. The performance panel is a developer
 * tool and stays behind ⌥P.
 */
export function TopBar() {
  return (
    <header className="topbar pill">
      <a href="/home" className="logo-link" aria-label="Annie 3D home">
        <span className="logo-mark">A</span>
      </a>
      <Title />
      <SaveState />
      <FileMenu />
      <span className="sep" />
      <Starters />
      <RunAll />
      <ReelButton />
      <div className="spacer" />
      <div className="group hide-sm">
        <Zoom />
      </div>
      <span className="sep hide-sm" />
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
  const doc = useDoc((s) => s.doc);
  // A board file: saved means written to the file, whatever its cloud copy is doing.
  if (doc)
    return (
      <span
        className="save-state"
        data-state={doc.busy ? 'saving' : doc.dirty ? 'offline' : 'saved'}
        title={doc.path ?? 'Not saved to a file yet'}
        data-testid="doc-state"
      >
        <span className="lbl">{doc.busy ?? (doc.dirty ? 'Edited' : doc.path ? 'Saved' : 'Not saved')}</span>
      </span>
    );
  // A guest's board is kept in this browser: said plainly, not as a warning ("Sign in" is next to it).
  if (mode === 'guest')
    return (
      <span className="save-state hide-sm" title="Sign in to keep it in your account">
        Saved in this browser
      </span>
    );
  return (
    <span className="save-state" data-state={state} data-testid="save-state">
      <span className="lbl">{SAVE_LABEL[state]}</span>
    </span>
  );
}

/**
 * Board file menu. Desktop: save to a file (the document's own file in a file window), open files
 * in their own windows, new file. Website: download the board, open a file into it.
 */
function FileMenu() {
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const inDoc = useDoc((s) => !!s.doc);
  const item = (label: string, icon: ReactNode, kbd: string | null, run: () => void, testId?: string) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setMenu(null);
        run();
      }}
      data-testid={testId}
    >
      {icon} {label}
      {kbd && <kbd>{kbd}</kbd>}
    </button>
  );
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="Board file"
        aria-haspopup="menu"
        aria-expanded={!!menu}
        title="Board file"
        onClick={(e) => setMenu(menu ? null : e.currentTarget.getBoundingClientRect())}
        data-testid="file-menu"
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {menu && (
        <Popover
          anchor={menu}
          trigger={trigger.current}
          onClose={() => setMenu(null)}
          label="Board file"
          testId="file-menu-popover"
        >
          <div role="menu">
            {docs || webFiles ? (
              <>
                {item(
                  inDoc ? 'Save' : 'Save as file…',
                  <Save size={15} aria-hidden="true" />,
                  '⌘S',
                  () => void saveDocument(),
                  'file-export',
                )}
                {inDoc &&
                  item(
                    'Save as…',
                    <Save size={15} aria-hidden="true" />,
                    '⇧⌘S',
                    () => void saveDocument(true),
                    'file-save-as',
                  )}
                {item('Open…', <FolderOpen size={15} aria-hidden="true" />, '⌘O', openBoardFile, 'file-open')}
                {docs &&
                  item(
                    'New board file',
                    <FilePlus size={15} aria-hidden="true" />,
                    '⌘N',
                    () => docs?.create(),
                    'file-new',
                  )}
                {item(
                  'Import into this board…',
                  <Download size={15} aria-hidden="true" />,
                  null,
                  openBoardFilePicker,
                  'file-import',
                )}
              </>
            ) : (
              <>
                {item(
                  'Download board (.annie3d)',
                  <Download size={15} aria-hidden="true" />,
                  '⌘S',
                  () => void saveDocument(),
                  'file-export',
                )}
                {item(
                  'Open board file…',
                  <FolderOpen size={15} aria-hidden="true" />,
                  '⌘O',
                  openBoardFilePicker,
                  'file-import',
                )}
              </>
            )}
          </div>
        </Popover>
      )}
    </>
  );
}

function Starters() {
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
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
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={(e) => setMenu(menu ? null : e.currentTarget.getBoundingClientRect())}
        data-testid="starters-button"
        aria-label="Templates"
      >
        <LayoutTemplate size={16} aria-hidden="true" /> <span className="lbl">Templates</span>
        <ChevronDown size={14} aria-hidden="true" className="lbl" />
      </button>
      {menu && (
        <Popover
          anchor={menu}
          trigger={trigger.current}
          onClose={() => setMenu(null)}
          label="Templates"
          testId="starters-menu"
        >
          <div role="menu" className="template-menu">
            {STARTERS.map((id) => (
              <button
                type="button"
                role="menuitem"
                key={id}
                onClick={() => add(id)}
                data-testid={`starter-${id}`}
              >
                <span className="template-cat">{STARTER_META[id].vertical}</span>
                <b>{STARTER_META[id].title}</b>
                <span className="template-desc">{STARTER_META[id].description}</span>
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  );
}

/** Run all and its cost. The client sum is a hint; the server estimate (with cache hits) is shown before charging. */
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
    withCloud('run', { kind: 'run', nodeId: null, scope: 'all' }, () =>
      useUi.setState({ dialog: { type: 'run', nodeId: null, scope: 'all' } }),
    );
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
      <div className="group">
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
    <button
      type="button"
      className="primary"
      onClick={onClick}
      data-testid="run-all"
      title="Unchanged nodes are free; the exact cost is shown before you confirm"
    >
      {upToDate ? (
        'Up to date'
      ) : (
        <>
          Run all<span className="cost lbl">{cost} credits</span>
        </>
      )}
    </button>
  );
}

const Zoom = memo(function Zoom() {
  const { zoom } = useViewport();
  const rf = useReactFlow();
  return (
    <>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => zoomStep(rf, -1)}
        disabled={zoom <= MIN_ZOOM + 0.001}
      >
        −
      </button>
      <button
        type="button"
        aria-label={`${Math.round(zoom * 100)}% zoom, fit to screen`}
        title="Fit to screen (Shift+1)"
        onClick={() => void rf.fitView({ duration: 250, padding: 0.1 })}
        className="zoom-level"
        data-testid="zoom-level"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => zoomStep(rf, 1)}
        disabled={zoom >= MAX_ZOOM - 0.001}
      >
        +
      </button>
    </>
  );
});

function Account() {
  const me = useMe();
  const mode = useBoard((s) => s.mode);
  const share = () =>
    isDoc()
      ? toast('A board file is shared as the file: send the .annie3d file itself.')
      : mode === 'guest'
        ? useUi.setState({ signInPrompt: { reason: 'share' } })
        : useUi.setState({ dialog: { type: 'share' } });
  return (
    <div className="group">
      {me.data ? (
        <button
          type="button"
          className="credits"
          onClick={() => useUi.setState({ dialog: { type: 'billing' } })}
          data-testid="credits"
          title="Credits and plan"
        >
          {me.data.credits.balance} credits
        </button>
      ) : (
        <button
          type="button"
          className="sign-in"
          onClick={() => useUi.setState({ signInPrompt: { reason: 'save' } })}
          data-testid="sign-in"
        >
          <LogIn size={16} aria-hidden="true" />
          Sign in
        </button>
      )}
      <button type="button" onClick={share} data-testid="share" aria-label="Share">
        <Share2 size={16} aria-hidden="true" /> <span className="lbl">Share</span>
      </button>
      {me.data && (
        <AccountMenu name={me.data.user.name} email={me.data.user.email} image={me.data.user.image} />
      )}
    </div>
  );
}

function AccountMenu({ name, email, image }: { name: string; email: string; image: string | null }) {
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="avatar-btn"
        aria-label={`Account: ${name}`}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={(e) => setMenu(menu ? null : e.currentTarget.getBoundingClientRect())}
        data-testid="account"
      >
        {image ? (
          <img src={image} alt="" width={26} height={26} className="avatar" />
        ) : (
          <span className="avatar">{name.slice(0, 1)}</span>
        )}
      </button>
      {menu && (
        <Popover
          anchor={menu}
          align="end"
          trigger={trigger.current}
          onClose={() => setMenu(null)}
          label="Account"
          testId="account-menu"
        >
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
