/**
 * ZIP for `.annie3d` board files, read by random access: only the central directory at the end
 * and the bytes actually used are read, so a 2 GB file opens without being loaded into memory
 * (the same approach as `unzip -l` and the ZIP readers of browsers' Blob.slice, R2 range reads
 * and fs file handles). Shared by the browser, the Worker and the desktop shell.
 *
 * Zip-bomb guard: assets must be stored (method 0), so their size on disk is their size; only
 * the manifest may be deflated, and it is inflated into a buffer of its declared size (at most
 * BOARD_FILE_MAX_MANIFEST), then checked against its CRC-32. Entry names, counts, bounds and the
 * total size are checked before anything is read. ZIP64, encryption and multi-disk archives are
 * refused (a board file is never any of those).
 */

export const BOARD_FILE_MANIFEST_NAME = 'annie3d.json';
/** Largest board file (all assets stored; below the 4 GiB limit of classic ZIP). */
export const BOARD_FILE_MAX_BYTES = 2 * 1024 ** 3;
/** Largest file sent in one request body (Workers accept 100 MB bodies); bigger go through R2. */
export const BOARD_FILE_DIRECT_MAX_BYTES = 80 * 1024 * 1024;
export const BOARD_FILE_MAX_MANIFEST = 8 * 1024 * 1024;
export const BOARD_FILE_MAX_ENTRIES = 5000;
const ASSET_NAME = /^assets\/[A-Za-z0-9._-]{1,120}$/;

export class ZipError extends Error {}

export interface ZipEntry {
  name: string;
  /** 0 stored, 8 deflated (the manifest only). */
  method: number;
  compressedSize: number;
  size: number;
  crc32: number;
  /** Offset of the entry's local header. */
  headerOffset: number;
}

/** Reads `length` bytes at `offset` (Blob.slice, an R2 range read, a file handle). */
export type ReadRange = (offset: number, length: number) => Promise<Uint8Array>;

const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) =>
  (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

/**
 * The entries of any ZIP, with structural checks only (end record, bounds, no ZIP64, no
 * encryption, no duplicates). `readZipIndex` adds the board file rules on top.
 */
export async function listZip(read: ReadRange, fileSize: number): Promise<ZipEntry[]> {
  if (fileSize > BOARD_FILE_MAX_BYTES) throw new ZipError('The file is larger than 2 GB');
  if (fileSize < 22) throw new ZipError('Not an Annie 3D file');
  // End of central directory: 22 bytes plus a comment of up to 65535 bytes, at the very end.
  const tailLen = Math.min(fileSize, 22 + 0xffff);
  const tail = await read(fileSize - tailLen, tailLen);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--)
    if (u32(tail, i) === 0x06054b50 && i + 22 + u16(tail, i + 20) <= tail.length) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new ZipError('Not an Annie 3D file');
  const count = u16(tail, eocd + 10);
  const cdSize = u32(tail, eocd + 12);
  const cdOffset = u32(tail, eocd + 16);
  if (u16(tail, eocd + 4) !== 0 || u16(tail, eocd + 6) !== 0 || count !== u16(tail, eocd + 8))
    throw new ZipError('Multi-part archives are not board files');
  if (count === 0xffff || cdOffset === 0xffffffff) throw new ZipError('ZIP64 archives are not board files');
  if (count > BOARD_FILE_MAX_ENTRIES) throw new ZipError('The file has too many entries');
  if (cdOffset + cdSize > fileSize - tailLen + eocd) throw new ZipError('The file is damaged');
  const cd = await read(cdOffset, cdSize);
  const out: ZipEntry[] = [];
  const names = new Set<string>();
  for (let p = 0, i = 0; i < count; i++) {
    if (p + 46 > cd.length || u32(cd, p) !== 0x02014b50) throw new ZipError('The file is damaged');
    const flags = u16(cd, p + 8);
    const nameLen = u16(cd, p + 28);
    const next = p + 46 + nameLen + u16(cd, p + 30) + u16(cd, p + 32);
    if (next > cd.length) throw new ZipError('The file is damaged');
    const e: ZipEntry = {
      name: new TextDecoder().decode(cd.subarray(p + 46, p + 46 + nameLen)),
      method: u16(cd, p + 10),
      crc32: u32(cd, p + 16),
      compressedSize: u32(cd, p + 20),
      size: u32(cd, p + 24),
      headerOffset: u32(cd, p + 42),
    };
    p = next;
    if (e.name.endsWith('/')) continue; // folder entries written by some zip tools
    if (flags & 1) throw new ZipError('Encrypted files are not board files');
    if ([e.compressedSize, e.size, e.headerOffset].includes(0xffffffff))
      throw new ZipError('ZIP64 archives are not board files');
    if (names.has(e.name)) throw new ZipError(`Duplicate entry ${e.name.slice(0, 80)}`);
    // Data must lie before the central directory (entries cannot overlap it).
    if (e.headerOffset + 30 + e.compressedSize > cdOffset) throw new ZipError('The file is damaged');
    names.add(e.name);
    out.push(e);
  }
  return out;
}

