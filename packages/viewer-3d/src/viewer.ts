import {
  AmbientLight,
  BackSide,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  Scene,
  ShadowMaterial,
  Spherical,
  SRGBColorSpace,
  type Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { applyFinish, type BuiltFixture, buildFixture, type Finish, type FixtureId } from './fixtures';
import {
  type AnimationPreset,
  type BackgroundPreset,
  backgroundColor,
  CAMERAS,
  type CameraPreset,
  LIGHTS,
  type LightPreset,
} from './presets';
import { uiColor } from './theme';

export interface ViewerSceneInput {
  fixtureId: FixtureId;
  background: BackgroundPreset;
  materialColor: string;
  finish: Finish;
  light: LightPreset;
  cameraPreset: CameraPreset;
  placement: { x: number; y: number; rotationY: number; scale: number };
  animation: { preset: AnimationPreset; durationSec: number };
  brandColor: string;
}

export interface ViewerStats {
  framesRendered: number;
  lastFrameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  dpr: number;
  idle: boolean;
  fixtureId: FixtureId | null;
  contextLost: boolean;
}

export interface ViewerOptions {
  dprCap?: number;
  reducedMotion?: boolean;
  onSelect?: (partId: string | null) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onTime?: (timeSec: number, playing: boolean) => void;
  onStats?: (s: ViewerStats) => void;
  /** Called after every rendered frame with the wall-clock frame duration; used by perf tooling. */
  onFrame?: (frameMs: number) => void;
}

export function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/**
 * Demand-rendered product viewer. Renders a frame only when something changed (camera, scene,
 * selection, resize) or while playback/damping is active. Owns every GPU resource it creates.
 */
export class ProductViewer {
  readonly canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera: PerspectiveCamera;
  private controls: OrbitControls;
  private product = new Group();
  private fixture: BuiltFixture | null = null;
  private env: Texture | null = null;
  private pmrem: PMREMGenerator | null = null;
  private hemi = new HemisphereLight('#ffffff', '#cfd4dc', 1);
  private key = new DirectionalLight('#ffffff', 2);
  private fill = new DirectionalLight('#ffffff', 1);
  private rim = new DirectionalLight('#ffffff', 1);
  private ambient = new AmbientLight('#ffffff', 0.05);
  private shadowPlane: Mesh;
  private shadowMat: ShadowMaterial;
  private outline: Mesh | null = null;
  private outlineMat = new MeshBasicMaterial({
    color: uiColor('--accent', '#c0441a'),
    side: BackSide,
    transparent: true,
    opacity: 0.9,
  });
  private raycaster = new Raycaster();
  private pointer = new Vector2();
  private selected: string | null = null;
  private input: ViewerSceneInput | null = null;
  private opts: ViewerOptions;
  private disposed = false;
  private visible = true;
  private pending: number | null = null;
  private dirty = false;
  private stats: ViewerStats;
  private frameTimes: number[] = [];
  private dprCap: number;
  private currentDpr: number;
  private lowDprUntil = 0;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private fitDistance = 3;
  private contextLost = false;
  // playback
  private playing = false;
  private timeSec = 0;
  private lastTick = 0;
  private durationSec = 6;
  private animPreset: AnimationPreset = 'turntable';
  private baseCamPos = new Vector3();
  private baseTarget = new Vector3();
  private userMovedDuringPlayback = false;
  private downPos = { x: 0, y: 0 };
  private onVisibility = () => {
    if (document.hidden) this.cancelFrame();
    else {
      this.resize();
      this.invalidate('visible');
    }
  };

  constructor(canvas: HTMLCanvasElement, opts: ViewerOptions = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.dprCap = opts.dprCap ?? 2;
    this.currentDpr = Math.min(this.dprCap, window.devicePixelRatio || 1);
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.setPixelRatio(this.currentDpr);
    this.camera = new PerspectiveCamera(32, 1, 0.1, 50);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 12;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.addEventListener('change', () => this.invalidate('controls'));
    this.controls.addEventListener('start', () => {
      if (this.playing) this.userMovedDuringPlayback = true;
    });
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.camera.near = 0.5;
    this.key.shadow.camera.far = 20;
    this.key.shadow.camera.left = -3;
    this.key.shadow.camera.right = 3;
    this.key.shadow.camera.top = 3;
    this.key.shadow.camera.bottom = -3;
    this.key.shadow.bias = -0.0005;
    this.key.shadow.radius = 4;
    this.shadowMat = new ShadowMaterial({ opacity: 0.25 });
    this.shadowPlane = new Mesh(new PlaneGeometry(12, 12), this.shadowMat);
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.receiveShadow = true;
    this.scene.add(this.hemi, this.key, this.fill, this.rim, this.ambient, this.shadowPlane, this.product);
    this.stats = {
      framesRendered: 0,
      lastFrameMs: 0,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      dpr: this.currentDpr,
      idle: true,
      fixtureId: null,
      contextLost: false,
    };
    this.setupEnvironment();
    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas.parentElement ?? canvas);
    }
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver((entries) => {
        const e = entries[0];
        if (!e) return;
        this.visible = e.isIntersecting;
        if (this.visible) this.invalidate('intersect');
        else this.cancelFrame();
      });
      this.io.observe(canvas);
    }
    this.resize();
  }

  // ---------- lifecycle ----------

  private setupEnvironment(): void {
    this.pmrem?.dispose();
    this.env?.dispose();
    this.pmrem = new PMREMGenerator(this.renderer);
    this.env = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.env;
    this.pmrem.dispose();
    this.pmrem = null;
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    this.stats.contextLost = true;
    this.cancelFrame();
    this.opts.onContextLost?.();
  };

  private handleContextRestored = () => {
    this.contextLost = false;
    this.stats.contextLost = false;
    this.setupEnvironment();
    this.renderer.shadowMap.needsUpdate = true;
    this.opts.onContextRestored?.();
    this.invalidate('restored');
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelFrame();
    this.ro?.disconnect();
    this.io?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.controls.dispose();
    this.clearFixture();
    this.outlineMat.dispose();
    (this.shadowPlane.geometry as PlaneGeometry).dispose();
    this.shadowMat.dispose();
    this.env?.dispose();
    this.scene.environment = null;
    this.renderer.dispose();
    // Do not force a context loss: a remount on the same canvas must be able to create a new renderer.
  }

  private clearFixture(): void {
    if (this.outline) {
      this.outline.geometry.dispose?.();
      this.outline.parent?.remove(this.outline);
      this.outline = null;
    }
    if (this.fixture) {
      this.product.remove(this.fixture.root);
      this.fixture.dispose();
      this.fixture = null;
    }
    this.selected = null;
  }

  // ---------- sizing / DPR ----------

  resize(): void {
    if (this.disposed) return;
    const host = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, Math.floor(host.clientWidth));
    const h = Math.max(1, Math.floor(host.clientHeight));
    if (
      w === this.canvas.clientWidth &&
      h === this.canvas.clientHeight &&
      this.canvas.width === Math.floor(w * this.currentDpr)
    )
      return;
    this.renderer.setPixelRatio(this.currentDpr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate('resize');
  }

  private adaptDpr(now: number): void {
    const target = Math.min(this.dprCap, window.devicePixelRatio || 1);
    const p95 = percentile(this.frameTimes, 0.95);
    if (this.frameTimes.length >= 40 && p95 > 20 && this.currentDpr > 1.25) {
      this.currentDpr = 1.25;
      this.lowDprUntil = now + 2000;
      this.renderer.setPixelRatio(this.currentDpr);
      this.frameTimes.length = 0;
    } else if (this.currentDpr < target && now > this.lowDprUntil && !this.playing) {
      this.currentDpr = target;
      this.renderer.setPixelRatio(this.currentDpr);
    }
    this.stats.dpr = this.currentDpr;
  }

  // ---------- scene application ----------

  setScene(input: ViewerSceneInput): void {
    if (this.disposed) return;
    const prev = this.input;
    this.input = input;
    let rebuilt = false;
    if (!this.fixture || prev?.fixtureId !== input.fixtureId) {
      this.clearFixture();
      this.fixture = buildFixture(input.fixtureId, input.materialColor, input.finish);
      this.product.add(this.fixture.root);
      this.stats.fixtureId = input.fixtureId;
      rebuilt = true;
    } else {
      if (prev?.materialColor !== input.materialColor || prev?.finish !== input.finish) {
        for (const p of this.fixture.parts) {
          const m = p.mesh.material as import('three').MeshPhysicalMaterial;
          if (p.colorable) m.color.set(input.materialColor);
          if ('roughness' in m) applyFinish(m, input.finish);
        }
      }
    }
    if (prev?.background !== input.background || prev?.brandColor !== input.brandColor) {
      this.scene.background = backgroundColor(input.background, input.brandColor);
    }
    if (prev?.light !== input.light || rebuilt) this.applyLight(input.light);
    this.product.position.set(input.placement.x, input.placement.y, 0);
    this.product.scale.setScalar(input.placement.scale);
    this.product.rotation.y = (input.placement.rotationY * Math.PI) / 180;
    this.animPreset = input.animation.preset;
    this.durationSec = Math.max(1, input.animation.durationSec);
    if (rebuilt || prev?.cameraPreset !== input.cameraPreset)
      this.setCameraPreset(input.cameraPreset, rebuilt);
    if (this.timeSec > this.durationSec) this.timeSec = 0;
    this.renderer.shadowMap.needsUpdate = true;
    if (this.playing) this.applyAnimationPose();
    this.invalidate('scene');
  }

  private applyLight(preset: LightPreset): void {
    const l = LIGHTS[preset];
    this.hemi.color.set(l.hemiSky);
    this.hemi.groundColor.set(l.hemiGround);
    this.hemi.intensity = l.hemiIntensity;
    this.key.intensity = l.keyIntensity;
    this.key.position.set(...l.keyPosition);
    this.fill.intensity = l.fillIntensity;
    this.fill.position.set(...l.fillPosition);
    this.rim.intensity = l.rimIntensity;
    this.rim.position.set(...l.rimPosition);
    this.scene.environmentIntensity = l.envIntensity;
    this.shadowMat.opacity = l.shadowOpacity;
    this.renderer.shadowMap.needsUpdate = true;
  }

  // ---------- camera ----------

  private fitDistanceFor(): number {
    const f = this.fixture;
    const r = (f ? Math.max(f.radius, f.height * 0.62) : 1) * (this.input?.placement.scale ?? 1);
    const fov = (this.camera.fov * Math.PI) / 180;
    const aspect = Math.max(0.5, this.camera.aspect);
    const vertical = r / Math.sin(fov / 2);
    const horizontal = r / Math.sin(Math.atan(Math.tan(fov / 2) * aspect));
    return Math.max(vertical, horizontal) * 1.08;
  }

  setCameraPreset(preset: CameraPreset, instant = true): void {
    const c = CAMERAS[preset];
    this.fitDistance = this.fitDistanceFor();
    const targetY =
      (this.fixture?.height ?? 1) * c.targetY * (this.input?.placement.scale ?? 1) +
      (this.input?.placement.y ?? 0);
    const target = new Vector3(this.input?.placement.x ?? 0, targetY, 0);
    const sph = new Spherical(
      this.fitDistance * c.distance,
      ((90 - c.elevation) * Math.PI) / 180,
      (c.azimuth * Math.PI) / 180,
    );
    const pos = new Vector3().setFromSpherical(sph).add(target);
    if (instant || this.opts.reducedMotion) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
    } else {
      this.tweenCamera(pos, target, 260);
    }
    this.baseCamPos.copy(pos);
    this.baseTarget.copy(target);
    this.userMovedDuringPlayback = false;
    this.invalidate('camera');
  }

  resetCamera(): void {
    this.setCameraPreset(this.input?.cameraPreset ?? 'three-quarter', false);
  }

  fitToObject(): void {
    this.fitDistance = this.fitDistanceFor();
    const dir = new Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    const targetY =
      (this.fixture?.height ?? 1) * 0.5 * (this.input?.placement.scale ?? 1) + (this.input?.placement.y ?? 0);
    const target = new Vector3(this.input?.placement.x ?? 0, targetY, 0);
    const pos = target.clone().add(dir.multiplyScalar(this.fitDistance));
    this.tweenCamera(pos, target, 240);
  }

  private tween: {
    from: Vector3;
    to: Vector3;
    fromT: Vector3;
    toT: Vector3;
    start: number;
    ms: number;
  } | null = null;
  private tweenCamera(pos: Vector3, target: Vector3, ms: number): void {
    if (this.opts.reducedMotion) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
      this.invalidate('camera');
      return;
    }
    this.tween = {
      from: this.camera.position.clone(),
      to: pos.clone(),
      fromT: this.controls.target.clone(),
      toT: target.clone(),
      start: performance.now(),
      ms,
    };
    this.invalidate('tween');
  }

  getCameraState(): { position: [number, number, number]; target: [number, number, number] } {
    return {
      position: this.camera.position.toArray() as [number, number, number],
      target: this.controls.target.toArray() as [number, number, number],
    };
  }

  setCameraState(s: { position: [number, number, number]; target: [number, number, number] }): void {
    this.camera.position.fromArray(s.position);
    this.controls.target.fromArray(s.target);
    this.controls.update();
    this.invalidate('camera');
  }

  // ---------- selection ----------

  private handlePointerDown = (e: PointerEvent) => {
    this.downPos = { x: e.clientX, y: e.clientY };
  };

  private handlePointerUp = (e: PointerEvent) => {
    const dx = e.clientX - this.downPos.x;
    const dy = e.clientY - this.downPos.y;
    if (dx * dx + dy * dy > 16) return; // it was a drag
    this.pick(e.clientX, e.clientY);
  };

  pick(clientX: number, clientY: number): string | null {
    if (!this.fixture) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const candidates: Object3D[] = [];
    this.fixture.root.traverse((o) => {
      if ((o as Mesh).isMesh && o !== this.outline) candidates.push(o);
    });
    const hits = this.raycaster.intersectObjects(candidates, false);
    const id = hits[0] ? ((hits[0].object.userData.partId as string) ?? null) : null;
    this.select(id);
    return id;
  }

  select(partId: string | null): void {
    if (partId === this.selected) return;
    this.selected = partId;
    if (this.outline) {
      this.outline.parent?.remove(this.outline);
      this.outline = null;
    }
    const part = this.fixture?.parts.find((p) => p.id === partId);
    if (part) {
      const o = new Mesh(part.mesh.geometry, this.outlineMat);
      o.scale.setScalar(1.035);
      o.userData.partId = '__outline';
      part.mesh.add(o);
      this.outline = o;
    }
    this.opts.onSelect?.(partId);
    this.invalidate('select');
  }

  getSelected(): string | null {
    return this.selected;
  }

  partIds(): string[] {
    return this.fixture?.parts.map((p) => p.id) ?? [];
  }

  // ---------- playback ----------

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.lastTick = performance.now();
    this.userMovedDuringPlayback = false;
    if (this.animPreset !== 'turntable') {
      this.baseCamPos.copy(this.camera.position);
      this.baseTarget.copy(this.controls.target);
    }
    this.opts.onTime?.(this.timeSec, true);
    this.invalidate('play');
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.opts.onTime?.(this.timeSec, false);
    this.invalidate('pause');
  }

  isPlaying(): boolean {
    return this.playing;
  }

  seek(sec: number): void {
    this.timeSec = Math.max(0, Math.min(this.durationSec, sec));
    this.applyAnimationPose();
    this.opts.onTime?.(this.timeSec, this.playing);
    this.invalidate('seek');
  }

  time(): number {
    return this.timeSec;
  }

  duration(): number {
    return this.durationSec;
  }

  private applyAnimationPose(): void {
    const t = this.durationSec > 0 ? this.timeSec / this.durationSec : 0;
    const base = ((this.input?.placement.rotationY ?? 0) * Math.PI) / 180;
    switch (this.animPreset) {
      case 'turntable':
        this.product.rotation.y = base + t * Math.PI * 2;
        break;
      case 'orbit-sweep': {
        this.product.rotation.y = base;
        if (this.userMovedDuringPlayback) return;
        const rel = new Vector3().subVectors(this.baseCamPos, this.baseTarget);
        const sph = new Spherical().setFromVector3(rel);
        const sweep = Math.sin(t * Math.PI * 2) * ((40 * Math.PI) / 180);
        sph.theta += sweep;
        sph.phi = Math.min(Math.PI * 0.5, Math.max(0.2, sph.phi - Math.sin(t * Math.PI) * 0.12));
        this.camera.position.setFromSpherical(sph).add(this.baseTarget);
        this.controls.target.copy(this.baseTarget);
        break;
      }
      case 'dolly-in': {
        this.product.rotation.y = base + t * 0.35;
        if (this.userMovedDuringPlayback) return;
        const rel = new Vector3().subVectors(this.baseCamPos, this.baseTarget);
        const k = 1.45 - 0.55 * easeInOut(t);
        this.camera.position.copy(this.baseTarget).add(rel.multiplyScalar(k));
        this.controls.target.copy(this.baseTarget);
        break;
      }
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  // ---------- frame scheduling (demand rendering) ----------

  invalidate(_reason?: string): void {
    this.dirty = true;
    if (this.disposed || this.contextLost || !this.visible || document.hidden) return;
    if (this.pending !== null) return;
    this.pending = requestAnimationFrame(this.frame);
    this.stats.idle = false;
  }

  private cancelFrame(): void {
    if (this.pending !== null) {
      cancelAnimationFrame(this.pending);
      this.pending = null;
    }
    this.stats.idle = true;
  }

  private frame = (now: number) => {
    this.pending = null;
    if (this.disposed || this.contextLost || document.hidden || !this.visible) {
      this.stats.idle = true;
      return;
    }
    const needsRender = this.dirty;
    this.dirty = false;
    let motion = false;
    if (this.tween) {
      const k = Math.min(1, (now - this.tween.start) / this.tween.ms);
      const e = easeInOut(k);
      this.camera.position.lerpVectors(this.tween.from, this.tween.to, e);
      this.controls.target.lerpVectors(this.tween.fromT, this.tween.toT, e);
      if (k >= 1) this.tween = null;
      else motion = true;
    }
    if (this.playing) {
      const dt = Math.min(0.1, (now - this.lastTick) / 1000);
      this.lastTick = now;
      this.timeSec = (this.timeSec + dt) % this.durationSec;
      this.applyAnimationPose();
      this.opts.onTime?.(this.timeSec, true);
      motion = true;
    }
    // controls.update returns true while damping is still moving the camera
    const damping = this.controls.update();
    if (damping) motion = true;
    if (needsRender || motion) {
      const t0 = performance.now();
      this.renderer.render(this.scene, this.camera);
      const ms = performance.now() - t0;
      this.stats.framesRendered += 1;
      this.stats.lastFrameMs = ms;
      this.stats.drawCalls = this.renderer.info.render.calls;
      this.stats.triangles = this.renderer.info.render.triangles;
      this.stats.geometries = this.renderer.info.memory.geometries;
      this.stats.textures = this.renderer.info.memory.textures;
      this.frameTimes.push(ms);
      if (this.frameTimes.length > 120) this.frameTimes.shift();
      this.opts.onFrame?.(ms);
      if (motion) this.adaptDpr(now);
    }
    if (motion || this.dirty) {
      this.pending = requestAnimationFrame(this.frame);
      this.stats.idle = false;
    } else {
      this.stats.idle = true;
      if (this.currentDpr < Math.min(this.dprCap, window.devicePixelRatio || 1)) {
        // restore full resolution after settling
        setTimeout(() => {
          if (!this.disposed && !this.playing && this.pending === null) {
            this.adaptDpr(performance.now() + 5000);
            this.invalidate('dpr-restore');
          }
        }, 300);
      }
    }
    this.opts.onStats?.(this.stats);
  };

  getStats(): ViewerStats {
    return { ...this.stats };
  }

  frameTimeDistribution(): { p50: number; p95: number; max: number; samples: number } {
    return {
      p50: percentile(this.frameTimes, 0.5),
      p95: percentile(this.frameTimes, 0.95),
      max: Math.max(0, ...this.frameTimes),
      samples: this.frameTimes.length,
    };
  }

  // ---------- capture ----------

  /** Renders the current view to an ImageData at the requested size (off-screen target). */
  renderToImageData(width: number, height: number): ImageData {
    const target = new WebGLRenderTarget(width, height, { samples: 4 });
    const prevAspect = this.camera.aspect;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
    const buf = new Uint8ClampedArray(width * height * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, width, height, buf);
    this.renderer.setRenderTarget(null);
    target.dispose();
    this.camera.aspect = prevAspect;
    this.camera.updateProjectionMatrix();
    // flip vertically (GL origin is bottom-left)
    const row = width * 4;
    const flipped = new Uint8ClampedArray(buf.length);
    for (let y = 0; y < height; y++)
      flipped.set(buf.subarray(y * row, (y + 1) * row), (height - 1 - y) * row);
    this.invalidate('capture');
    return new ImageData(flipped, width, height);
  }

  captureStream(fps = 30): MediaStream {
    return this.canvas.captureStream(fps);
  }

  /** Perf tooling: add N extra copies of the current fixture in a grid (stress scene). */
  addStressCopies(count: number): number {
    if (!this.fixture) return 0;
    let tris = 0;
    const cols = Math.ceil(Math.sqrt(count));
    for (let i = 0; i < count; i++) {
      const clone = this.fixture.root.clone(true);
      clone.position.set(((i % cols) - cols / 2) * 2.4, 0, -2 - Math.floor(i / cols) * 2.4);
      this.product.add(clone);
      tris += this.fixture.triangles;
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate('stress');
    return tris;
  }
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]!;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
