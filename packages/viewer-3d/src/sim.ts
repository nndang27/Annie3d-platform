import {
  Box3,
  DirectionalLight,
  Euler,
  Group,
  HemisphereLight,
  type Material,
  type Mesh,
  type Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  Quaternion,
  Scene,
  Sphere,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface SimViewerOptions {
  dprCap?: number;
}

/** Device orientation in degrees (W3C DeviceOrientationEvent: alpha about Z, beta about X, gamma about Y). */
export interface DevicePose {
  alpha: number;
  beta: number;
  gamma: number;
}

const DEG = Math.PI / 180;

/** W3C device orientation → quaternion (intrinsic Z-X'-Y'', as three's DeviceOrientationControls did). */
function poseQuaternion(p: DevicePose): Quaternion {
  return new Quaternion().setFromEuler(new Euler(p.beta * DEG, p.alpha * DEG, -p.gamma * DEG, 'YXZ'));
}

/**
 * Product viewer for F13 simulations: a transparent canvas the simulated page is drawn around.
 * Orbit with the mouse, turntable spin, or follow a phone's orientation (relative to the pose at
 * "recenter"). Renders on demand; one WebGL context, released on dispose.
 */
export class SimViewer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(32, 1, 0.01, 100);
  private readonly controls: OrbitControls;
  private readonly pivot = new Group();
  private readonly ro: ResizeObserver;
  private readonly pmrem: PMREMGenerator;
  private root: Object3D | null = null;
  private frame: number | null = null;
  private disposed = false;
  private spin = false;
  private last = 0;
  /** Phone pose target (relative to calibration) and the inverse of the calibration pose. */
  private target: Quaternion | null = null;
  private zero = new Quaternion();
  private lastPose: Quaternion | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: SimViewerOptions = {},
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.dprCap ?? 2));
    this.renderer.setClearColor(0x000000, 0);
    this.pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = this.pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    this.scene.add(new HemisphereLight('#ffffff', '#cfd3da', 0.7));
    const key = new DirectionalLight('#ffffff', 1.4);
    key.position.set(3, 5, 4);
    this.scene.add(key, this.pivot);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.addEventListener('change', () => this.invalidate());
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
  }

  async load(url: string): Promise<void> {
    const gltf = await new GLTFLoader().loadAsync(url);
    if (this.disposed) return;
    this.clear();
    // Centre the model on the pivot so phone rotation turns it about its own middle.
    const box = new Box3().setFromObject(gltf.scene);
    const sphere = box.getBoundingSphere(new Sphere());
    gltf.scene.position.sub(sphere.center);
    this.root = gltf.scene;
    this.pivot.add(gltf.scene);
    const d = sphere.radius / Math.sin((this.camera.fov * DEG) / 2);
    this.controls.target.set(0, 0, 0);
    this.camera.position.copy(new Vector3(0.35, 0.25, 1).normalize().multiplyScalar(d * 1.15));
    this.camera.near = d / 100;
    this.camera.far = d * 10;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.invalidate();
  }

  setSpin(on: boolean) {
    this.spin = on;
    this.last = performance.now();
    this.invalidate();
  }

  isSpinning() {
    return this.spin;
  }

  /** Follow a phone: the model turns as the phone turns, relative to the last recenter. */
  setDevicePose(p: DevicePose) {
    const q = poseQuaternion(p);
    if (!this.lastPose) this.zero.copy(q).invert();
    this.lastPose = q;
    this.target = this.zero.clone().multiply(q);
    this.spin = false;
    this.invalidate();
  }

  /** Nudge by a drag on the phone's touch pad (degrees). */
  nudge(dx: number, dy: number) {
    const q = new Quaternion().setFromEuler(new Euler(dy * DEG, dx * DEG, 0, 'YXZ'));
    this.target = q.multiply(this.target ?? this.pivot.quaternion.clone());
    this.invalidate();
  }

  recenter() {
    if (this.lastPose) this.zero.copy(this.lastPose).invert();
    this.target = new Quaternion();
    this.invalidate();
  }

  /** PNG of the current view with a transparent background. */
  snapshot(type: 'image/png' | 'image/jpeg' = 'image/png', quality?: number): string {
    this.render();
    return this.canvas.toDataURL(type, quality);
  }

  invalidate() {
    if (this.frame === null && !this.disposed) this.frame = requestAnimationFrame(this.render);
  }

  private render = () => {
    this.frame = null;
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    let moving = this.controls.update();
    if (this.spin) {
      this.pivot.rotation.y += dt * 0.6;
      moving = true;
    } else if (this.target) {
      // Smooth the phone signal (~60 ms time constant) so sensor jitter does not shake the model.
      this.pivot.quaternion.slerp(this.target, 1 - Math.exp(-dt / 0.06));
      moving ||= this.pivot.quaternion.angleTo(this.target) > 0.001;
    }
    this.renderer.render(this.scene, this.camera);
    if (moving) this.invalidate();
  };

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  private clear() {
    if (!this.root) return;
    this.pivot.remove(this.root);
    this.root.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as Material[]) {
        for (const v of Object.values(mat))
          if (v && typeof v === 'object' && 'isTexture' in v) (v as { dispose(): void }).dispose();
        mat.dispose();
      }
    });
    this.root = null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.ro.disconnect();
    this.controls.dispose();
    this.clear();
    this.scene.environment?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
