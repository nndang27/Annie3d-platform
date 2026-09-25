import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  BOARD_FILE_MAX_MANIFEST,
  centralDirectory,
  crc32,
  entryDataOffset,
  localHeader,
  readBytes,
  readManifestText,
  readZipIndex,
  type WrittenEntry,
  ZipError,
} from './zip';

interface Part {
  name: string;
  data: Uint8Array;
  deflate?: boolean;
  /** Lie in the headers about the uncompressed size. */
  claimSize?: number;
}

/** A ZIP written with this module's writer (optionally deflating an entry, or lying about it). */
function zip(parts: Part[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const entries: WrittenEntry[] = [];
  let offset = 0;
  for (const p of parts) {
    const body = p.deflate ? new Uint8Array(deflateRawSync(p.data)) : p.data;
    const e = {
      name: p.name,
      method: (p.deflate ? 8 : 0) as 0 | 8,
      crc32: crc32(p.data),
      compressedSize: body.length,
      size: p.claimSize ?? p.data.length,
    };
    const h = localHeader(e);
    entries.push({ ...e, headerOffset: offset });
    chunks.push(h, body);
    offset += h.length + body.length;
  }
  chunks.push(centralDirectory(entries, offset));
  const out = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

const inflate = (d: Uint8Array, size: number) => new Uint8Array(inflateRawSync(d, { maxOutputLength: size }));
const manifest = new TextEncoder().encode(JSON.stringify({ format: 'annie3d', version: 2 }));
const open = (b: Uint8Array) => readZipIndex(readBytes(b), b.length);

describe('board file zip', () => {
  it('reads the manifest and stored assets by range', async () => {
    const photo = crypto.getRandomValues(new Uint8Array(5000));
    const b = zip([
      { name: 'annie3d.json', data: manifest, deflate: true },
      { name: 'assets/photo.png', data: photo },
    ]);
    const entries = await open(b);
    expect(await readManifestText(readBytes(b), entries, inflate)).toContain('annie3d');
    const e = entries.get('assets/photo.png')!;
    const at = await entryDataOffset(readBytes(b), e);
    expect(b.subarray(at, at + e.size)).toEqual(photo);
  });

  it('refuses a deflated asset (the classic zip bomb: tiny on disk, huge in memory)', async () => {
    const zeros = new Uint8Array(10 * 1024 * 1024); // 10 MB of zeros deflate to ~10 KB
    const b = zip([
      { name: 'annie3d.json', data: manifest },
      { name: 'assets/bomb.bin', data: zeros, deflate: true },
    ]);
    expect(b.length).toBeLessThan(64 * 1024);
    await expect(open(b)).rejects.toThrow(/compressed/);
  });

  it('refuses a manifest that claims more than the limit, or expands beyond its claim', async () => {
    const big = zip([
      { name: 'annie3d.json', data: manifest, deflate: true, claimSize: BOARD_FILE_MAX_MANIFEST + 1 },
    ]);
    await expect(open(big)).rejects.toThrow(/too large/);
    // Claims 10 bytes but inflates to 4 MB: inflating stops at the claim, the CRC catches it.
    const zeros = new Uint8Array(4 * 1024 * 1024);
    const lying = zip([{ name: 'annie3d.json', data: zeros, deflate: true, claimSize: 10 }]);
    const entries = await open(lying);
    await expect(readManifestText(readBytes(lying), entries, inflate)).rejects.toThrow();
  });

  it('refuses unexpected names, path tricks, duplicates and missing manifests', async () => {
    const one = (name: string) =>
      zip([
        { name: 'annie3d.json', data: manifest },
        { name, data: new Uint8Array(4) },
      ]);
    await expect(open(one('../../etc/passwd'))).rejects.toThrow(ZipError);
    await expect(open(one('assets/../x'))).rejects.toThrow(ZipError);
    await expect(open(one('/abs/path'))).rejects.toThrow(ZipError);
    await expect(open(one('annie3d.json'))).rejects.toThrow(/Duplicate/);
    await expect(open(zip([{ name: 'assets/a.png', data: new Uint8Array(4) }]))).rejects.toThrow(
      /Not an Annie/,
    );
    await expect(open(new TextEncoder().encode('not a zip at all, just text......'))).rejects.toThrow(
      /Not an Annie/,
    );
  });

  it('refuses entries that point outside the file', async () => {
    const b = zip([
      { name: 'annie3d.json', data: manifest },
      { name: 'assets/a.png', data: new Uint8Array(100) },
    ]);
    // Corrupt the central directory: make the asset claim 1 GB (stored, so size = compressed).
    const cd = b.length - 22 - 'Annie 3D board'.length - (46 + 'assets/a.png'.length);
    new DataView(b.buffer).setUint32(cd + 20, 1 << 30, true);
    new DataView(b.buffer).setUint32(cd + 24, 1 << 30, true);
    await expect(open(b)).rejects.toThrow(/damaged/);
  });
});
