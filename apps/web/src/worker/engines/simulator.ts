import type {
  Engine,
  EngineContext,
  EngineOutput,
  EngineResult,
  EngineVariant,
  NodeKind,
} from '@annie3d/contracts';
import { FIXTURE_MANIFEST, FIXTURE_VERSION, type FixtureProduct } from '@annie3d/fixtures';
import { type MessageKey, type Translator, tDynamic } from '../lib/i18n';

/**
 * Deterministic simulator for every runnable node kind (engine plug point, P5).
 * It behaves like a real engine: reports staged progress, honours cancellation, writes its
 * outputs through `ctx.putArtifact` (copied from the rendered fixture pack in the PUBLIC
 * bucket) and returns quality gates. Real agents replace it per kind in `engines/registry.ts`.
 *
 * Test hooks: a prompt containing `#fail` fails the main gate; `#slow` triples the duration.
 */
const STAGES: Partial<Record<NodeKind, MessageKey[]>> = {
  model3d: [
    'api.stage.model3d.readingPhotos',
    'api.stage.model3d.segmenting',
    'api.stage.model3d.estimatingShape',
    'api.stage.model3d.buildingMesh',
    'api.stage.model3d.bakingTextures',
    'api.stage.model3d.checkingSilhouette',
  ],
  stage: [
    'api.stage.stage.readingBrief',
    'api.stage.stage.blockingSet',
    'api.stage.stage.lighting',
    'api.stage.stage.placingProduct',
    'api.stage.stage.testRender',
  ],
  packshot: [
    'api.stage.packshot.framing',
    'api.stage.packshot.renderingFront',
    'api.stage.packshot.renderingAngles',
    'api.stage.packshot.denoising',
  ],
  adVideo: [
    'api.stage.adVideo.storyboard',
    'api.stage.adVideo.cameraMoves',
    'api.stage.adVideo.renderingFrames',
    'api.stage.adVideo.addingHeadline',
    'api.stage.adVideo.mixingMusic',
    'api.stage.adVideo.encoding',
  ],
  export: ['api.stage.export.packaging', 'api.stage.export.validating', 'api.stage.export.writing'],
};
const SECONDS: Record<string, number> = { model3d: 8, stage: 5, packshot: 4, adVideo: 9, export: 2 };
const PRODUCTS: FixtureProduct[] = ['serum', 'headphones', 'ring'];
const LOOK_PRODUCT: Record<string, FixtureProduct> = {
  'splash-pastel': 'serum',
  'dark-lab': 'headphones',
  'stone-water': 'ring',
};
const MOTION_PRODUCT: Record<string, FixtureProduct> = {
  'splash-hero': 'serum',
  'teardown-reveal': 'headphones',
  'stone-water': 'ring',
};

export interface SimulatorOptions {
  /** Multiplies simulated durations (tests use ~0.05). */
  speed: number;
  readFixture(key: string): Promise<ArrayBuffer | null>;
  /** Language of progress stages and failure messages: the run's. */
  t: Translator;
}

/** Which rendered product this node "produces": inherited from inputs, else from look/motion, else hashed. */
export function pickProduct(ctx: Pick<EngineContext, 'inputs' | 'settings' | 'nodeId'>): FixtureProduct {
  for (const i of ctx.inputs) {
    const p = i.meta?.fixtureProduct;
    if (typeof p === 'string' && (PRODUCTS as string[]).includes(p)) return p as FixtureProduct;
  }
  const bySha = ctx.inputs.map((i) => i.meta?.sha256).find((sha) => typeof sha === 'string');
  if (bySha) {
    for (const p of PRODUCTS) if (FIXTURE_MANIFEST.products[p].files['photo.png']?.sha256 === bySha) return p;
  }
  const s = ctx.settings;
  if (typeof s.look === 'string' && LOOK_PRODUCT[s.look]) return LOOK_PRODUCT[s.look]!;
  if (typeof s.motion === 'string' && MOTION_PRODUCT[s.motion]) return MOTION_PRODUCT[s.motion]!;
  const seed = [...(ctx.inputs[0]?.assetId ?? ctx.nodeId)].reduce(
    (a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0,
    7,
  );
  return PRODUCTS[seed % PRODUCTS.length]!;
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('cancelled', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('cancelled', 'AbortError'));
      },
      { once: true },
    );
  });
}

