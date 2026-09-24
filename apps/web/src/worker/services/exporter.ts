import { GLB_PRESETS, type GlbPresetId } from '@annie3d/contracts';
import { type Document, WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { zipSync } from 'fflate';

export interface ExportCheck {
  id: 'bytes' | 'triangles' | 'texture' | 'animation' | 'validator';
  passed: boolean;
  value: number;
  limit: number;
  message: string;
}
export interface ExportReport {
  preset: string;
  passed: boolean;
  checks: ExportCheck[];
}

/** Pixel size from PNG / JPEG / WebP headers (no decoding; Workers have no image stack). */
export function imageSize(b: Uint8Array): { w: number; h: number } | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return { w: dv.getUint32(16), h: dv.getUint32(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1]!;
      const len = dv.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
        return { h: dv.getUint16(i + 5), w: dv.getUint16(i + 7) };
      i += 2 + len;
    }
    return null;
  }
  if (b.length > 30 && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') {
    const kind = String.fromCharCode(...b.slice(12, 16));
    if (kind === 'VP8X')
      return {
        w: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)),
        h: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)),
      };
    if (kind === 'VP8 ') return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
    if (kind === 'VP8L') {
      const bits = dv.getUint32(21, true);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

/**
 * Lossless clean-up: drops properties nothing references (unused accessors, materials,
 * textures, meshes, skins). @gltf-transform/functions would do more, but it pulls in ndarray,
 * which generates code with `new Function` — forbidden in Workers ("Code generation from
 * strings disallowed", 2026-09-24).
 */
function pruneUnused(doc: Document) {
  const root = doc.getRoot();
  const onlyRoot = (p: { listParents(): unknown[] }) => p.listParents().every((x) => x === root);
  for (let pass = 0; pass < 3; pass++) {
    for (const m of root.listMeshes()) if (onlyRoot(m)) m.dispose();
    for (const m of root.listMaterials()) if (onlyRoot(m)) m.dispose();
    for (const t of root.listTextures()) if (onlyRoot(t)) t.dispose();
    for (const a of root.listAccessors()) if (onlyRoot(a)) a.dispose();
    for (const s of root.listSkins()) if (onlyRoot(s)) s.dispose();
  }
}

/** Rendered triangles: a mesh counts once per node that references it (instancing). */
function triangles(doc: Document): number {
  const refs = new Map<unknown, number>();
  for (const node of doc.getRoot().listNodes()) {
    const m = node.getMesh();
    if (m) refs.set(m, (refs.get(m) ?? 0) + 1);
  }
  let total = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    let t = 0;
    for (const p of mesh.listPrimitives()) {
      if (p.getMode() !== 4) continue;
      const idx = p.getIndices();
      t += idx ? idx.getCount() / 3 : (p.getAttribute('POSITION')?.getCount() ?? 0) / 3;
    }
    total += t * Math.max(1, refs.get(mesh) ?? 0);
  }
  return Math.round(total);
}

/**
 * Optimises a GLB for a preset and checks it against the preset's limits (F6).
 * Optimisation is lossless (unused data removed). Decimation and texture compression need
 * WASM/native encoders that Workers cannot compile at runtime; they belong to the export
 * engine plugged in later, and the report says exactly which limit fails until then.
 */
export async function exportGlb(
  input: Uint8Array,
  presetId: GlbPresetId,
): Promise<{ glb: Uint8Array; report: ExportReport }> {
  const preset = GLB_PRESETS[presetId];
  const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
  let doc: Document;
  let readError: string | null = null;
  try {
    doc = await io.readBinary(input);
  } catch (e) {
    readError = (e as Error).message;
    doc = new (await import('@gltf-transform/core')).Document();
  }
  if (!readError) pruneUnused(doc);
  const glb = readError ? input : await io.writeBinary(doc);
  // Re-read what we wrote: a structural round trip is the validator available in Workers.
  let validatorOk = !readError;
  let validatorMsg = readError
    ? `Not a valid glTF: ${readError.slice(0, 160)}`
    : 'Reads back as valid glTF 2.0';
  if (!readError) {
    try {
      await io.readBinary(glb);
    } catch (e) {
      validatorOk = false;
      validatorMsg = `Round trip failed: ${(e as Error).message.slice(0, 160)}`;
    }
  }
  const tris = readError ? 0 : triangles(doc);
  let maxTex = 0;
  for (const t of doc.getRoot().listTextures()) {
    const img = t.getImage();
    const size = img ? imageSize(img) : null;
    if (size) maxTex = Math.max(maxTex, size.w, size.h);
  }
  const anims = doc.getRoot().listAnimations().length;
  const mb = (n: number) => `${(n / 1048576).toFixed(2)} MB`;
  const checks: ExportCheck[] = [
    {
      id: 'bytes',
      passed: glb.byteLength <= preset.maxBytes,
      value: glb.byteLength,
      limit: preset.maxBytes,
      message: `${mb(glb.byteLength)} of ${mb(preset.maxBytes)}`,
    },
    {
      id: 'triangles',
      passed: tris <= preset.maxTriangles,
      value: tris,
      limit: preset.maxTriangles,
      message: `${tris.toLocaleString('en')} of ${preset.maxTriangles.toLocaleString('en')} triangles`,
    },
    {
      id: 'texture',
      passed: maxTex <= preset.maxTexture,
      value: maxTex,
      limit: preset.maxTexture,
      message: maxTex ? `Largest texture ${maxTex}px (limit ${preset.maxTexture}px)` : 'No image textures',
    },
    {
      id: 'animation',
      passed: !preset.requiresAnimation || anims > 0,
      value: anims,
      limit: preset.requiresAnimation ? 1 : 0,
      message: preset.requiresAnimation
        ? anims
          ? `${anims} animation clip(s)`
          : 'Needs an animation (e.g. turntable)'
        : `${anims} animation clip(s), none required`,
    },
    { id: 'validator', passed: validatorOk, value: validatorOk ? 1 : 0, limit: 1, message: validatorMsg },
  ];
  return { glb, report: { preset: presetId, passed: checks.every((c) => c.passed), checks } };
}

/** One zip with everything exported, for "Download all". */
export function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  return zipSync(Object.fromEntries(files.map((f) => [f.name, [f.data, { level: 0 }]])));
}
