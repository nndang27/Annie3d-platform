import { type AdComposition, ASPECT_RATIOS, PRODUCT_FIXTURES, type SceneDoc } from '@3dads/contracts';
import { Field, Input, Segmented, Select, Textarea } from '@3dads/ui';
import { useSceneStore } from '@/stores/sceneStore';

const SWATCHES = ['#c9a27e', '#2b2f36', '#7a8290', '#2457d6', '#b45f9a', '#17623b', '#d6742e', '#f4f1ec'];
const BRAND = ['#2457d6', '#17191d', '#b42332', '#17623b', '#b45f9a', '#d6742e', '#7a4bd6', '#1c7f7a'];

export function SceneControls({
  scene,
  ad,
  readOnly,
  selectedPart,
}: {
  scene: SceneDoc;
  ad: AdComposition;
  readOnly: boolean;
  selectedPart: string | null;
}) {
  const edit = useSceneStore((s) => s.edit);
  const fixture = PRODUCT_FIXTURES[scene.fixtureId];
  const partLabel = fixture.parts.find((p) => p.id === selectedPart)?.label;
  return (
    <div style={{ display: 'grid', gap: 12 }} data-testid="scene-controls">
      <details className="disclosure" open>
        <summary>Scene</summary>
        <div className="control-group" style={{ paddingBottom: 8 }}>
          <div className="control-row">
            <span>Background</span>
            <Select
              small
              aria-label="Background"
              value={scene.background}
              onChange={(e) => edit({ scene: { background: e.target.value as SceneDoc['background'] } })}
              disabled={readOnly}
              style={{ width: 160 }}
              data-testid="background-select"
            >
              <option value="studio-white">Studio white</option>
              <option value="cool-gray">Cool gray</option>
              <option value="charcoal">Charcoal</option>
              <option value="brand">Brand tint</option>
            </Select>
          </div>
          <div className="control-row">
            <span>Light</span>
            <Select
              small
              aria-label="Light preset"
              value={scene.light}
              onChange={(e) => edit({ scene: { light: e.target.value as SceneDoc['light'] } })}
              disabled={readOnly}
              style={{ width: 160 }}
            >
              <option value="studio-soft">Studio soft</option>
              <option value="dramatic">Dramatic</option>
              <option value="daylight">Daylight</option>
            </Select>
          </div>
          <div className="control-row">
            <span>Camera</span>
            <Select
              small
              aria-label="Camera preset"
              value={scene.cameraPreset}
              onChange={(e) => edit({ scene: { cameraPreset: e.target.value as SceneDoc['cameraPreset'] } })}
              disabled={readOnly}
              style={{ width: 160 }}
              data-testid="camera-select"
            >
              <option value="three-quarter">Three-quarter</option>
              <option value="front">Front</option>
              <option value="top">Top</option>
              <option value="detail">Detail</option>
            </Select>
          </div>
          <div className="control-row" style={{ alignItems: 'flex-start' }}>
            <span>
              Material
              {partLabel ? (
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Selected: {partLabel}
                </span>
              ) : null}
            </span>
            <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
              <div className="swatches" role="radiogroup" aria-label="Material colour">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={scene.materialColor === c}
                    aria-label={`Colour ${c}`}
                    className="swatch"
                    style={{ background: c }}
                    onClick={() => edit({ scene: { materialColor: c } })}
                    disabled={readOnly}
                    data-testid={`swatch-${c.slice(1)}`}
                  />
                ))}
                <input
                  type="color"
                  aria-label="Custom material colour"
                  value={scene.materialColor}
                  onChange={(e) => edit({ scene: { materialColor: e.target.value } }, { transient: true })}
                  onBlur={(e) => edit({ scene: { materialColor: e.target.value } })}
                  disabled={readOnly}
                  style={{ width: 26, height: 26, padding: 0, border: 0, background: 'none' }}
                />
              </div>
              <Segmented
                label="Finish"
                value={scene.finish}
                onChange={(v) => edit({ scene: { finish: v } })}
                options={[
                  { value: 'matte', label: 'Matte' },
                  { value: 'satin', label: 'Satin' },
                  { value: 'gloss', label: 'Gloss' },
                ]}
              />
            </div>
          </div>
        </div>
      </details>
      <details className="disclosure">
        <summary>Placement</summary>
        <div className="control-group" style={{ paddingBottom: 8 }}>
          <Slider
            label="Offset X"
            value={scene.placement.x}
            min={-1}
            max={1}
            step={0.05}
            onChange={(v, done) =>
              edit({ scene: { placement: { x: v } as SceneDoc['placement'] } }, { transient: !done })
            }
            disabled={readOnly}
          />
          <Slider
            label="Height"
            value={scene.placement.y}
            min={-0.3}
            max={0.6}
            step={0.05}
            onChange={(v, done) =>
              edit({ scene: { placement: { y: v } as SceneDoc['placement'] } }, { transient: !done })
            }
            disabled={readOnly}
          />
          <Slider
            label="Rotation"
            value={scene.placement.rotationY}
            min={-180}
            max={180}
            step={5}
            unit="°"
            onChange={(v, done) =>
              edit({ scene: { placement: { rotationY: v } as SceneDoc['placement'] } }, { transient: !done })
            }
            disabled={readOnly}
          />
          <Slider
            label="Scale"
            value={scene.placement.scale}
            min={0.6}
            max={1.6}
            step={0.05}
            unit="×"
            onChange={(v, done) =>
              edit({ scene: { placement: { scale: v } as SceneDoc['placement'] } }, { transient: !done })
            }
            disabled={readOnly}
          />
        </div>
      </details>
      <details className="disclosure" open>
        <summary>Ad composition</summary>
        <div className="control-group" style={{ paddingBottom: 8 }}>
          <Field label="Headline">
            {({ id }) => (
              <Input
                id={id}
                small
                value={ad.headline}
                onChange={(e) => edit({ ad: { headline: e.target.value } })}
                disabled={readOnly}
                data-testid="headline-input"
              />
            )}
          </Field>
          <Field label="Subheadline">
            {({ id }) => (
              <Textarea
                id={id}
                rows={2}
                value={ad.subheadline}
                onChange={(e) => edit({ ad: { subheadline: e.target.value } })}
                disabled={readOnly}
                style={{ minHeight: 56 }}
              />
            )}
          </Field>
          <Field label="Call to action">
            {({ id }) => (
              <Input
                id={id}
                small
                value={ad.cta}
                onChange={(e) => edit({ ad: { cta: e.target.value } })}
                disabled={readOnly}
                data-testid="cta-input"
              />
            )}
          </Field>
          <div className="control-row">
            <span>Brand colour</span>
            <div className="swatches" role="radiogroup" aria-label="Brand colour">
              {BRAND.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={ad.brandColor === c}
                  aria-label={`Brand colour ${c}`}
                  className="swatch"
                  style={{ background: c }}
                  onClick={() => edit({ ad: { brandColor: c } })}
                  disabled={readOnly}
                  data-testid={`brand-${c.slice(1)}`}
                />
              ))}
            </div>
          </div>
          <div className="control-row">
            <span>Layout</span>
            <Segmented
              label="Layout"
              value={ad.layout}
              onChange={(v) => edit({ ad: { layout: v } })}
              options={[
                { value: 'text-left', label: 'Left' },
                { value: 'text-bottom', label: 'Bottom' },
                { value: 'centered', label: 'Center' },
              ]}
            />
          </div>
          <div className="control-row">
            <span>Aspect</span>
            <Segmented
              label="Aspect ratio"
              value={ad.aspect}
              onChange={(v) => edit({ ad: { aspect: v } })}
              options={ASPECT_RATIOS.map((a) => ({ value: a, label: a }))}
            />
          </div>
        </div>
      </details>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number, done: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="control-row" style={{ gap: 8 }}>
      <span style={{ width: 70 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value), false)}
        onPointerUp={(e) => onChange(Number((e.target as HTMLInputElement).value), true)}
        onKeyUp={(e) => onChange(Number((e.target as HTMLInputElement).value), true)}
        disabled={disabled}
        style={{ flex: 1, accentColor: 'var(--action-primary)' }}
        aria-valuetext={`${value}${unit}`}
      />
      <span className="numeric" style={{ width: 44, textAlign: 'right', fontSize: '0.8125rem' }}>
        {Number.isInteger(value) ? value : value.toFixed(2)}
        {unit}
      </span>
    </label>
  );
}
