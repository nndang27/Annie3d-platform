import { defaultScene, PRODUCT_FIXTURES, TEMPLATES } from '@annie3d/contracts';
import { ProductViewer, type ViewerSceneInput } from '@annie3d/viewer-3d';

interface Job {
  key: string;
  input: ViewerSceneInput;
  width: number;
  height: number;
}

declare global {
  interface Window {
    renderPoster: (input: ViewerSceneInput, width: number, height: number) => Promise<string>;
    posterJobs: () => Job[];
    posterReady: boolean;
  }
}

const canvas = document.getElementById('c') as HTMLCanvasElement;
const host = document.getElementById('host') as HTMLDivElement;
const viewer = new ProductViewer(canvas, { dprCap: 1 });

window.posterJobs = () => {
  const jobs: Job[] = [];
  for (const id of Object.keys(PRODUCT_FIXTURES) as (keyof typeof PRODUCT_FIXTURES)[]) {
    const f = PRODUCT_FIXTURES[id];
    jobs.push({
      key: `fixture:${id}`,
      input: { ...defaultScene(id, f.defaultColor), brandColor: '#2457d6' },
      width: 1280,
      height: 960,
    });
  }
  for (const t of TEMPLATES) {
    const f = PRODUCT_FIXTURES[t.fixtureId];
    jobs.push({
      key: `template:${t.slug}`,
      input: {
        ...defaultScene(t.fixtureId, t.scene.materialColor ?? f.defaultColor),
        background: t.scene.background,
        light: t.scene.light,
        cameraPreset: t.slug.includes('scale')
          ? 'front'
          : t.slug.includes('feature')
            ? 'detail'
            : 'three-quarter',
        brandColor: t.ad.brandColor,
      },
      width: 1280,
      height: 960,
    });
  }
  const hp = PRODUCT_FIXTURES.headphones;
  jobs.push({
    key: 'hero',
    input: { ...defaultScene('headphones', hp.defaultColor), brandColor: '#2457d6' },
    width: 1600,
    height: 1200,
  });
  return jobs;
};

window.renderPoster = async (input, width, height) => {
  host.style.width = `${width}px`;
  host.style.height = `${height}px`;
  viewer.resize();
  viewer.setScene(input);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const img = viewer.renderToImageData(width, height);
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  out.getContext('2d')!.putImageData(img, 0, 0);
  return out.toDataURL('image/png');
};
window.posterReady = true;
