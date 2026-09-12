import {
  ASPECT_RATIOS,
  type AspectRatio,
  type CampaignBrief,
  FIXTURE_IDS,
  findTemplate,
  newOperationId,
  PRODUCT_FIXTURES,
  type ProductFixtureId,
  TEMPLATES,
} from '@3dads/contracts';
import { Button, cx, Field, Input, Segmented, Select, Textarea } from '@3dads/ui';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ImagePlus, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { FixtureThumb } from '@/components/FixtureThumb';
import { fieldError } from '@/lib/errors';
import { useServices } from '@/services/context';
import { useInvalidate, useMe } from '@/services/queries';

const DRAFT_KEY = '3dads.draft.newProject';

interface Draft {
  templateSlug: string;
  name: string;
  productName: string;
  productDescription: string;
  goal: string;
  audience: string;
  tone: CampaignBrief['tone'];
  aspects: AspectRatio[];
  keyMessage: string;
  fixtureId: ProductFixtureId;
  source: 'fixture' | 'upload';
}

function readDraft(): Partial<Draft> {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function NewProject() {
  const services = useServices();
  const navigate = useNavigate({ from: '/projects/new' });
  const search = useSearch({ from: '/authed/projects/new' });
  const inv = useInvalidate();
  const me = useMe();
  const initialTemplate = findTemplate(search.template) ?? TEMPLATES[0]!;
  const [draft, setDraft] = useState<Draft>(() => {
    const d = readDraft();
    const t = findTemplate(search.template) ?? findTemplate(d.templateSlug) ?? initialTemplate;
    return {
      templateSlug: t.slug,
      name: d.name ?? '',
      productName: d.productName ?? '',
      productDescription: d.productDescription ?? '',
      goal: d.goal ?? t.outcome,
      audience: d.audience ?? t.suitableFor,
      tone: d.tone ?? 'clean',
      aspects: d.aspects ?? t.aspects,
      keyMessage: d.keyMessage ?? t.ad.headline,
      fixtureId: d.fixtureId ?? t.fixtureId,
      source: d.source ?? 'fixture',
    };
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [opId] = useState(() => newOperationId());
  const template = findTemplate(draft.templateSlug) ?? TEMPLATES[0]!;
  const canEdit = me.data ? me.data.role !== 'viewer' : true;

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const applyTemplate = (slug: string) => {
    const t = findTemplate(slug);
    if (!t) return;
    setDraft((d) => ({
      ...d,
      templateSlug: slug,
      goal: t.outcome,
      audience: t.suitableFor,
      aspects: t.aspects,
      keyMessage: t.ad.headline,
      fixtureId: d.source === 'upload' ? d.fixtureId : t.fixtureId,
    }));
  };

  const localFileError = useMemo(() => {
    if (!file) return undefined;
    if (!file.type.startsWith('image/')) return `${file.name} is not an image. Use PNG, JPG or WebP.`;
    if (file.size > 12 * 1024 * 1024)
      return `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 12 MB.`;
    return undefined;
  }, [file]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (draft.source === 'upload' && (!file || localFileError)) {
      setError(new Error(localFileError ?? 'Choose a product image or switch to a catalog fixture.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const brief: CampaignBrief = {
        goal: draft.goal,
        audience: draft.audience,
        tone: draft.tone,
        aspects: draft.aspects.length ? draft.aspects : template.aspects,
        keyMessage: draft.keyMessage,
      };
      const project = await services.projects.create({
        operationId: opId,
        name: draft.name || `${draft.productName || template.name} — ${template.name}`,
        templateSlug: template.slug,
        productName: draft.productName,
        productDescription: draft.productDescription,
        brief,
        reference:
          draft.source === 'upload' && file
            ? { source: 'upload', file, name: file.name, fixtureId: draft.fixtureId }
            : { source: 'fixture', fixtureId: draft.fixtureId },
      });
      sessionStorage.removeItem(DRAFT_KEY);
      await inv.projects();
      void navigate({
        to: '/projects/$projectId',
        params: { projectId: project.id },
        search: { tab: 'workflow' },
      });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <nav
        aria-label="Breadcrumb"
        style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 8 }}
      >
        <Link to="/">Projects</Link> <span aria-hidden="true">/</span> New project
      </nav>
      <h1 className="page-title">New project</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4, marginBottom: 20 }}>
        Pick a template, add your product reference, and write a short brief. Everything can be changed later
        in the workspace.
      </p>
      {!canEdit ? (
        <ErrorState
          error={{
            code: 'forbidden',
            message: 'Viewers cannot create projects. Ask a workspace owner to make you an editor.',
          }}
        />
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} noValidate style={{ display: 'grid', gap: 28 }}>
        <section aria-labelledby="s-template" style={{ display: 'grid', gap: 12 }}>
          <h2 id="s-template" style={{ fontSize: '1rem', fontWeight: 600 }}>
            1. Template
          </h2>
          <div
            role="radiogroup"
            aria-label="Template"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}
          >
            {TEMPLATES.map((t) => (
              <button
                key={t.slug}
                type="button"
                role="radio"
                aria-checked={t.slug === draft.templateSlug}
                onClick={() => applyTemplate(t.slug)}
                className={cx('card', 'card-pad')}
                style={{
                  textAlign: 'left',
                  padding: 10,
                  borderColor: t.slug === draft.templateSlug ? 'var(--accent)' : undefined,
                  boxShadow: t.slug === draft.templateSlug ? '0 0 0 2px var(--accent-soft)' : undefined,
                }}
                data-testid={`template-${t.slug}`}
              >
                <div className="thumb" style={{ aspectRatio: '16/10' }}>
                  <FixtureThumb fixtureId={t.fixtureId} />
                </div>
                <div style={{ fontWeight: 600, marginTop: 8, fontSize: '0.9rem' }}>{t.name}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{t.category}</div>
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <strong>{template.name}:</strong> {template.outcome} Deliverables:{' '}
            {template.deliverable.join('; ')}. About {template.sampleCredits} demo credits per run.
          </p>
        </section>

        <section aria-labelledby="s-ref" style={{ display: 'grid', gap: 12 }}>
          <h2 id="s-ref" style={{ fontSize: '1rem', fontWeight: 600 }}>
            2. Product reference
          </h2>
          <Segmented
            label="Reference source"
            value={draft.source}
            onChange={(v) => set('source', v)}
            options={[
              { value: 'fixture', label: 'Catalog fixture' },
              { value: 'upload', label: 'Upload image' },
            ]}
          />
          {draft.source === 'upload' ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <Field
                label="Product image"
                required
                help="PNG, JPG or WebP up to 12 MB. The image is stored in this browser and shown as your reference. The demo does not reconstruct it: the 3D model below is a labelled fixture."
                error={localFileError ?? fieldError(error, 'reference')}
              >
                {({ id, describedBy, invalid }) => (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label htmlFor={id} className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                      <ImagePlus size={16} aria-hidden="true" />
                      {file ? 'Replace image' : 'Choose image'}
                    </label>
                    <input
                      id={id}
                      type="file"
                      accept="image/*"
                      className="visually-hidden"
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      data-testid="upload-input"
                    />
                    {file ? (
                      <span
                        style={{ fontSize: '0.875rem', display: 'inline-flex', gap: 8, alignItems: 'center' }}
                      >
                        {file.name} · {(file.size / 1024).toFixed(0)} KB
                        <Button
                          variant="tertiary"
                          size="sm"
                          icon
                          aria-label="Remove image"
                          onClick={() => setFile(null)}
                        >
                          <X size={14} aria-hidden="true" />
                        </Button>
                      </span>
                    ) : null}
                  </div>
                )}
              </Field>
              {preview && !localFileError ? (
                <div className="preview-frame" style={{ maxWidth: 360, padding: 8 }}>
                  <img
                    src={preview}
                    alt={`Preview of ${file?.name ?? 'upload'}`}
                    style={{ maxHeight: 240, objectFit: 'contain', margin: '0 auto', borderRadius: 12 }}
                    data-testid="upload-preview"
                  />
                </div>
              ) : null}
              <Field
                label="Closest fixture for the demonstration model"
                help="Without a connected engine, the 3D output uses this fixture and is labelled as such."
              >
                {({ id, describedBy }) => (
                  <Select
                    id={id}
                    value={draft.fixtureId}
                    onChange={(e) => set('fixtureId', e.target.value as ProductFixtureId)}
                    aria-describedby={describedBy}
                    style={{ maxWidth: 360 }}
                  >
                    {FIXTURE_IDS.map((f) => (
                      <option key={f} value={f}>
                        {PRODUCT_FIXTURES[f].name} · {PRODUCT_FIXTURES[f].category}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          ) : (
            <div
              role="radiogroup"
              aria-label="Catalog fixture"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 10,
              }}
            >
              {FIXTURE_IDS.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={draft.fixtureId === f}
                  onClick={() => set('fixtureId', f)}
                  className="card"
                  style={{
                    textAlign: 'left',
                    padding: 10,
                    borderColor: draft.fixtureId === f ? 'var(--accent)' : undefined,
                  }}
                >
                  <div className="thumb" style={{ aspectRatio: '4/3' }}>
                    <FixtureThumb fixtureId={f} />
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 8, fontSize: '0.9rem' }}>
                    {PRODUCT_FIXTURES[f].name}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {PRODUCT_FIXTURES[f].category}
                  </div>
                </button>
              ))}
            </div>
          )}
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}
          >
            <Field label="Product name" required error={fieldError(error, 'productName')}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  value={draft.productName}
                  onChange={(e) => set('productName', e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  placeholder="Radiance Serum 30 ml"
                  data-testid="product-name"
                />
              )}
            </Field>
            <Field
              label="Project name"
              help="Defaults to product + template."
              error={fieldError(error, 'name')}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  value={draft.name}
                  onChange={(e) => set('name', e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  placeholder={`${draft.productName || 'Product'} — ${template.name}`}
                />
              )}
            </Field>
          </div>
          <Field label="Product description" help="One or two sentences the agent can use for captions.">
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                value={draft.productDescription}
                onChange={(e) => set('productDescription', e.target.value)}
                aria-describedby={describedBy}
                rows={2}
              />
            )}
          </Field>
        </section>

        <section aria-labelledby="s-brief" style={{ display: 'grid', gap: 12 }}>
          <h2 id="s-brief" style={{ fontSize: '1rem', fontWeight: 600 }}>
            3. Campaign brief
          </h2>
          <Field label="Goal" required error={fieldError(error, 'goal')}>
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                value={draft.goal}
                onChange={(e) => set('goal', e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                rows={2}
                data-testid="brief-goal"
              />
            )}
          </Field>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}
          >
            <Field label="Audience">
              {({ id }) => (
                <Input id={id} value={draft.audience} onChange={(e) => set('audience', e.target.value)} />
              )}
            </Field>
            <Field label="Tone">
              {({ id }) => (
                <Select
                  id={id}
                  value={draft.tone}
                  onChange={(e) => set('tone', e.target.value as Draft['tone'])}
                >
                  <option value="clean">Clean</option>
                  <option value="bold">Bold</option>
                  <option value="warm">Warm</option>
                  <option value="technical">Technical</option>
                </Select>
              )}
            </Field>
          </div>
          <Field label="Key message (headline)" help="Used as the default ad headline.">
            {({ id, describedBy }) => (
              <Input
                id={id}
                value={draft.keyMessage}
                onChange={(e) => set('keyMessage', e.target.value)}
                aria-describedby={describedBy}
              />
            )}
          </Field>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field-label" style={{ marginBottom: 6 }}>
              Aspect ratios
            </legend>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {ASPECT_RATIOS.map((a) => (
                <label key={a} className="check">
                  <input
                    type="checkbox"
                    checked={draft.aspects.includes(a)}
                    onChange={(e) =>
                      set(
                        'aspects',
                        e.target.checked ? [...draft.aspects, a] : draft.aspects.filter((x) => x !== a),
                      )
                    }
                  />
                  {a}
                </label>
              ))}
            </div>
            {draft.aspects.length === 0 ? (
              <p className="field-error">Choose at least one aspect ratio.</p>
            ) : null}
          </fieldset>
        </section>

        {error &&
        !fieldError(error, 'name') &&
        !fieldError(error, 'productName') &&
        !fieldError(error, 'goal') &&
        !fieldError(error, 'reference') ? (
          <ErrorState error={error} />
        ) : null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-secondary">
            Cancel
          </Link>
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabledReason={
              !canEdit
                ? 'Viewers cannot create projects.'
                : draft.aspects.length === 0
                  ? 'Choose at least one aspect ratio.'
                  : undefined
            }
            data-testid="create-project"
          >
            Create project
          </Button>
        </div>
      </form>
    </div>
  );
}
