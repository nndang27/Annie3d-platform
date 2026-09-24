// Renders simulator fixtures with the product viewer used by the app (same materials, lights).
import { buildFixture, type FixtureId, ProductViewer } from '@annie3d/viewer-3d';
import { AnimationClip, Group, Quaternion, QuaternionKeyframeTrack, Vector3 } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

type Look = {
  background: 'studio-white' | 'cool-gray' | 'charcoal' | 'brand';
  brand: string;
  light: 'studio-soft' | 'dramatic' | 'daylight';
};
const canvas = document.getElementById('c') as HTMLCanvasElement;
const out = document.getElementById('o') as HTMLCanvasElement;
const viewer = new ProductViewer(canvas, { dprCap: 1 });
let current: { id: FixtureId; color: string; finish: 'matte' | 'satin' | 'gloss' } | null = null;

function scene(
  look: Look,
  camera: 'three-quarter' | 'front' | 'top' | 'detail',
  rotationY = 0,
  anim: 'turntable' | 'orbit-sweep' | 'dolly-in' = 'turntable',
  dur = 6,
) {
  viewer.setScene({
    fixtureId: current!.id,
    background: look.background,
    materialColor: current!.color,
    finish: current!.finish,
    light: look.light,
    cameraPreset: camera,
    placement: { x: 0, y: 0, rotationY, scale: 1 },
    animation: { preset: anim, durationSec: dur },
    brandColor: look.brand,
  });
  // Captures happen synchronously: skip the 260 ms camera tween used for interactive changes.
  viewer.setCameraPreset(camera, true);
}

function toDataUrl(
  img: ImageData,
  type: 'image/png' | 'image/jpeg',
  overlay?: (g: CanvasRenderingContext2D, w: number, h: number) => void,
): string {
  out.width = img.width;
  out.height = img.height;
  const g = out.getContext('2d')!;
  g.putImageData(img, 0, 0);
  overlay?.(g, img.width, img.height);
  return out.toDataURL(type, 0.9);
}

function adOverlay(headline: string, cta: string, t: number) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    const fadeIn = Math.min(1, t / 0.8);
    g.globalAlpha = fadeIn;
    g.fillStyle = 'rgba(255,255,255,0.0)';
    g.font = `600 ${Math.round(w * 0.075)}px Inter, system-ui, sans-serif`;
    g.fillStyle = '#17191d';
    g.textAlign = 'center';
    g.fillText(headline, w / 2, h * 0.12);
    const endCard = Math.max(0, Math.min(1, (t - 8) / 0.6));
    if (endCard > 0) {
      g.globalAlpha = endCard;
      g.fillStyle = '#17191d';
      const bw = w * 0.5;
      const bh = h * 0.06;
      g.beginPath();
      g.roundRect((w - bw) / 2, h * 0.84, bw, bh, bh / 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.font = `600 ${Math.round(w * 0.045)}px Inter, system-ui, sans-serif`;
      g.fillText(cta, w / 2, h * 0.84 + bh * 0.66);
    }
    g.globalAlpha = 1;
  };
}

const api = {
  /** Re-encodes an image (data URL) to WebP at the given width using the browser's encoder. */
  async webp(dataUrl: string, width: number, quality = 0.82): Promise<string> {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const h = Math.round((img.height * width) / img.width);
    out.width = width;
    out.height = h;
    const g = out.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, width, h);
    return out.toDataURL('image/webp', quality);
  },
  init(id: FixtureId, color: string, finish: 'matte' | 'satin' | 'gloss') {
    current = { id, color, finish };
    return true;
  },
  still(
    look: Look,
    camera: 'three-quarter' | 'front' | 'top' | 'detail',
    rotationY: number,
    w: number,
    h: number,
  ) {
    scene(look, camera, rotationY);
    viewer.seek(0);
    return toDataUrl(viewer.renderToImageData(w, h), 'image/png');
  },
  /** One frame of a turntable/ad at time t (seconds). */
  frame(
    look: Look,
    anim: 'turntable' | 'orbit-sweep' | 'dolly-in',
    dur: number,
    t: number,
    w: number,
    h: number,
    ad?: { headline: string; cta: string },
  ) {
    scene(look, 'three-quarter', 0, anim, dur);
    viewer.seek(t % dur);
    return toDataUrl(
      viewer.renderToImageData(w, h),
      'image/jpeg',
      ad ? adOverlay(ad.headline, ad.cta, t) : undefined,
    );
  },
  /** Binary glTF of the product with a 6 s turntable animation baked in. */
  async glb(): Promise<{ base64: string; triangles: number }> {
    const built = buildFixture(current!.id, current!.color, current!.finish);
    const pivot = new Group();
    pivot.name = 'product';
    pivot.add(built.root);
    const times = [0, 1.5, 3, 4.5, 6];
    const values: number[] = [];
    for (const [i] of times.entries())
      values.push(
        ...new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (i / 4) * Math.PI * 2).toArray(),
      );
    const clip = new AnimationClip('turntable', 6, [
      new QuaternionKeyframeTrack('product.quaternion', times, values),
    ]);
    const buf = (await new GLTFExporter().parseAsync(pivot, {
      binary: true,
      animations: [clip],
    })) as ArrayBuffer;
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { base64: btoa(bin), triangles: built.triangles };
  },
};
(window as unknown as { gen: typeof api }).gen = api;
(window as unknown as { genReady: boolean }).genReady = true;
