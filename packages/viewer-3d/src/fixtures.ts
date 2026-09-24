import {
  type BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';

export type FixtureId = 'serum-bottle' | 'headphones' | 'smart-speaker' | 'ring';
export type Finish = 'matte' | 'satin' | 'gloss';

export interface FixturePart {
  id: string;
  mesh: Mesh;
  /** Whether the brand/material colour applies to this part. */
  colorable: boolean;
}

export interface BuiltFixture {
  id: FixtureId;
  root: Group;
  parts: FixturePart[];
  triangles: number;
  /** Bounding radius used for camera fitting. */
  radius: number;
  height: number;
  dispose(): void;
}

function tri(g: BufferGeometry): number {
  const idx = g.getIndex();
  return Math.round((idx ? idx.count : g.getAttribute('position').count) / 3);
}

function finishParams(finish: Finish): { roughness: number; clearcoat: number; clearcoatRoughness: number } {
  switch (finish) {
    case 'matte':
      return { roughness: 0.85, clearcoat: 0, clearcoatRoughness: 0.6 };
    case 'satin':
      return { roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3 };
    case 'gloss':
      return { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08 };
  }
}

export function applyFinish(mat: MeshPhysicalMaterial | MeshStandardMaterial, finish: Finish): void {
  const p = finishParams(finish);
  mat.roughness = p.roughness;
  if (mat instanceof MeshPhysicalMaterial) {
    mat.clearcoat = p.clearcoat;
    mat.clearcoatRoughness = p.clearcoatRoughness;
  }
  mat.needsUpdate = true;
}

const shared = { fabric: null as CanvasTexture | null };

function fabricTexture(): CanvasTexture {
  if (shared.fabric) return shared.fabric;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, size, size);
  // deterministic dot weave
  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      const v = ((x * 7 + y * 13) % 17) / 17;
      ctx.fillStyle = `rgba(${Math.round(120 + 60 * v)},${Math.round(120 + 60 * v)},${Math.round(120 + 60 * v)},1)`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(6, 3);
  shared.fabric = t;
  return t;
}

function buildSerumBottle(color: string, finish: Finish): BuiltFixture {
  const root = new Group();
  const parts: FixturePart[] = [];
  let triangles = 0;
  // Body profile (radius, height) — slightly shouldered bottle
  const pts: Vector2[] = [];
  const profile: [number, number][] = [
    [0, 0],
    [0.3, 0],
    [0.34, 0.02],
    [0.36, 0.1],
    [0.36, 0.9],
    [0.34, 1.02],
    [0.26, 1.1],
    [0.17, 1.14],
    [0.16, 1.2],
    [0.16, 1.3],
    [0, 1.3],
  ];
  for (const [r, y] of profile) pts.push(new Vector2(r, y));
  const bodyGeo = new LatheGeometry(pts, 72);
  const bodyMat = new MeshPhysicalMaterial({ color: new Color(color), metalness: 0.05 });
  applyFinish(bodyMat, finish);
  const body = new Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);
  parts.push({ id: 'body', mesh: body, colorable: true });
  triangles += tri(bodyGeo);

  // Label band
  const labelGeo = new CylinderGeometry(0.365, 0.365, 0.42, 72, 1, true);
  const labelMat = new MeshStandardMaterial({ color: new Color('#f4f1ec'), roughness: 0.7, metalness: 0 });
  const label = new Mesh(labelGeo, labelMat);
  label.position.y = 0.5;
  root.add(label);
  parts.push({ id: 'label', mesh: label, colorable: false });
  triangles += tri(labelGeo);

  // Cap + dropper bulb
  const capGeo = new CylinderGeometry(0.19, 0.19, 0.34, 48);
  const capMat = new MeshPhysicalMaterial({
    color: new Color('#1d1f24'),
    roughness: 0.3,
    metalness: 0.4,
    clearcoat: 0.6,
  });
  const cap = new Mesh(capGeo, capMat);
  cap.position.y = 1.47;
  cap.castShadow = true;
  const bulbGeo = new SphereGeometry(0.15, 32, 24);
  const bulb = new Mesh(bulbGeo, capMat);
  bulb.scale.set(1, 0.75, 1);
  bulb.position.y = 1.7;
  const capGroup = new Group();
  capGroup.add(cap, bulb);
  root.add(capGroup);
  parts.push({ id: 'cap', mesh: cap, colorable: false });
  triangles += tri(capGeo) + tri(bulbGeo);
  // bulb shares the cap part for picking
  bulb.userData.partId = 'cap';
  cap.userData.partId = 'cap';
  body.userData.partId = 'body';
  label.userData.partId = 'label';

  return {
    id: 'serum-bottle',
    root,
    parts,
    triangles,
    radius: 1.0,
    height: 1.82,
    dispose() {
      bodyGeo.dispose();
      labelGeo.dispose();
      capGeo.dispose();
      bulbGeo.dispose();
      bodyMat.dispose();
      labelMat.dispose();
      capMat.dispose();
    },
  };
}

