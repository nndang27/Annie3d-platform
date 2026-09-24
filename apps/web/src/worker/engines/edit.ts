import { type Document, type Material, type Primitive, WebIO } from '@gltf-transform/core';

/**
 * Simulated region edit (F8): applies an instruction to the selected faces of a GLB for real,
 * so the edited version visibly differs in the editor. Selected triangles move into a new
 * primitive that shares the original vertex attributes and gets a material derived from the
 * instruction (colour words, matte/gloss/metal). Face ids are global triangle indices in
 * document order (mesh → primitive → triangle), the same order the editor uses.
 */
const COLORS: Record<string, [number, number, number]> = {
  red: [0.8, 0.08, 0.08],
  blue: [0.1, 0.25, 0.85],
  green: [0.1, 0.6, 0.25],
  black: [0.02, 0.02, 0.02],
  white: [0.95, 0.95, 0.95],
  gold: [1, 0.77, 0.34],
  silver: [0.9, 0.9, 0.92],
  pink: [0.95, 0.55, 0.7],
  orange: [0.95, 0.45, 0.1],
  yellow: [0.95, 0.85, 0.15],
  purple: [0.5, 0.25, 0.75],
  brown: [0.4, 0.25, 0.12],
  grey: [0.5, 0.5, 0.5],
  gray: [0.5, 0.5, 0.5],
  rose: [0.9, 0.6, 0.6],
};

export interface EditLook {
  color: [number, number, number] | null;
  roughness: number | null;
  metalness: number | null;
}

export function lookFromInstruction(text: string): EditLook {
  const t = text.toLowerCase();
  const color = Object.entries(COLORS).find(([k]) => new RegExp(`\\b${k}\\b`).test(t))?.[1] ?? null;
  const matte = /\b(matte|matt|satin|frosted|rough)\b/.test(t);
  const gloss = /\b(gloss|glossy|shiny|polished|lacquer)\b/.test(t);
  const metal = /\b(metal|metallic|chrome|gold|silver|brushed)\b/.test(t);
  return {
    color,
    roughness: matte ? 0.9 : gloss ? 0.08 : metal ? 0.25 : null,
    metalness: metal ? 1 : matte || gloss ? 0 : null,
  };
}

function triangleCount(p: Primitive): number {
  if (p.getMode() !== 4) return 0; // TRIANGLES only
  const idx = p.getIndices();
  return idx ? idx.getCount() / 3 : (p.getAttribute('POSITION')?.getCount() ?? 0) / 3;
}

export async function applyRegionEdit(
  glb: Uint8Array,
  faces: number[],
  instruction: string,
): Promise<{ glb: Uint8Array; changedFaces: number }> {
  const io = new WebIO();
  const doc: Document = await io.readBinary(glb);
  const look = lookFromInstruction(instruction);
  const wanted = new Set(faces);
  let offset = 0;
  let changed = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const tris = triangleCount(prim);
      const local: number[] = [];
      for (let t = 0; t < tris; t++) if (wanted.has(offset + t)) local.push(t);
      offset += tris;
      if (!local.length) continue;
      changed += local.length;
      const idx = prim.getIndices();
      const read = (t: number, k: number) => (idx ? idx.getScalar(t * 3 + k) : t * 3 + k);
      const pick = new Set(local);
      const keep: number[] = [];
      const moved: number[] = [];
      for (let t = 0; t < tris; t++) (pick.has(t) ? moved : keep).push(read(t, 0), read(t, 1), read(t, 2));
      const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
      const make = (arr: number[]) =>
        doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(arr)).setBuffer(buffer);
      // The original primitive keeps the other triangles; face ids of later primitives are
      // unchanged because the edited triangles stay within this mesh (appended primitive).
      prim.setIndices(make(keep));
      const edited = prim
        .clone()
        .setIndices(make(moved))
        .setMaterial(editedMaterial(doc, prim.getMaterial(), look));
      mesh.addPrimitive(edited);
    }
  }
  return { glb: await io.writeBinary(doc), changedFaces: changed };
}

function editedMaterial(doc: Document, base: Material | null, look: EditLook): Material {
  const m = base ? base.clone() : doc.createMaterial();
  m.setName(`${base?.getName() ?? 'material'} (edited)`);
  if (look.color) {
    m.setBaseColorFactor([...look.color, 1]);
    m.setBaseColorTexture(null);
  }
  if (look.roughness !== null) m.setRoughnessFactor(look.roughness);
  if (look.metalness !== null) m.setMetallicFactor(look.metalness);
  if (!look.color && look.roughness === null && look.metalness === null) {
    // Unknown instruction: a visible, neutral change so the result is never silently identical.
    m.setBaseColorFactor([0.18, 0.42, 1, 1]);
  }
  return m;
}
