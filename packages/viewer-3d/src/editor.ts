import {
  AnimationMixer,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  type Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  Raycaster,
  Scene,
  Sphere,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { acceleratedRaycast, CONTAINED, INTERSECTED, MeshBVH, NOT_INTERSECTED } from 'three-mesh-bvh';

export type EditorTool = 'orbit' | 'brush' | 'lasso';

export interface EditorOptions {
  dprCap?: number;
  onSelection?: (faces: number, regions: number) => void;
  onTime?: (t: number, duration: number, playing: boolean) => void;
}

/** One triangle-bearing primitive of the loaded GLB, with its global face offset. */
interface Part {
  mesh: Mesh;
  bvh: MeshBVH;
  /** Global id of this primitive's first triangle: document order (mesh index, primitive index). */
  offset: number;
  triangles: number;
  selected: Set<number>;
  overlay: Mesh;
}

interface Slot {
  scene: Scene;
  root: Group | null;
  parts: Part[];
  mixer: AnimationMixer | null;
  duration: number;
}

const SELECT_COLOR = new Color('#2f6bff');

/**
 * Model editor viewport (F8/F9). One WebGL context for the whole overlay; created on open,
 * fully disposed on close. Rendering is on demand. Face ids are global triangle indices in
 * glTF document order (mesh, then primitive, then triangle), so the server can apply an edit
 * to the same faces in the file. three-mesh-bvh runs `indirect`, which keeps the original
 * triangle order (`resolveTriangleIndex`) instead of rewriting the index buffer.
 */
export class ModelEditor {
  readonly canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private camera = new PerspectiveCamera(35, 1, 0.01, 100);
  private controls: OrbitControls;
  private pmrem: PMREMGenerator;
  private key = new DirectionalLight('#ffffff', 1.6);
  private slots: [Slot, Slot] = [this.emptySlot(), this.emptySlot()];
  private comparing = false;
  private tool: EditorTool = 'orbit';
  private brushRadiusPx = 24;
  private regions = 0;
  private strokeActive = false;
  private strokeAdded = false;
  private lasso: Vector2[] = [];
  private raycaster = new Raycaster();
  private frame: number | null = null;
  private playing = false;
  private lastTime = 0;
  private ro: ResizeObserver;
  private disposed = false;
  private opts: EditorOptions;

  constructor(canvas: HTMLCanvasElement, opts: EditorOptions = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.dprCap ?? 2));
    this.renderer.setClearColor('#f4f4f1');
    this.pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const env = this.pmrem.fromScene(room, 0.04).texture;
    room.dispose(); // its geometry/materials are only needed to bake the environment map
    for (const s of this.slots) {
      s.scene.environment = env;
      s.scene.add(new HemisphereLight('#ffffff', '#d0d4da', 0.6));
    }
    this.slots[0].scene.add(this.key);
    this.key.position.set(3, 5, 4);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.addEventListener('change', () => this.invalidate());
    this.raycaster.firstHitOnly = true;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    this.resize();
  }

  private emptySlot(): Slot {
    return { scene: new Scene(), root: null, parts: [], mixer: null, duration: 0 };
  }

  /** Loads a GLB into the main slot (0) or the compare slot (1). Resolves with triangle count. */
  async load(url: string, slot: 0 | 1 = 0): Promise<{ triangles: number; parts: number; duration: number }> {
    const gltf = await new GLTFLoader().loadAsync(url);
    if (this.disposed) return { triangles: 0, parts: 0, duration: 0 };
    this.clearSlot(slot);
    const s = this.slots[slot];
    s.root = gltf.scene;
    s.scene.add(gltf.scene);
    s.parts = this.indexParts(gltf);
    if (gltf.animations.length) {
      s.mixer = new AnimationMixer(gltf.scene);
      for (const clip of gltf.animations) s.mixer.clipAction(clip).play();
      s.duration = Math.max(...gltf.animations.map((a) => a.duration));
      s.mixer.setTime(0);
    }
    if (slot === 0) this.frameModel(gltf.scene);
    this.invalidate();
    return {
      triangles: s.parts.reduce((a, p) => a + p.triangles, 0),
      parts: s.parts.length,
      duration: s.duration,
    };
  }

  /** Global face offsets in glTF document order, from the loader's object ↔ index associations. */
  private indexParts(gltf: GLTF): Part[] {
    const entries: { mesh: Mesh; m: number; p: number }[] = [];
    gltf.scene.traverse((o: Object3D) => {
      if (!(o as Mesh).isMesh) return;
      const a = gltf.parser.associations.get(o) as { meshes?: number; primitives?: number } | undefined;
      entries.push({ mesh: o as Mesh, m: a?.meshes ?? Number.MAX_SAFE_INTEGER, p: a?.primitives ?? 0 });
    });
    entries.sort((x, y) => x.m - y.m || x.p - y.p);
    const counts = new Map<string, number>();
    const parts: Part[] = [];
    let offset = 0;
    for (const e of entries) {
      const g = e.mesh.geometry as BufferGeometry;
      const tris = g.index ? g.index.count / 3 : g.attributes.position!.count / 3;
      const k = `${e.m}/${e.p}`;
      // Instanced meshes (same mesh, several nodes) share face ids with their first instance.
      const known = counts.get(k);
      const partOffset = known ?? offset;
      if (known === undefined) {
        counts.set(k, offset);
        offset += tris;
      }
      const bvh = new MeshBVH(g, { indirect: true });
      (g as BufferGeometry & { boundsTree?: MeshBVH }).boundsTree = bvh;
      e.mesh.raycast = acceleratedRaycast;
      const overlay = new Mesh(
        new BufferGeometry(),
        new MeshBasicMaterial({
          color: SELECT_COLOR,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      overlay.geometry.setAttribute('position', g.attributes.position!);
      overlay.visible = false;
      overlay.renderOrder = 2;
      e.mesh.add(overlay);
      parts.push({ mesh: e.mesh, bvh, offset: partOffset, triangles: tris, selected: new Set(), overlay });
    }
    return parts;
  }

  private frameModel(root: Object3D) {
    const box = new Box3().setFromObject(root);
    const sphere = box.getBoundingSphere(new Sphere());
    const d = sphere.radius / Math.sin((this.camera.fov * Math.PI) / 360);
    this.controls.target.copy(sphere.center);
    this.camera.position
      .copy(sphere.center)
      .add(new Vector3(0.6, 0.35, 1).normalize().multiplyScalar(d * 1.1));
    this.camera.near = d / 100;
    this.camera.far = d * 10;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  setTool(t: EditorTool) {
    this.tool = t;
    this.controls.enabled = t === 'orbit';
    this.canvas.style.cursor = t === 'orbit' ? 'grab' : 'crosshair';
  }
  setBrushRadius(px: number) {
    this.brushRadiusPx = Math.max(4, Math.min(120, px));
  }
  setLightAzimuth(deg: number) {
    const r = (deg * Math.PI) / 180;
    this.key.position.set(Math.cos(r) * 5, 5, Math.sin(r) * 5);
    this.invalidate();
  }

  // ------------------------------------------------------------------ selection
  private ndc(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const x = this.comparing ? (e.clientX - r.left) / (r.width / 2) : (e.clientX - r.left) / r.width;
    return new Vector2(x * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private onDown = (e: PointerEvent) => {
    if (this.tool === 'orbit' || e.button !== 0) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.strokeActive = true;
    this.strokeAdded = false;
    if (this.tool === 'brush') this.paint(e);
    else this.lasso = [new Vector2(e.clientX, e.clientY)];
  };
  private onMove = (e: PointerEvent) => {
    if (!this.strokeActive) return;
    if (this.tool === 'brush') this.paint(e);
    else if (this.tool === 'lasso') {
      const last = this.lasso.at(-1)!;
      if (Math.hypot(last.x - e.clientX, last.y - e.clientY) > 3)
        this.lasso.push(new Vector2(e.clientX, e.clientY));
    }
  };
  private onUp = () => {
    if (!this.strokeActive) return;
    this.strokeActive = false;
    if (this.tool === 'lasso' && this.lasso.length > 2) this.lassoSelect();
    this.lasso = [];
    if (this.strokeAdded) this.regions++;
    this.emitSelection();
  };

  /** Brush: triangles inside a world-space sphere under the pointer (BVH shapecast). */
  private paint(e: PointerEvent) {
    const parts = this.slots[0].parts;
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const hit = this.raycaster.intersectObjects(
      parts.map((p) => p.mesh),
      false,
    )[0];
    if (!hit) return;
    // Screen radius → world radius at the hit depth.
    const dist = hit.distance;
    const worldPerPx = (2 * dist * Math.tan((this.camera.fov * Math.PI) / 360)) / this.canvas.clientHeight;
    const radius = this.brushRadiusPx * worldPerPx;
    for (const p of parts) {
      const inv = new Matrix4().copy(p.mesh.matrixWorld).invert();
      const center = hit.point.clone().applyMatrix4(inv);
      const scale = new Vector3().setFromMatrixScale(inv);
      const sphere = new Sphere(center, radius * Math.max(scale.x, scale.y, scale.z));
      let added = false;
      p.bvh.shapecast({
        intersectsBounds: (box) => {
          if (!sphere.intersectsBox(box)) return NOT_INTERSECTED;
          const { min, max } = box;
          for (const x of [min.x, max.x])
            for (const y of [min.y, max.y])
              for (const z of [min.z, max.z]) {
                if (sphere.center.distanceTo(new Vector3(x, y, z)) > sphere.radius) return INTERSECTED;
              }
          return CONTAINED;
        },
        intersectsTriangle: (tri, i, contained) => {
          if (contained || tri.intersectsSphere(sphere)) {
            const orig = p.bvh.resolveTriangleIndex(i);
            if (!p.selected.has(orig)) {
              p.selected.add(orig);
              added = true;
            }
          }
          return false;
        },
      });
      if (added) {
        this.strokeAdded = true;
        this.updateOverlay(p);
      }
    }
    this.invalidate();
  }

  /** Lasso: front-facing triangles whose centroid projects inside the screen polygon. */
  private lassoSelect() {
    const r = this.canvas.getBoundingClientRect();
    const poly = this.lasso.map((v) => new Vector2(v.x - r.left, v.y - r.top));
    const camPos = this.camera.position;
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const n = new Vector3();
    const centroid = new Vector3();
    const toCam = new Vector3();
    for (const p of this.slots[0].parts) {
      const g = p.mesh.geometry as BufferGeometry;
      const pos = g.attributes.position!;
      const idx = g.index;
      const m = p.mesh.matrixWorld;
      let added = false;
      for (let t = 0; t < p.triangles; t++) {
        const i0 = idx ? idx.getX(t * 3) : t * 3;
        const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
        const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        a.fromBufferAttribute(pos, i0).applyMatrix4(m);
        b.fromBufferAttribute(pos, i1).applyMatrix4(m);
        c.fromBufferAttribute(pos, i2).applyMatrix4(m);
        centroid
          .copy(a)
          .add(b)
          .add(c)
          .multiplyScalar(1 / 3);
        n.subVectors(b, a).cross(c.clone().sub(a));
        if (n.dot(toCam.subVectors(camPos, centroid)) <= 0) continue; // back-facing
        const s = centroid.project(this.camera);
        const sx = ((s.x + 1) / 2) * r.width;
        const sy = ((1 - s.y) / 2) * r.height;
        if (inside(poly, sx, sy) && !p.selected.has(t)) {
          p.selected.add(t);
          added = true;
        }
      }
      if (added) {
        this.strokeAdded = true;
        this.updateOverlay(p);
      }
    }
    this.invalidate();
  }

  private updateOverlay(p: Part) {
    const src = (p.mesh.geometry as BufferGeometry).index;
    const ids = [...p.selected];
    const arr = new Uint32Array(ids.length * 3);
    ids.forEach((t, k) => {
      arr[k * 3] = src ? src.getX(t * 3) : t * 3;
      arr[k * 3 + 1] = src ? src.getX(t * 3 + 1) : t * 3 + 1;
      arr[k * 3 + 2] = src ? src.getX(t * 3 + 2) : t * 3 + 2;
    });
    p.overlay.geometry.setIndex(new BufferAttribute(arr, 1));
    p.overlay.visible = ids.length > 0;
  }

  clearSelection() {
    for (const p of this.slots[0].parts) {
      p.selected.clear();
      this.updateOverlay(p);
    }
    this.regions = 0;
    this.emitSelection();
    this.invalidate();
  }

  /** Selected faces as sorted global ids (what the edit endpoint receives). */
  selection(): number[] {
    const out: number[] = [];
    for (const p of this.slots[0].parts) for (const t of p.selected) out.push(p.offset + t);
    return [...new Set(out)].sort((x, y) => x - y);
  }
  regionCount() {
    return this.regions;
  }
  private emitSelection() {
    this.opts.onSelection?.(this.selection().length, this.regions);
  }

  // ------------------------------------------------------------------ compare, camera, playback
  async compareWith(url: string | null) {
    if (!url) {
      this.comparing = false;
      this.clearSlot(1);
      this.resize();
      return;
    }
    await this.load(url, 1);
    this.comparing = true;
    this.resize();
  }
  isComparing() {
    return this.comparing;
  }

  cameraState() {
    return {
      position: this.camera.position.toArray().map((v) => +v.toFixed(4)) as [number, number, number],
      target: this.controls.target.toArray().map((v) => +v.toFixed(4)) as [number, number, number],
      fov: this.camera.fov,
    };
  }

  play() {
    if (!this.slots[0].mixer) return;
    this.playing = true;
    this.lastTime = performance.now();
    this.invalidate();
  }
  pause() {
    this.playing = false;
    this.emitTime();
  }
  seek(t: number) {
    for (const s of this.slots) s.mixer?.setTime(t);
    this.emitTime();
    this.invalidate();
  }
  private emitTime() {
    const s = this.slots[0];
    this.opts.onTime?.(s.mixer ? s.mixer.time % Math.max(s.duration, 0.001) : 0, s.duration, this.playing);
  }

  // ------------------------------------------------------------------ rendering
  invalidate() {
    if (this.frame === null && !this.disposed) this.frame = requestAnimationFrame(this.render);
  }

  private render = () => {
    this.frame = null;
    if (this.disposed) return;
    const now = performance.now();
    if (this.playing) {
      const dt = (now - this.lastTime) / 1000;
      for (const s of this.slots) s.mixer?.update(dt);
      this.emitTime();
    }
    this.lastTime = now;
    const moving = this.controls.update();
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.comparing) {
      this.renderer.setScissorTest(true);
      for (const [i, s] of this.slots.entries()) {
        this.renderer.setViewport(i * (w / 2), 0, w / 2, h);
        this.renderer.setScissor(i * (w / 2), 0, w / 2, h);
        this.renderer.render(s.scene, this.camera);
      }
      this.renderer.setScissorTest(false);
    } else {
      this.renderer.setViewport(0, 0, w, h);
      this.renderer.render(this.slots[0].scene, this.camera);
    }
    if (moving || this.playing) this.invalidate();
  };

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = (this.comparing ? w / 2 : w) / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  /** A PNG of the current view (used as a quick poster for edited versions). */
  snapshot(): string {
    this.render();
    return this.canvas.toDataURL('image/png');
  }

  private clearSlot(i: 0 | 1) {
    const s = this.slots[i];
    if (!s.root) return;
    s.scene.remove(s.root);
    s.root.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        for (const v of Object.values(mat))
          if (v && typeof v === 'object' && 'isTexture' in v) (v as { dispose(): void }).dispose();
        mat.dispose();
      }
    });
    for (const p of s.parts) {
      p.overlay.geometry.dispose();
      (p.overlay.material as MeshBasicMaterial).dispose();
    }
    s.mixer?.stopAllAction();
    this.slots[i] = { ...this.emptySlot(), scene: s.scene };
  }

  /** Releases every GPU resource and the WebGL context (memory-leak-debugging skill: open/close must return to baseline). */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    // three r186 keeps one module-level DFG LUT DataTexture for all renderers; each renderer adds
    // a 'dispose' listener to it that renderer.dispose() never removes, so every closed editor
    // stayed reachable (heap snapshot: DFG_LUT._listeners → onTextureDispose → WebGLRenderer).
    // Grab it from a rendered material now, and dispose it after the renderer to drop them.
    let dfgLut: { dispose(): void } | null = null;
    for (const s of this.slots) {
      s.scene.traverse((o: Object3D) => {
        const m = o as Mesh;
        if (dfgLut || !m.isMesh) return;
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          const u = (
            this.renderer.properties.get(mat) as { uniforms?: { dfgLUT?: { value?: { dispose(): void } } } }
          ).uniforms;
          if (u?.dfgLUT?.value) dfgLut = u.dfgLUT.value;
        }
      });
    }
    this.ro.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    this.clearSlot(0);
    this.clearSlot(1);
    for (const s of this.slots) s.scene.environment?.dispose();
    this.controls.dispose();
    // OrbitControls (three r186) removes its capture-phase keydown/keyup listeners from
    // `canvas.getRootNode()`. If the canvas was already detached (React removes DOM before
    // passive effect cleanups), that is not the document and the listeners leaked, retaining
    // the whole editor and its WebGL context (heap snapshot, 2026-09-24). Remove them here too.
    const c = this.controls as unknown as {
      _interceptControlDown?: EventListener;
      _interceptControlUp?: EventListener;
    };
    const doc = this.canvas.ownerDocument;
    if (c._interceptControlDown)
      doc.removeEventListener('keydown', c._interceptControlDown, { capture: true });
    if (c._interceptControlUp) doc.removeEventListener('keyup', c._interceptControlUp, { capture: true });
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    (dfgLut as { dispose(): void } | null)?.dispose();
  }
}

function inside(poly: Vector2[], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}