/** A failed quality gate: `gate` is its stable id, `message` is already in the run's language. */
export class GateFailure extends Error {
  constructor(
    public gate: string,
    message: string,
    public value?: number,
    public threshold?: number,
  ) {
    super(message);
  }
}

export function simulator(kind: NodeKind, opts: SimulatorOptions): Engine {
  return {
    kind,
    version: 'sim-1',
    async run(ctx: EngineContext): Promise<EngineResult> {
      const prompt = String(ctx.settings.prompt ?? '');
      const { t } = opts;
      const stages = (STAGES[kind] ?? ['api.stage.working']).map((k) => t(k));
      const total = (SECONDS[kind] ?? 3) * 1000 * opts.speed * (prompt.includes('#slow') ? 3 : 1);
      if (kind === 'model3d' && !ctx.inputs.some((i) => i.type === 'image' || i.text)) {
        throw new GateFailure('inputs', t('api.run.needsPhotoOrText'));
      }
      for (let i = 0; i < stages.length; i++) {
        await ctx.progress(i / stages.length, stages[i]!);
        await sleep(total / stages.length, ctx.signal);
      }
      const product = pickProduct(ctx);
      const outputs = await produce(kind, product, ctx, opts);
      const gates = gatesFor(kind, product, prompt);
      const failed = gates.find((g) => !g.passed);
      if (failed)
        throw new GateFailure(
          failed.id,
          t('api.run.gateFailed', { gate: gateName(t, failed.id) }),
          failed.value,
          failed.threshold,
        );
      await ctx.progress(1, t('api.stage.done'));
      return { outputs, gates, meta: { simulator: true, product } };
    },
  };
}

/** A gate's name for people (`web:bytes` → the `bytes` check), or its id when unnamed. */
export const gateName = (t: Translator, id: string) => tDynamic(t, `api.gate.${id.split(':').pop()}`, id);

export function gatesFor(kind: NodeKind, product: FixtureProduct, prompt: string): EngineResult['gates'] {
  const fail = prompt.includes('#fail');
  const tri = FIXTURE_MANIFEST.products[product].triangles;
  switch (kind) {
    case 'model3d':
      return [
        { id: 'silhouette_iou', passed: !fail, value: fail ? 0.61 : 0.93, threshold: 0.85 },
        { id: 'watertight', passed: true },
        { id: 'triangles', passed: tri <= 100_000, value: tri, threshold: 100_000 },
      ];
    case 'stage':
      return [{ id: 'product_visible', passed: !fail, value: fail ? 0.2 : 0.97, threshold: 0.8 }];
    case 'packshot':
      return [{ id: 'framing', passed: !fail, value: fail ? 0.4 : 0.95, threshold: 0.8 }];
    case 'adVideo':
      return [
        { id: 'duration_ok', passed: !fail },
        { id: 'loudness_lufs', passed: true, value: -14, threshold: -9 },
      ];
    default:
      return (FIXTURE_MANIFEST.products[product].exportReport?.checks ?? []).map((c) => ({
        id: `web:${c.id}`,
        passed: c.passed && !fail,
        value: c.value,
        threshold: c.limit,
      }));
  }
}

async function copy(opts: Pick<SimulatorOptions, 'readFixture'>, product: FixtureProduct, file: string) {
  const data = await opts.readFixture(`fixtures/${FIXTURE_VERSION}/${product}/${file}`);
  if (!data) throw new Error(`fixture ${product}/${file} missing in R2`);
  return data;
}