/** The entries of a board file, validated (names, methods, sizes, bounds). */
export async function readZipIndex(read: ReadRange, fileSize: number): Promise<Map<string, ZipEntry>> {
  const entries = new Map<string, ZipEntry>();
  let total = 0;
  for (const e of await listZip(read, fileSize)) {
    if (e.name === BOARD_FILE_MANIFEST_NAME) {
      if (e.method !== 0 && e.method !== 8) throw new ZipError('Unsupported compression');
      if (e.size > BOARD_FILE_MAX_MANIFEST) throw new ZipError('The board description is too large');
      if (e.method === 8 && e.size > e.compressedSize * 1100) throw new ZipError('The file is damaged');
    } else if (!ASSET_NAME.test(e.name)) {
      throw new ZipError(`Unexpected entry ${e.name.slice(0, 80)}`);
    } else if (e.method !== 0 || e.compressedSize !== e.size) {
      // Media are stored, never deflated: nothing in a board file can expand when read.
      throw new ZipError(`${e.name} is compressed; board files store media as they are`);
    }
    total += e.size;
    if (total > BOARD_FILE_MAX_BYTES) throw new ZipError('The file is larger than 2 GB');
    entries.set(e.name, e);
  }
  if (!entries.has(BOARD_FILE_MANIFEST_NAME)) throw new ZipError('Not an Annie 3D file');
  return entries;
}

/** Where an entry's data starts (after its local header, whose name/extra lengths may differ). */
export async function entryDataOffset(read: ReadRange, e: ZipEntry): Promise<number> {
  const h = await read(e.headerOffset, 30);
  if (u32(h, 0) !== 0x04034b50) throw new ZipError('The file is damaged');
  return e.headerOffset + 30 + u16(h, 26) + u16(h, 28);
}

/**
 * The manifest's text. `inflate(data, size)` must write at most `size` bytes (fflate
 * `inflateSync(d, { out })`, Node `inflateRawSync(d, { maxOutputLength })`).
 */
export async function readManifestText(
  read: ReadRange,
  entries: Map<string, ZipEntry>,
  inflate: (data: Uint8Array, size: number) => Uint8Array,
): Promise<string> {
  const e = entries.get(BOARD_FILE_MANIFEST_NAME)!;
  const data = await read(await entryDataOffset(read, e), e.compressedSize);
  const raw = e.method === 8 ? inflate(data, e.size) : data;
  if (raw.length !== e.size || crc32(raw) !== e.crc32) throw new ZipError('The file is damaged');
  return new TextDecoder().decode(raw);
}

/** A ReadRange over bytes already in memory. */
export const readBytes =
  (b: Uint8Array): ReadRange =>
  async (offset, length) => {
    if (offset < 0 || offset + length > b.length) throw new ZipError('The file is damaged');
    return b.subarray(offset, offset + length);
  };

// ------------------------------------------------------------------ writing (stored entries)

let table: Uint32Array | null = null;
/** CRC-32 (IEEE), incremental: pass the previous value to continue. */
export function crc32(data: Uint8Array, prev = 0): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = ~prev >>> 0;
  for (let i = 0; i < data.length; i++) c = table[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return ~c >>> 0;
}

export interface WrittenEntry {
  name: string;
  method: 0 | 8;
  crc32: number;
  compressedSize: number;
  size: number;
  headerOffset: number;
}

const DOS_TIME = 0; // 1980-01-01 00:00: identical content gives identical bytes

/** Local file header of an entry (the data follows it). UTF-8 names (flag bit 11). */
export function localHeader(e: Omit<WrittenEntry, 'headerOffset'>): Uint8Array {
  const name = new TextEncoder().encode(e.name);
  const b = new Uint8Array(30 + name.length);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, 0x0800, true);
  v.setUint16(8, e.method, true);
  v.setUint32(10, DOS_TIME, true);
  v.setUint32(14, e.crc32, true);
  v.setUint32(18, e.compressedSize, true);
  v.setUint32(22, e.size, true);
  v.setUint16(26, name.length, true);
  b.set(name, 30);
  return b;
}

/** Central directory and end record for the written entries, starting at `offset`. */
export function centralDirectory(
  entries: WrittenEntry[],
  offset: number,
  comment = 'Annie 3D board',
): Uint8Array {
  const enc = new TextEncoder();
  const names = entries.map((e) => enc.encode(e.name));
  const com = enc.encode(comment);
  const cdSize = names.reduce((s, n) => s + 46 + n.length, 0);
  if (offset + cdSize > 0xfffffffe || entries.length > 0xfffe)
    throw new ZipError('The file is larger than 2 GB');
  const b = new Uint8Array(cdSize + 22 + com.length);
  const v = new DataView(b.buffer);
  let p = 0;
  entries.forEach((e, i) => {
    v.setUint32(p, 0x02014b50, true);
    v.setUint16(p + 4, 20, true);
    v.setUint16(p + 6, 20, true);
    v.setUint16(p + 8, 0x0800, true);
    v.setUint16(p + 10, e.method, true);
    v.setUint32(p + 12, DOS_TIME, true);
    v.setUint32(p + 16, e.crc32, true);
    v.setUint32(p + 20, e.compressedSize, true);
    v.setUint32(p + 24, e.size, true);
    v.setUint16(p + 28, names[i]!.length, true);
    v.setUint32(p + 42, e.headerOffset, true);
    b.set(names[i]!, p + 46);
    p += 46 + names[i]!.length;
  });
  v.setUint32(p, 0x06054b50, true);
  v.setUint16(p + 8, entries.length, true);
  v.setUint16(p + 10, entries.length, true);
  v.setUint32(p + 12, cdSize, true);
  v.setUint32(p + 16, offset, true);
  v.setUint16(p + 20, com.length, true);
  b.set(com, p + 22);
  return b;
}