function buildHeadphones(color: string, finish: Finish): BuiltFixture {
  const root = new Group();
  const parts: FixturePart[] = [];
  let triangles = 0;
  const geos: BufferGeometry[] = [];
  const mats: (MeshPhysicalMaterial | MeshStandardMaterial)[] = [];

  // Headband: arc of a circle centred above the cups, ending just above each cup.
  const bandCenterY = 0.45;
  const bandR = 1.05;
  const arc: Vector3[] = [];
  for (let i = 0; i <= 32; i++) {
    const a = (Math.PI * 15) / 180 + (Math.PI * 150 * (i / 32)) / 180;
    arc.push(new Vector3(Math.cos(a) * bandR, Math.sin(a) * bandR + bandCenterY, 0));
  }
  const bandGeo = new TubeGeometry(new CatmullRomCurve3(arc), 128, 0.07, 20, false);
  const bandMat = new MeshPhysicalMaterial({ color: new Color('#22252b'), metalness: 0.25 });
  applyFinish(bandMat, finish);
  const band = new Mesh(bandGeo, bandMat);
  band.castShadow = true;
  band.userData.partId = 'band';
  root.add(band);
  parts.push({ id: 'band', mesh: band, colorable: false });
  geos.push(bandGeo);
  mats.push(bandMat);
  triangles += tri(bandGeo);
  // Padded underside of the band
  const padGeo = new TubeGeometry(
    new CatmullRomCurve3(
      arc.slice(8, 25).map((v) =>
        v
          .clone()
          .multiplyScalar(0.94)
          .add(new Vector3(0, bandCenterY * 0.06, 0)),
      ),
    ),
    48,
    0.085,
    16,
    false,
  );
  const padMat = new MeshStandardMaterial({ color: new Color('#3a3d44'), roughness: 0.95 });
  const pad = new Mesh(padGeo, padMat);
  pad.userData.partId = 'cushions';
  root.add(pad);
  geos.push(padGeo);
  mats.push(padMat);
  triangles += tri(padGeo);

  const cupMat = new MeshPhysicalMaterial({ color: new Color(color), metalness: 0.15 });
  applyFinish(cupMat, finish);
  mats.push(cupMat);
  const cupY = 0.5;
  for (const side of [-1, 1] as const) {
    const id = side < 0 ? 'cup-left' : 'cup-right';
    // Domed cup profile (radius, depth) revolved around X via rotation
    const prof = [
      new Vector2(0, 0),
      new Vector2(0.36, 0),
      new Vector2(0.4, 0.05),
      new Vector2(0.41, 0.16),
      new Vector2(0.38, 0.24),
      new Vector2(0.3, 0.29),
      new Vector2(0.15, 0.32),
      new Vector2(0, 0.33),
    ];
    const cupGeo = new LatheGeometry(prof, 64);
    const cup = new Mesh(cupGeo, cupMat);
    cup.rotation.z = side < 0 ? Math.PI / 2 : -Math.PI / 2; // dome points outward
    cup.position.set(side * 0.86, cupY, 0);
    cup.castShadow = true;
    cup.userData.partId = id;
    root.add(cup);
    parts.push({ id, mesh: cup, colorable: true });
    geos.push(cupGeo);
    triangles += tri(cupGeo);
    // Yoke: from band end down to the cup rim
    const yokeGeo = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(
          side * Math.cos((Math.PI * 15) / 180) * bandR,
          Math.sin((Math.PI * 15) / 180) * bandR + bandCenterY,
          0,
        ),
        new Vector3(side * 1.12, 0.62, 0),
        new Vector3(side * 1.1, cupY + 0.12, 0),
      ]),
      24,
      0.03,
      12,
      false,
    );
    const yoke = new Mesh(yokeGeo, bandMat);
    yoke.userData.partId = 'band';
    root.add(yoke);
    geos.push(yokeGeo);
    triangles += tri(yokeGeo);
    // Cushion on the inner face
    const cushGeo = new TorusGeometry(0.29, 0.1, 24, 64);
    const cush = new Mesh(cushGeo, padMat);
    cush.rotation.y = Math.PI / 2;
    cush.position.set(side * 0.8, cupY, 0);
    cush.userData.partId = 'cushions';
    root.add(cush);
    geos.push(cushGeo);
    triangles += tri(cushGeo);
    if (side < 0) parts.push({ id: 'cushions', mesh: cush, colorable: false });
  }

  return {
    id: 'headphones',
    root,
    parts,
    triangles,
    radius: 1.3,
    height: 1.6,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}

