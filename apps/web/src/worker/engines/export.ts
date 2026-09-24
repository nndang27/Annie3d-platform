import type { EngineContext, EngineOutput, GlbPresetId, ResolvedInput } from '@annie3d/contracts';
import { GLB_PRESETS } from '@annie3d/contracts';
import { type ExportReport, exportGlb, zip } from '../services/exporter';

async function sha(buf: ArrayBuffer) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'annie3d';

export interface BundleOptions {
  preset: GlbPresetId;
  includeMp4: boolean;
  includePng: boolean;
  name: string;
}

/**
 * Builds an export bundle (F6) from resolved inputs: the first 3D model is optimised and checked
 * against the preset; videos and images are included as they are; everything also goes into
 * one zip. Used by the Export node's engine and by the direct export API.
 */
export async function buildBundle(
  ctx: Pick<EngineContext, 'putArtifact' | 'readInput' | 'progress'>,
  inputs: ResolvedInput[],
  opts: BundleOptions,
): Promise<{ outputs: EngineOutput[]; report: ExportReport | null; files: string[] }> {
  const outputs: EngineOutput[] = [];
  const zipped: { name: string; data: Uint8Array }[] = [];
  let report: ExportReport | null = null;
  const base = slug(opts.name);
  const model = inputs.find((i) => i.type === 'model3d' && i.assetId);
  if (model) {
    await ctx.progress(0.2, `Optimising for ${GLB_PRESETS[opts.preset].label}`);
    const res = await exportGlb(new Uint8Array(await ctx.readInput(model)), opts.preset);
    report = res.report;
    const buf = res.glb.buffer.slice(
      res.glb.byteOffset,
      res.glb.byteOffset + res.glb.byteLength,
    ) as ArrayBuffer;
    const name = `${base}-${opts.preset}.glb`;
    outputs.push(
      await ctx.putArtifact(buf, {
        ext: 'glb',
        mime: 'model/gltf-binary',
        kind: 'model3d',
        role: 'extra',
        meta: { export: opts.preset, filename: name, report: res.report },
        triangleCount: res.report.checks.find((c) => c.id === 'triangles')?.value,
      }),
    );
    zipped.push({ name, data: res.glb });
  }
  let n = 0;
  for (const i of inputs) {
    if (!i.assetId) continue;
    const wantVideo = opts.includeMp4 && i.type === 'video';
    const wantImage = opts.includePng && i.type === 'image';
    if (!wantVideo && !wantImage) continue;
    await ctx.progress(0.5, 'Collecting files');
    const data = await ctx.readInput(i);
    const ext =
      i.mime === 'video/mp4'
        ? 'mp4'
        : i.mime === 'image/webp'
          ? 'webp'
          : i.mime === 'image/jpeg'
            ? 'jpg'
            : 'png';
    const name = wantVideo ? `${base}-ad.${ext}` : `${base}-image-${++n}.${ext}`;
    zipped.push({ name, data: new Uint8Array(data) });
    // Already stored: reference the same asset (dedupe by content), no copy.
    outputs.push({
      storageKey: '',
      mime: i.mime ?? 'application/octet-stream',
      byteSize: data.byteLength,
      sha256: await sha(data),
      kind: wantVideo ? 'video' : 'image',
      role: 'extra',
      meta: { filename: name },
    });
  }
  if (!zipped.length) throw new Error('Nothing to export: connect a 3D model, video or images');
  await ctx.progress(0.8, 'Packaging');
  const z = zip(zipped);
  const zbuf = z.buffer.slice(z.byteOffset, z.byteOffset + z.byteLength) as ArrayBuffer;
  const zipName = `${base}-${opts.preset}.zip`;
  outputs.unshift(
    await ctx.putArtifact(zbuf, {
      ext: 'zip',
      mime: 'application/zip',
      kind: 'file',
      role: 'primary',
      meta: { filename: zipName, files: zipped.map((f) => f.name), report },
    }),
  );
  return { outputs, report, files: zipped.map((f) => f.name) };
}
