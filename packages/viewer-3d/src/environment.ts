import {
  CubeUVReflectionMapping,
  DataTexture,
  LinearFilter,
  LinearSRGBColorSpace,
  PMREMGenerator,
  RGBFormat,
  type Texture,
  UnsignedInt5999Type,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Room lighting (image-based) for the editor and the simulator, baked once by
 * scripts/bake-room-env.mjs instead of `PMREMGenerator.fromScene(new RoomEnvironment(), 0.04)` on
 * every open. The runtime bake rendered and blurred the room with several shaders: ~350 ms frozen
 * on a machine's first editor open (GPU pipeline compiles) and ~30 ms on every later open. The
 * file holds the same CubeUV texture as RGB9E5 texels, which the GPU samples directly (renders
 * match the runtime bake within 2 levels). It is fetched and unpacked once per page.
 */
const FILE = new URL('../assets/room-env.bin', import.meta.url);

interface Baked {
  width: number;
  height: number;
  texels: Uint32Array;
}
let baked: Promise<Baked> | null = null;

/** Starts downloading and unpacking the baked environment; call it when a viewer is likely soon. */
export function prefetchRoomEnvironment(): Promise<Baked> {
  baked ??= (async () => {
    const buf = await (await fetch(FILE)).arrayBuffer();
    const head = new DataView(buf, 0, 12);
    const magic = String.fromCharCode(...new Uint8Array(buf, 0, 4));
    if (magic !== 'ENV1') throw new Error('room environment: unknown file format');
    const gz = new Blob([buf.slice(12)]).stream().pipeThrough(new DecompressionStream('gzip'));
    const texels = new Uint32Array(await new Response(gz).arrayBuffer());
    return { width: head.getUint32(4, true), height: head.getUint32(8, true), texels };
  })().catch((e: unknown) => {
    baked = null; // let the next viewer try again
    throw e;
  });
  return baked;
}

/**
 * The environment texture for one renderer. Falls back to baking at runtime if the file cannot be
 * loaded, so a viewer is never left without lighting.
 */
export async function roomEnvironment(
  renderer: WebGLRenderer,
): Promise<{ texture: Texture; dispose: () => void }> {
  try {
    const { width, height, texels } = await prefetchRoomEnvironment();
    const texture = new DataTexture(texels, width, height, RGBFormat, UnsignedInt5999Type);
    texture.mapping = CubeUVReflectionMapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.flipY = false;
    texture.colorSpace = LinearSRGBColorSpace;
    texture.needsUpdate = true;
    return { texture, dispose: () => texture.dispose() };
  } catch (e) {
    console.warn('room environment: baking at runtime', e);
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    room.dispose();
    return {
      texture: target.texture,
      dispose: () => {
        target.dispose();
        pmrem.dispose();
      },
    };
  }
}
