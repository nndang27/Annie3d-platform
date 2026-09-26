import { GLB_PRESETS, type GlbPresetId } from '@annie3d/contracts';
import { Check, Download, X } from 'lucide-react';
import { useState } from 'react';
import { api, type ExportResult } from '../api/client';
import { t as tr, useT } from '../i18n';
import { isDoc, withCloud } from '../lib/doc';
import { timed } from '../lib/perf';
import { useBoard } from '../store/board';
import { toast, useUi } from '../store/ui';
import { Modal } from './Modal';

const PRESETS = Object.entries(GLB_PRESETS) as [GlbPresetId, (typeof GLB_PRESETS)[GlbPresetId]][];
const mb = (b: number) => {
  const digits = b < 1048576 ? 2 : 1;
  const size = tr.number(b / 1048576, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return tr('dialog.export.megabytes', { size });
};

/** F6: pick a preset, export, read the pass/fail report, download files or the zip. */
export function ExportDialog() {
  const dialog = useUi((s) => s.dialog);
  const open = dialog?.type === 'export';
  const close = () => useUi.getState().dialog?.type === 'export' && useUi.setState({ dialog: null });
  return (
    <Modal open={open} onClose={close} labelledBy="export-title" testId="export-dialog" wide>
      {open && <ExportBody nodeId={dialog.nodeId} onClose={close} />}
    </Modal>
  );
}

function ExportBody({ nodeId, onClose }: { nodeId?: string; onClose: () => void }) {
  const t = useT();
  const mode = useBoard((s) => s.mode);
  const node = useBoard((s) => (nodeId ? s.graph.nodes.get(nodeId) : undefined));
  const [preset, setPreset] = useState<GlbPresetId>(
    ((node?.settings.glbPreset as GlbPresetId) ?? 'web') in GLB_PRESETS
      ? ((node?.settings.glbPreset as GlbPresetId) ?? 'web')
      : 'web',
  );
  const [includeMp4, setMp4] = useState(true);
  const [includePng, setPng] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  if (!node) return <p className="muted">{t('dialog.export.noNode')}</p>;
  const isBundle = node.kind === 'export';
  const run = async (ready = false) => {
    if (mode === 'guest') return useUi.setState({ dialog: null, signInPrompt: { reason: 'save' } });
    // A board file first needs its copy on the server (with this node's inputs): a new copy
    // renames the node, so the dialog opens again on it; otherwise the export goes ahead.
    if (isDoc() && !ready)
      return withCloud('save', { kind: 'export', nodeId }, (id) =>
        mode === 'file' ? useUi.setState({ dialog: { type: 'export', nodeId: id } }) : void run(true),
      );
    setBusy(true);
    try {
      // One key per dialog + preset: a double click or retry returns the same export.
      const idempotencyKey = `${key.slice(0, 24)}${PRESETS.findIndex(([p]) => p === preset)
        .toString(16)
        .padStart(12, '0')}`;
      setResult(
        await timed('export.bundle', () =>
          api.createExport({
            idempotencyKey,
            nodeId: node.id,
            glbPreset: preset,
            includeMp4: isBundle && includeMp4,
            includePng: isBundle && includePng,
          }),
        ),
      );
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const report = result?.report;
  return (
    <>
      <h2 id="export-title">{isBundle ? t('dialog.export.titleBundle') : t('dialog.export.titleModel')}</h2>
      <div className="preset-list" role="radiogroup" aria-label={t('dialog.export.preset')}>
        {PRESETS.map(([id, p]) => (
          <label key={id} className={`preset${preset === id ? ' on' : ''}`}>
            <input
              type="radio"
              name="preset"
              value={id}
              checked={preset === id}
              onChange={() => {
                setPreset(id);
                setResult(null);
              }}
            />
            <b>{t(`glbPreset.${id}`)}</b>
            <span className="muted small">
              {t(p.requiresAnimation ? 'dialog.export.limitsAnimated' : 'dialog.export.limits', {
                size: mb(p.maxBytes),
                triangles: p.maxTriangles,
                texture: t.number(p.maxTexture, { useGrouping: false }),
              })}
            </span>
          </label>
        ))}
      </div>
      {isBundle && (
        <div className="checks-row">
          <label>
            <input type="checkbox" checked={includeMp4} onChange={(e) => setMp4(e.target.checked)} />{' '}
            {t('dialog.export.includeVideo')}
          </label>
          <label>
            <input type="checkbox" checked={includePng} onChange={(e) => setPng(e.target.checked)} />{' '}
            {t('dialog.export.includeImages')}
          </label>
        </div>
      )}
      {report && (
        <div className="report" data-testid="export-report" data-passed={report.passed}>
          <p className={report.passed ? 'ok' : 'bad'}>
            {report.passed
              ? t('dialog.export.ready', { preset: t(`glbPreset.${preset}`) })
              : t('dialog.export.notReady', { preset: t(`glbPreset.${preset}`) })}
          </p>
          <ul>
            {report.checks.map((c) => (
              <li key={c.id} data-check={c.id} data-passed={c.passed}>
                {c.passed ? (
                  <Check size={14} aria-label={t('dialog.export.passed')} />
                ) : (
                  <X size={14} aria-label={t('dialog.export.failed')} />
                )}{' '}
                {c.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result && (
        <ul className="files" data-testid="export-files">
          {result.files.map((f, i) => {
            const base =
              (node.label ?? 'annie3d')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '') || 'annie3d';
            const ext =
              f.mime === 'application/zip'
                ? 'zip'
                : f.mime === 'model/gltf-binary'
                  ? 'glb'
                  : (f.mime.split('/')[1] ?? 'bin');
            const name = `${base}-${f.kind === 'video' ? 'ad' : f.kind === 'image' ? `image-${i}` : preset}.${ext}`;
            return (
              <li key={f.id}>
                <span>
                  {f.mime === 'application/zip'
                    ? t('dialog.export.zip')
                    : f.mime === 'model/gltf-binary'
                      ? t('dialog.export.glb')
                      : f.mime}
                </span>
                <span className="muted">{mb(f.byteSize)}</span>
                <a
                  className="btn-secondary btn-sm"
                  href={`${f.urls.original}?download=${encodeURIComponent(name)}`}
                  download={name}
                  data-testid={`download-${f.mime.split('/')[1]}`}
                >
                  <Download size={14} aria-hidden="true" /> {t('dialog.download')}
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>
          {result ? t('common.done') : t('common.cancel')}
        </button>
        {!result && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => void run()}
            disabled={busy}
            data-testid="export-run"
          >
            {busy ? t('dialog.export.exporting') : t('dialog.export.run')}
          </button>
        )}
      </div>
    </>
  );
}
