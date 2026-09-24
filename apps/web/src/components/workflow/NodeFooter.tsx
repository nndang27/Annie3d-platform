import { NODE_KINDS, type WorkflowNode } from '@annie3d/contracts';
import { Button, Dialog, Field, Input, Kbd, Select, useToast } from '@annie3d/ui';
import { useReactFlow } from '@xyflow/react';
import { Download, MoreHorizontal, Trash2, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { downloadBlob } from '@/lib/download';
import { presentError } from '@/lib/errors';
import { useProjectContext } from '@/routes/project/context';
import { useServices } from '@/services/context';
import { useInvalidate } from '@/services/queries';
import { useComposerStore } from '@/stores/composerStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { MOD } from './nodeMeta';

/** Floating footer under the selected node: engine, settings chips, mute, download, delete, more. */
export function NodeFooter({ node }: { node: WorkflowNode }) {
  const spec = NODE_KINDS[node.kind];
  const store = useWorkflowStore;
  const ctx = useProjectContext();
  const services = useServices();
  const inv = useInvalidate();
  const toast = useToast();
  const rf = useReactFlow();
  const [menu, setMenu] = useState(false);
  const [rename, setRename] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreBtn = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const art = ctx.latestArtifactFor(node.id);
  const set = (k: string, v: string | number | boolean) =>
    store.getState().updateSettings(node.id, { [k]: v });
  const muted = node.settings.muted === true;
  const readOnly = !ctx.canEdit;

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !moreBtn.current?.contains(e.target as Node))
        setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const download = async () => {
    if (!art) return;
    setBusy(true);
    try {
      if (art.blobKey) {
        const { blob, filename } = await services.artifacts.download(art.id);
        downloadBlob(blob, filename);
      } else if (art.scene) {
        const payload = JSON.stringify(
          {
            format: 'annie3d.scene+ad',
            version: 1,
            node: node.id,
            artifact: art.id,
            scene: art.scene,
            ad: art.ad,
            note: 'Editable scene data (demo). The preview image is a fixture poster.',
          },
          null,
          2,
        );
        downloadBlob(
          new Blob([payload], { type: 'application/json' }),
          `${(node.title || spec.title).replace(/\s+/g, '-').toLowerCase()}-v${art.revision}.json`,
        );
      }
    } catch (e) {
      toast.push({ message: presentError(e).message, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const items: {
    label: string;
    kbd?: string;
    onSelect?: () => void;
    disabledReason?: string;
    danger?: boolean;
    sep?: boolean;
  }[] = [
    {
      label: 'Run',
      kbd: `${MOD} ↩`,
      onSelect: () => void ctx.startRun(node.id).catch(() => {}),
      disabledReason: !spec.executable
        ? 'Input nodes do not run.'
        : readOnly
          ? 'Editors only.'
          : ctx.activeRun
            ? 'A run is already active.'
            : undefined,
    },
    {
      label: 'Extract generation',
      onSelect: () => ctx.openStudio(),
      disabledReason: art?.scene ? undefined : 'No output with scene data yet.',
    },
    {
      label: 'Download',
      kbd: `${MOD} ⇧ D`,
      onSelect: () => void download(),
      disabledReason: art ? undefined : 'No output to download yet.',
    },
    {
      label: 'Save to assets',
      onSelect: () =>
        void services.artifacts.setAcceptance(art!.id, 'accepted').then(() => {
          ctx.refreshArtifacts();
          toast.push({ message: 'Output accepted and kept in the library.' });
        }),
      disabledReason: art ? undefined : 'No output yet.',
    },
    {
      label: 'Set as thumbnail',
      onSelect: () =>
        void services.projects.selectArtifact(ctx.project.id, art!.id).then(() => {
          void inv.project(ctx.project.id);
          toast.push({ message: 'Selected as the project output.' });
        }),
      disabledReason: art ? undefined : 'No output yet.',
    },
    {
      label: 'Rename',
      sep: true,
      onSelect: () => setRename(node.title || spec.title),
      disabledReason: readOnly ? 'Editors only.' : undefined,
    },
    {
      label: 'Copy',
      kbd: `${MOD} C`,
      onSelect: () => {
        store.getState().copyNode(node.id);
        toast.push({ message: 'Node copied' });
      },
    },
    {
      label: 'Paste',
      kbd: `${MOD} V`,
      onSelect: () => store.getState().pasteNode(),
      disabledReason: store.getState().clipboard ? undefined : 'Nothing copied yet.',
    },
    {
      label: 'Duplicate',
      kbd: `${MOD} D`,
      onSelect: () => store.getState().duplicateNode(node.id),
      disabledReason: readOnly ? 'Editors only.' : undefined,
    },
    {
      label: 'Focus node',
      kbd: `${MOD} .`,
      onSelect: () => rf.setCenter(node.position.x + 170, node.position.y + 150, { zoom: 1, duration: 250 }),
    },
    {
      label: 'Reference in agent',
      kbd: `${MOD} /`,
      onSelect: () => useComposerStore.getState().insert(`@${node.title || spec.title} `),
    },
    {
      label: 'Delete generation',
      sep: true,
      onSelect: () =>
        void services.artifacts.setAcceptance(art!.id, 'rejected').then(() => {
          ctx.refreshArtifacts();
          toast.push({ message: 'Latest output marked rejected. Earlier versions stay in Outputs.' });
        }),
      disabledReason: art ? undefined : 'No output to delete.',
    },
    {
      label: 'Delete node',
      kbd: '⌫',
      danger: true,
      onSelect: () => store.getState().removeNode(node.id),
      disabledReason: readOnly ? 'Editors only.' : undefined,
    },
    {
      label: node.settings.templateOutput ? 'Unmark template output' : 'Mark template output',
      sep: true,
      onSelect: () => set('templateOutput', !node.settings.templateOutput),
    },
    {
      label: 'Comment',
      onSelect: () =>
        store
          .getState()
          .addNode(
            'comment',
            { x: node.position.x + 360, y: node.position.y },
            { prompt: `Re: ${node.title || spec.title}` },
          ),
    },
  ];

  return (
    <div
      className="flow-footer nodrag nowheel"
      role="toolbar"
      aria-label={`Settings for ${node.title || spec.title}`}
      data-testid={`footer-${node.id}`}
    >
      <Select
        small
        aria-label="Engine"
        value={String(node.settings.engine ?? spec.engine)}
        onChange={(e) => set('engine', e.target.value)}
        disabled={readOnly}
      >
        {spec.engines.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </Select>
      {spec.settings.map((f) => (
        <Select
          key={f.key}
          small
          aria-label={f.label}
          title={f.label}
          value={String(node.settings[f.key] ?? f.default)}
          onChange={(e) => set(f.key, e.target.value)}
          disabled={readOnly}
        >
          {f.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      ))}
      {spec.output?.type === 'video' || spec.output?.type === 'audio' ? (
        <Button
          variant="tertiary"
          icon
          size="sm"
          aria-label={muted ? 'Unmute output' : 'Mute output'}
          aria-pressed={muted}
          onClick={() => set('muted', !muted)}
        >
          {muted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
        </Button>
      ) : null}
      <span className="sep" aria-hidden="true" />
      <Button
        variant="tertiary"
        icon
        size="sm"
        aria-label="Download output"
        loading={busy}
        onClick={() => void download()}
        disabledReason={art ? undefined : 'No output to download yet.'}
      >
        <Download size={15} aria-hidden="true" />
      </Button>
      <Button
        variant="tertiary"
        icon
        size="sm"
        aria-label="Delete node"
        onClick={() => store.getState().removeNode(node.id)}
        disabledReason={readOnly ? 'Editors only.' : undefined}
      >
        <Trash2 size={15} aria-hidden="true" />
      </Button>
      <Button
        ref={moreBtn}
        variant="tertiary"
        icon
        size="sm"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => {
          const r = moreBtn.current?.getBoundingClientRect();
          setMenuPos({
            left: Math.min((r?.right ?? 0) - 250, window.innerWidth - 260),
            top: Math.min((r?.bottom ?? 0) + 6, window.innerHeight - 420),
          });
          setMenu((m) => !m);
        }}
        data-testid={`more-${node.id}`}
      >
        <MoreHorizontal size={15} aria-hidden="true" />
      </Button>
      {menu
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label="Node actions"
              className="menu flow-footer-menu"
              style={{
                position: 'fixed',
                left: menuPos.left,
                top: menuPos.top,
                minWidth: 250,
                zIndex: 70,
                maxHeight: 'calc(100vh - 40px)',
                overflow: 'auto',
              }}
              data-testid={`menu-${node.id}`}
            >
              {items.map((it) => (
                <div key={it.label}>
                  {it.sep ? <div className="menu-sep" role="separator" /> : null}
                  <button
                    type="button"
                    role="menuitem"
                    className={`menu-item${it.danger ? ' is-danger' : ''}`}
                    aria-disabled={it.disabledReason ? true : undefined}
                    title={it.disabledReason}
                    style={{
                      justifyContent: 'space-between',
                      color: it.disabledReason ? 'var(--text-muted)' : undefined,
                    }}
                    onClick={() => {
                      if (it.disabledReason) return;
                      setMenu(false);
                      it.onSelect?.();
                    }}
                  >
                    <span>{it.label}</span>
                    {it.kbd ? <Kbd>{it.kbd}</Kbd> : null}
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
      <Dialog
        open={rename !== null}
        onClose={() => setRename(null)}
        title="Rename node"
        actions={
          <>
            <Button onClick={() => setRename(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                store.getState().renameNode(node.id, rename ?? '');
                setRename(null);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            store.getState().renameNode(node.id, rename ?? '');
            setRename(null);
          }}
        >
          <Field label="Node title">
            {({ id }) => (
              <Input
                id={id}
                value={rename ?? ''}
                onChange={(e) => setRename(e.target.value)}
                data-autofocus
              />
            )}
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
