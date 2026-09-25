import { GLB_PRESETS, type GlbPresetId } from '@annie3d/contracts';
import { Check, Download, X } from 'lucide-react';
import { useState } from 'react';
import { api, type ExportResult } from '../api/client';
import { isDoc, withCloud } from '../lib/doc';
import { timed } from '../lib/perf';
import { useBoard } from '../store/board';
import { toast, useUi } from '../store/ui';
import { Modal } from './Modal';

const PRESETS = Object.entries(GLB_PRESETS) as [GlbPresetId, (typeof GLB_PRESETS)[GlbPresetId]][];
const mb = (b: number) => `${(b / 1048576).toFixed(b < 1048576 ? 2 : 1)} MB`;

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
  if (!node) return <p className="muted">Select a 3D model or Export node to export.</p>;
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
      <h2 id="export-title">Export {isBundle ? 'bundle' : '3D model'}</h2>
      <div className="preset-list" role="radiogroup" aria-label="Preset">
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
            <b>{p.label}</b>
            <span className="muted small">
              ≤ {mb(p.maxBytes)} · ≤ {p.maxTriangles.toLocaleString('en')} tris · textures ≤ {p.maxTexture}px
              {p.requiresAnimation ? ' · animated' : ''}
            </span>
          </label>
        ))}
      </div>
      {isBundle && (
        <div className="checks-row">
          <label>
            <input type="checkbox" checked={includeMp4} onChange={(e) => setMp4(e.target.checked)} /> Ad video
            (MP4)
          </label>
          <label>
            <input type="checkbox" checked={includePng} onChange={(e) => setPng(e.target.checked)} /> Images
            (PNG)
          </label>
        </div>
      )}
      {report && (
        <div className="report" data-testid="export-report" data-passed={report.passed}>
          <p className={report.passed ? 'ok' : 'bad'}>
            {report.passed
              ? `Ready for ${GLB_PRESETS[preset].label}`
              : `Does not meet ${GLB_PRESETS[preset].label} yet`}
          </p>
          <ul>
            {report.checks.map((c) => (
              <li key={c.id} data-check={c.id} data-passed={c.passed}>
                {c.passed ? <Check size={14} aria-label="passed" /> : <X size={14} aria-label="failed" />}{' '}
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
                    ? 'All files (.zip)'
                    : f.mime === 'model/gltf-binary'
                      ? 'GLB model'
                      : f.mime}
                </span>
                <span className="muted">{mb(f.byteSize)}</span>
                <a
                  className="btn-secondary btn-sm"
                  href={`${f.urls.original}?download=${encodeURIComponent(name)}`}
                  download={name}
                  data-testid={`download-${f.mime.split('/')[1]}`}
                >
                  <Download size={14} aria-hidden="true" /> Download
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>
          {result ? 'Done' : 'Cancel'}
        </button>
        {!result && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => void run()}
            disabled={busy}
            data-testid="export-run"
          >
            {busy ? 'Exporting…' : 'Export · free'}
          </button>
        )}
      </div>
    </>
  );
}
