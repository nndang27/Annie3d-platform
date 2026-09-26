import { creditsFor, NODE_DEFS, STARTERS } from '@annie3d/contracts';
import type { MessageKey } from '@annie3d/i18n';
import { useQuery } from '@tanstack/react-query';
import { useReactFlow, useViewport } from '@xyflow/react';
import {
  ChevronDown,
  Download,
  FilePlus,
  FolderOpen,
  Languages,
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
import { boardTitle, useT } from '../i18n';
import { signOut } from '../lib/auth';
import { openBoardFilePicker } from '../lib/boardFile';
import { docs, isDoc, openBoardFile, saveDocument, useDoc, webFiles, withCloud } from '../lib/doc';
import { MAX_ZOOM, MIN_ZOOM, zoomStep } from '../lib/zoom';
import { useBoard } from '../store/board';
import { useRuns } from '../store/runs';
import { toast, useUi } from '../store/ui';
import { LanguageButton, LanguageMenu } from './LanguageMenu';
import { Popover } from './Popover';
import { ReelButton } from './ReelDialog';

const SAVE_LABEL = {
  saved: 'topbar.save.saved',
  saving: 'topbar.save.saving',
  offline: 'topbar.save.offline',
  error: 'topbar.save.error',
} as const satisfies Record<string, MessageKey>;

/**
 * One bar across the top (not a row of floating cards): the board on the left, what to do with
 * it in the middle, the view and the account on the right. The performance panel is a developer
 * tool and stays behind ⌥P.
 */
export function TopBar() {
  const t = useT();
  return (
    <header className="topbar pill">
      <a href="/home" className="logo-link" aria-label={t('topbar.home')}>
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
  const t = useT();
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
      aria-label={t('topbar.title')}
      value={draft ?? boardTitle(t, title)}
      maxLength={120}
      onFocus={() => setDraft(boardTitle(t, title))}
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
  const t = useT();
  const mode = useBoard((s) => s.mode);
  const state = useBoard((s) => s.saveState);
  const doc = useDoc((s) => s.doc);
  // A board file: saved means written to the file, whatever its cloud copy is doing.
  if (doc)
    return (
      <span
        className="save-state"
        data-state={doc.busy ? 'saving' : doc.dirty ? 'offline' : 'saved'}
        title={doc.path ?? t('topbar.save.noFile')}
        data-testid="doc-state"
      >
        <span className="lbl">
          {doc.busy ??
            (doc.dirty
              ? t('topbar.save.edited')
              : doc.path
                ? t('topbar.save.saved')
                : t('topbar.save.notSaved'))}
        </span>
      </span>
    );
  // A guest's board is kept in this browser: said plainly, not as a warning ("Sign in" is next to it).
  if (mode === 'guest')
    return (
      <span className="save-state hide-sm" title={t('topbar.save.guestHint')}>
        {t('topbar.save.guest')}
      </span>
    );
  return (
    <span className="save-state" data-state={state} data-testid="save-state">
      <span className="lbl">{t(SAVE_LABEL[state])}</span>
    </span>
  );
}

/**
 * Board file menu. Desktop: save to a file (the document's own file in a file window), open files
 * in their own windows, new file. Website: download the board, open a file into it.
 */
function FileMenu() {
  const t = useT();
  const [menu, setMenu] = useState<DOMRect | null>(null);
  // Phones hide the top bar's language button: the same list opens from here.
  const [langMenu, setLangMenu] = useState<DOMRect | null>(null);
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
        aria-label={t('topbar.file.menu')}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        title={t('topbar.file.menu')}
        onClick={(e) => {
          setLangMenu(null);
          setMenu(menu ? null : e.currentTarget.getBoundingClientRect());
        }}
        data-testid="file-menu"
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {menu && (
        <Popover
          anchor={menu}
          trigger={trigger.current}
          onClose={() => setMenu(null)}
          label={t('topbar.file.menu')}
          testId="file-menu-popover"
        >
          <div role="menu">
            {docs || webFiles ? (
              <>
                {item(
                  inDoc ? t('topbar.file.save') : t('topbar.file.saveAsFile'),
                  <Save size={15} aria-hidden="true" />,
                  '⌘S',
                  () => void saveDocument(),
                  'file-export',
                )}
                {inDoc &&
                  item(
                    t('topbar.file.saveAs'),
                    <Save size={15} aria-hidden="true" />,
                    '⇧⌘S',
                    () => void saveDocument(true),
                    'file-save-as',
                  )}
                {item(
                  t('topbar.file.open'),
                  <FolderOpen size={15} aria-hidden="true" />,
                  '⌘O',
                  openBoardFile,
                  'file-open',
                )}
                {docs &&
                  item(
                    t('topbar.file.new'),
                    <FilePlus size={15} aria-hidden="true" />,
                    '⌘N',
                    () => docs?.create(),
                    'file-new',
                  )}
                {item(
                  t('topbar.file.import'),
                  <Download size={15} aria-hidden="true" />,
                  null,
                  openBoardFilePicker,
                  'file-import',
                )}
              </>
            ) : (
              <>
                {item(
                  t('topbar.file.download'),
                  <Download size={15} aria-hidden="true" />,
                  '⌘S',
                  () => void saveDocument(),
                  'file-export',
                )}
                {item(
                  t('topbar.file.openFile'),
                  <FolderOpen size={15} aria-hidden="true" />,
                  '⌘O',
                  openBoardFilePicker,
                  'file-import',
                )}
              </>
            )}
            {item(
              t('common.language'),
              <Languages size={15} aria-hidden="true" />,
              null,
              () => setLangMenu(trigger.current?.getBoundingClientRect() ?? null),
              'file-language',
            )}
          </div>
        </Popover>
      )}
      {langMenu && (
        <LanguageMenu
          anchor={langMenu}
          align="start"
          trigger={trigger.current}
          onClose={() => setLangMenu(null)}
        />
      )}
    </>
  );
}

function Starters() {
  const t = useT();
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
        aria-label={t('topbar.templates')}
      >
        <LayoutTemplate size={16} aria-hidden="true" /> <span className="lbl">{t('topbar.templates')}</span>
        <ChevronDown size={14} aria-hidden="true" className="lbl" />
      </button>
      {menu && (
        <Popover
          anchor={menu}
          trigger={trigger.current}
          onClose={() => setMenu(null)}
          label={t('topbar.templates')}
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
                <span className="template-cat">{t(`starter.${id}.vertical`)}</span>
                <b>{t(`starter.${id}.title`)}</b>
                <span className="template-desc">{t(`starter.${id}.description`)}</span>
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
  const t = useT();
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
          {t('topbar.running')}
        </span>
        <button type="button" onClick={() => void cancel()} data-testid="cancel-run">
          {t('common.cancel')}
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
      title={t('topbar.runAllHint')}
    >
      {upToDate ? (
        t('topbar.upToDate')
      ) : (
        <>
          {t('topbar.runAll')}
          <span className="cost lbl">{t('common.credits', { count: cost })}</span>
        </>
      )}
    </button>
  );
}

const Zoom = memo(function Zoom() {
  const t = useT();
  const { zoom } = useViewport();
  const rf = useReactFlow();
  const percent = t.number(Math.round(zoom * 100) / 100, { style: 'percent', maximumFractionDigits: 0 });
  return (
    <>
      <button
        type="button"
        aria-label={t('topbar.zoomOut')}
        onClick={() => zoomStep(rf, -1)}
        disabled={zoom <= MIN_ZOOM + 0.001}
      >
        −
      </button>
      <button
        type="button"
        aria-label={t('topbar.zoomLevel', { percent })}
        title={t('topbar.fitToScreen')}
        onClick={() => void rf.fitView({ duration: 250, padding: 0.1 })}
        className="zoom-level"
        data-testid="zoom-level"
      >
        {percent}
      </button>
      <button
        type="button"
        aria-label={t('topbar.zoomIn')}
        onClick={() => zoomStep(rf, 1)}
        disabled={zoom >= MAX_ZOOM - 0.001}
      >
        +
      </button>
    </>
  );
});

function Account() {
  const t = useT();
  const me = useMe();
  const mode = useBoard((s) => s.mode);
  const share = () =>
    isDoc()
      ? toast(t('topbar.shareFile'))
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
          title={t('topbar.creditsHint')}
        >
          {t('common.credits', { count: me.data.credits.balance })}
        </button>
      ) : (
        <button
          type="button"
          className="sign-in"
          onClick={() => useUi.setState({ signInPrompt: { reason: 'save' } })}
          data-testid="sign-in"
        >
          <LogIn size={16} aria-hidden="true" />
          {t('topbar.signIn')}
        </button>
      )}
      <LanguageButton />
      <button type="button" onClick={share} data-testid="share" aria-label={t('topbar.share')}>
        <Share2 size={16} aria-hidden="true" /> <span className="lbl">{t('topbar.share')}</span>
      </button>
      {me.data && (
        <AccountMenu name={me.data.user.name} email={me.data.user.email} image={me.data.user.image} />
      )}
    </div>
  );
}

function AccountMenu({ name, email, image }: { name: string; email: string; image: string | null }) {
  const t = useT();
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="avatar-btn"
        aria-label={t('topbar.accountOf', { name })}
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
          label={t('topbar.account')}
          testId="account-menu"
        >
          {/* The person's own name and email: content, never translated (HTML translate="no"). */}
          <div className="account-head" translate="no">
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
              {t('topbar.creditsAndPlan')}
            </button>
            <button type="button" role="menuitem" onClick={() => void signOut()} data-testid="sign-out">
              {t('topbar.signOut')}
            </button>
          </div>
        </Popover>
      )}
    </>
  );
}