async function variant(
  ctx: Pick<EngineContext, 'putFile'>,
  opts: Pick<SimulatorOptions, 'readFixture'>,
  product: FixtureProduct,
  file: string,
  v: EngineVariant['variant'],
  mime: string,
  w?: number,
): Promise<EngineVariant> {
  const stored = await ctx.putFile(await copy(opts, product, file), { ext: file.split('.').pop()!, mime });
  return { variant: v, mime, ...stored, width: w, height: w };
}

export async function produce(
  kind: NodeKind,
  product: FixtureProduct,
  ctx: Pick<EngineContext, 'putArtifact' | 'putFile'>,
  opts: Pick<SimulatorOptions, 'readFixture'>,
): Promise<EngineOutput[]> {
  const meta = { fixtureProduct: product };
  const tri = FIXTURE_MANIFEST.products[product].triangles;
  switch (kind) {
    case 'model3d':
      return [
        await ctx.putArtifact(await copy(opts, product, 'model.glb'), {
          ext: 'glb',
          mime: 'model/gltf-binary',
          kind: 'model3d',
          role: 'primary',
          meta,
          triangleCount: tri,
          variants: [
            await variant(ctx, opts, product, 'model_thumb_256.webp', 'thumb_256', 'image/webp', 256),
            await variant(ctx, opts, product, 'model_poster_1024.webp', 'poster_1024', 'image/webp', 1024),
            await variant(ctx, opts, product, 'turntable.mp4', 'turntable_mp4', 'video/mp4', 512),
          ],
        }),
      ];
    case 'stage':
      return [
        await ctx.putArtifact(await copy(opts, product, 'stage.png'), {
          ext: 'png',
          mime: 'image/png',
          kind: 'image',
          role: 'primary',
          meta,
          width: 1024,
          height: 1024,
          variants: [
            await variant(ctx, opts, product, 'stage_thumb_256.webp', 'thumb_256', 'image/webp', 256),
            await variant(ctx, opts, product, 'stage_poster_1024.webp', 'poster_1024', 'image/webp', 1024),
          ],
        }),
      ];
    case 'packshot': {
      const out: EngineOutput[] = [];
      for (const p of ['three_quarter', 'front', 'top', 'detail']) {
        out.push(
          await ctx.putArtifact(await copy(opts, product, `packshot_${p}.png`), {
            ext: 'png',
            mime: 'image/png',
            kind: 'image',
            role: out.length ? 'packshot' : 'primary',
            meta: { ...meta, angle: p },
            width: 1024,
            height: 1024,
            variants: [
              await variant(
                ctx,
                opts,
                product,
                `packshot_${p}_thumb_256.webp`,
                'thumb_256',
                'image/webp',
                256,
              ),
              await variant(ctx, opts, product, `packshot_${p}_512.webp`, 'poster_512', 'image/webp', 512),
            ],
          }),
        );
      }
      return out;
    }
    case 'adVideo':
      return [
        await ctx.putArtifact(await copy(opts, product, 'ad_9x16.mp4'), {
          ext: 'mp4',
          mime: 'video/mp4',
          kind: 'video',
          role: 'primary',
          meta,
          width: 540,
          height: 960,
          durationMs: 10_000,
          variants: [await variant(ctx, opts, product, 'ad_poster_540.webp', 'poster_512', 'image/webp')],
        }),
      ];
    default: {
      // Export: the pre-built bundle made by the real exporter (fixtures/export-bundles.ts).
      const p = FIXTURE_MANIFEST.products[product];
      const report = p.exportReport ?? null;
      return [
        await ctx.putArtifact(await copy(opts, product, 'export_web.zip'), {
          ext: 'zip',
          mime: 'application/zip',
          kind: 'file',
          role: 'primary',
          meta: { ...meta, filename: `${product}-web.zip`, files: p.exportFiles, report },
        }),
        await ctx.putArtifact(await copy(opts, product, 'export_web.glb'), {
          ext: 'glb',
          mime: 'model/gltf-binary',
          kind: 'model3d',
          role: 'extra',
          meta: { ...meta, filename: `${product}-web.glb`, export: 'web', report },
          triangleCount: tri,
        }),
      ];
    }
  }
}