function buildSmartSpeaker(color: string, finish: Finish): BuiltFixture {
  const root = new Group();
  const parts: FixturePart[] = [];
  let triangles = 0;
  const geos: BufferGeometry[] = [];
  const mats: (MeshPhysicalMaterial | MeshStandardMaterial)[] = [];

  const bodyGeo = new CylinderGeometry(0.52, 0.5, 1.15, 96, 1);
  const bodyMat = new MeshStandardMaterial({
    color: new Color(color),
    roughness: 1,
    metalness: 0,
    map: fabricTexture(),
  });
  const body = new Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.partId = 'body';
  root.add(body);
  parts.push({ id: 'body', mesh: body, colorable: true });
  geos.push(bodyGeo);
  mats.push(bodyMat);
  triangles += tri(bodyGeo);

  const topPts = [
    new Vector2(0, 0),
    new Vector2(0.46, 0),
    new Vector2(0.52, 0.03),
    new Vector2(0.5, 0.09),
    new Vector2(0, 0.09),
  ];
  const topGeo = new LatheGeometry(topPts, 96);
  const topMat = new MeshPhysicalMaterial({ color: new Color('#e9ecf0'), metalness: 0.1 });
  applyFinish(topMat, finish);
  const top = new Mesh(topGeo, topMat);
  top.position.y = 1.175;
  top.userData.partId = 'top';
  root.add(top);
  parts.push({ id: 'top', mesh: top, colorable: false });
  geos.push(topGeo);
  mats.push(topMat);
  triangles += tri(topGeo);

  const ringGeo = new TorusGeometry(0.47, 0.012, 12, 96);
  const ringMat = new MeshStandardMaterial({
    color: new Color('#2457d6'),
    emissive: new Color('#2457d6'),
    emissiveIntensity: 1.2,
    roughness: 0.4,
  });
  const ring = new Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.26;
  ring.userData.partId = 'ring';
  root.add(ring);
  parts.push({ id: 'ring', mesh: ring, colorable: false });
  geos.push(ringGeo);
  mats.push(ringMat);
  triangles += tri(ringGeo);

  const baseGeo = new CylinderGeometry(0.5, 0.48, 0.05, 96, 1);
  const baseMat = new MeshStandardMaterial({ color: new Color('#2a2d33'), roughness: 0.6, metalness: 0.2 });
  const base = new Mesh(baseGeo, baseMat);
  base.position.y = 0.025;
  base.userData.partId = 'base';
  root.add(base);
  parts.push({ id: 'base', mesh: base, colorable: false });
  geos.push(baseGeo);
  mats.push(baseMat);
  triangles += tri(baseGeo);

  return {
    id: 'smart-speaker',
    root,
    parts,
    triangles,
    radius: 0.9,
    height: 1.3,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}

export function buildFixture(id: FixtureId, color: string, finish: Finish): BuiltFixture {
  switch (id) {
    case 'serum-bottle':
      return buildSerumBottle(color, finish);
    case 'headphones':
      return buildHeadphones(color, finish);
    case 'smart-speaker':
      return buildSmartSpeaker(color, finish);
    case 'ring':
      return buildRing(color, finish);
  }
}

export const FIXTURE_IDS: FixtureId[] = ['serum-bottle', 'headphones', 'smart-speaker', 'ring'];

/**
 * Solitaire ring for the jewelry line: torus band, brilliant-cut stone (lathe profile of
 * crown + pavilion, 16 facets) with physical transmission, and four prongs.
 */
function buildRing(color: string, finish: Finish): BuiltFixture {
  const root = new Group();
  const parts: FixturePart[] = [];
  let triangles = 0;
  const metal = new MeshPhysicalMaterial({ color: new Color(color), metalness: 1, roughness: 0.18 });
  applyFinish(metal, finish);
  metal.metalness = 1;
  const bandGeo = new TorusGeometry(0.42, 0.055, 32, 128);
  const band = new Mesh(bandGeo, metal);
  band.position.y = 0.42;
  band.castShadow = true;
  root.add(band);
  parts.push({ id: 'band', mesh: band, colorable: true });
  triangles += tri(bandGeo);
  // Brilliant cut profile: table, crown, girdle, pavilion to culet.
  const cut: [number, number][] = [
    [0, 0],
    [0.2, 0.2],
    [0.21, 0.215],
    [0.16, 0.29],
    [0.1, 0.305],
    [0, 0.305],
  ];
  const gemGeo = new LatheGeometry(
    cut.map(([r, y]) => new Vector2(r, y)),
    16,
  );
  const gemMat = new MeshPhysicalMaterial({
    color: new Color('#ffffff'),
    metalness: 0,
    roughness: 0,
    transmission: 1,
    ior: 2.42,
    thickness: 0.3,
    dispersion: 5,
    flatShading: true,
  });
  const gem = new Mesh(gemGeo, gemMat);
  gem.position.y = 0.42 + 0.42 - 0.02;
  gem.castShadow = true;
  root.add(gem);
  parts.push({ id: 'stone', mesh: gem, colorable: false });
  triangles += tri(gemGeo);
  const prongGeo = new CylinderGeometry(0.018, 0.022, 0.28, 12);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const prong = new Mesh(prongGeo, metal);
    prong.position.set(Math.cos(a) * 0.17, 0.42 + 0.42 + 0.1, Math.sin(a) * 0.17);
    prong.rotation.z = Math.cos(a) * 0.18;
    prong.rotation.x = -Math.sin(a) * 0.18;
    prong.castShadow = true;
    root.add(prong);
    parts.push({ id: `prong-${i + 1}`, mesh: prong, colorable: true });
    triangles += tri(prongGeo);
  }
  return {
    id: 'ring',
    root,
    parts,
    triangles,
    radius: 0.62,
    height: 1.15,
    dispose() {
      bandGeo.dispose();
      gemGeo.dispose();
      prongGeo.dispose();
      metal.dispose();
      gemMat.dispose();
    },
  };
}
