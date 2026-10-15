import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Upload validation (WS9.7): extension allow-lists, magic-byte sniffing and a
 * zip-bomb / path-traversal guard for KMZ archives. Pure helpers — no Nest
 * providers — so they can be used from controllers, services and tests.
 */

export type FileKind =
  | 'zip'
  | 'glb'
  | 'xml'
  | 'png'
  | 'jpeg'
  | 'webp'
  | 'gif'
  | 'pdf'
  | 'heic';

/** Identifies a file from its first bytes. Returns null when unknown. */
export function detectFileKind(head: Buffer): FileKind | null {
  if (head.length >= 4) {
    // Local file header; an empty archive starts with the EOCD record.
    if (
      head[0] === 0x50 &&
      head[1] === 0x4b &&
      ((head[2] === 0x03 && head[3] === 0x04) ||
        (head[2] === 0x05 && head[3] === 0x06))
    )
      return 'zip';
    if (head.toString('ascii', 0, 4) === 'glTF') return 'glb';
    if (head.toString('ascii', 0, 4) === '%PDF') return 'pdf';
    if (head.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  }
  if (
    head.length >= 8 &&
    head
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'png';
  if (
    head.length >= 3 &&
    head[0] === 0xff &&
    head[1] === 0xd8 &&
    head[2] === 0xff
  )
    return 'jpeg';
  if (
    head.length >= 12 &&
    head.toString('ascii', 0, 4) === 'RIFF' &&
    head.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  if (head.length >= 12 && head.toString('ascii', 4, 8) === 'ftyp') {
    const brand = head.toString('ascii', 8, 12);
    if (/^(heic|heix|hevc|hevx|mif1|msf1|heim|heis)$/.test(brand))
      return 'heic';
  }
  if (looksLikeXml(head)) return 'xml';
  return null;
}

/** KML/XML: optional UTF-8 BOM and whitespace, then `<`. Rejects binary. */
function looksLikeXml(head: Buffer): boolean {
  let text = head.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  text = text.replace(/^\s+/, '');
  if (!text.startsWith('<')) return false;
  // Control bytes other than tab/CR/LF mean this is not a text document.
  // eslint-disable-next-line no-control-regex
  return !/[\x00-\x08\x0e-\x1f]/.test(text);
}

/** Expected kinds per extension. */
const EXTENSION_KINDS: Record<string, FileKind[]> = {
  '.kmz': ['zip'],
  '.kml': ['xml'],
  '.glb': ['glb'],
  '.png': ['png'],
  '.jpg': ['jpeg'],
  '.jpeg': ['jpeg'],
  '.webp': ['webp'],
  '.gif': ['gif'],
  '.pdf': ['pdf'],
  '.heic': ['heic'],
  '.xlsx': ['zip'],
};

export const UPLOAD_EXTENSIONS = {
  geospatial: ['.kmz', '.kml'],
  model: ['.glb'],
  overlay: ['.kmz', '.kml'],
  reportAttachment: ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.pdf'],
  spreadsheet: ['.xlsx'],
} as const;

export function extensionOf(name: string): string {
  return path.extname(name || '').toLowerCase();
}

/** Reads the first `bytes` of a file on disk. */
export function readFileHead(filePath: string, bytes = 64): Buffer {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Multer `fileFilter` enforcing an extension allow-list before any bytes are
 * written. Magic bytes are checked after the upload with `assertUploadedFile`.
 */
export function extensionFileFilter(allowed: readonly string[]) {
  return (
    _req: unknown,
    file: { originalname: string },
    cb: (error: Error | null, accept: boolean) => void,
  ) => {
    const ext = extensionOf(file.originalname);
    if (!allowed.includes(ext))
      return cb(
        new BadRequestException(
          `Unsupported file type "${ext || 'none'}". Allowed: ${allowed.join(', ')}`,
        ),
        false,
      );
    // Names are only used for the extension; reject traversal-looking ones
    // anyway so they never reach a log line or a storage key unchecked.
    if (/[\\/]|\0/.test(file.originalname) || file.originalname.length > 255)
      return cb(new BadRequestException('Invalid file name'), false);
    cb(null, true);
  };
}

/**
 * Checks an uploaded file's extension is allowed and its content matches it.
 * Accepts a multer file stored on disk (`path`) or in memory (`buffer`).
 */
export function assertUploadedFile(
  file:
    | { originalname: string; path?: string; buffer?: Buffer }
    | undefined
    | null,
  allowed: readonly string[],
): FileKind {
  if (!file) throw new BadRequestException('No file uploaded');
  const ext = extensionOf(file.originalname);
  if (!allowed.includes(ext))
    throw new BadRequestException(
      `Unsupported file type "${ext || 'none'}". Allowed: ${allowed.join(', ')}`,
    );
  const head = file.buffer
    ? file.buffer.subarray(0, 64)
    : file.path
      ? readFileHead(file.path)
      : Buffer.alloc(0);
  const kind = detectFileKind(head);
  const expected = EXTENSION_KINDS[ext] ?? [];
  if (!kind || !expected.includes(kind))
    throw new BadRequestException(
      `The file content does not match its "${ext}" extension.`,
    );
  return kind;
}

// ─── ZIP / KMZ ────────────────────────────────────────────────────────────

export interface ZipLimits {
  maxEntries: number;
  maxTotalUncompressed: number;
  /** Max uncompressed/compressed ratio for one entry (zip-bomb heuristic). */
  maxRatio: number;
}

const GB = 1024 * 1024 * 1024;

/** Limits for KMZ archives, overridable by env. */
export function kmzZipLimits(env: NodeJS.ProcessEnv = process.env): ZipLimits {
  const num = (key: string, fallback: number) => {
    const v = Number(env[key]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return {
    maxEntries: num('KMZ_MAX_ENTRIES', 10_000),
    maxTotalUncompressed: num('KMZ_MAX_UNCOMPRESSED_BYTES', 8 * GB),
    maxRatio: num('KMZ_MAX_COMPRESSION_RATIO', 1000),
  };
}

export interface ZipEntryInfo {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  isDirectory: boolean;
}

/**
 * True when an archive entry name is safe to use as a relative storage path:
 * no absolute paths, drive letters, backslashes, NUL bytes or `..` segments.
 */
export function isSafeEntryName(name: string): boolean {
  if (!name || name.length > 1024) return false;
  if (name.includes('\0') || name.includes('\\')) return false;
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) return false;
  return !name.split('/').some((seg) => seg === '..');
}

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64_LOCATOR = 0x07064b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_CENTRAL = 0x02014b50;

/**
 * Lists entries from the ZIP central directory without decompressing
 * anything. Throws BadRequestException on a malformed archive.
 */
export function readZipEntries(buf: Buffer): ZipEntryInfo[] {
  const bad = (why: string) =>
    new BadRequestException(`Invalid KMZ/ZIP archive (${why}).`);

  // EOCD is in the last 22 + 65535 (max comment) bytes.
  const minPos = Math.max(0, buf.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw bad('no end-of-central-directory record');

  let total = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);

  if (total === 0xffff || cdOffset === 0xffffffff) {
    const loc = eocd - 20;
    if (loc < 0 || buf.readUInt32LE(loc) !== SIG_EOCD64_LOCATOR)
      throw bad('missing ZIP64 locator');
    const eocd64 = Number(buf.readBigUInt64LE(loc + 8));
    if (eocd64 + 56 > buf.length || buf.readUInt32LE(eocd64) !== SIG_EOCD64)
      throw bad('bad ZIP64 record');
    total = Number(buf.readBigUInt64LE(eocd64 + 32));
    cdOffset = Number(buf.readBigUInt64LE(eocd64 + 48));
  }

  const entries: ZipEntryInfo[] = [];
  let pos = cdOffset;
  for (let n = 0; n < total; n++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== SIG_CENTRAL)
      throw bad('corrupt central directory');
    let compressed = buf.readUInt32LE(pos + 20);
    let uncompressed = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);

    // ZIP64 extended sizes live in extra field 0x0001, in a fixed order and
    // only for the fields saturated in the fixed header.
    if (uncompressed === 0xffffffff || compressed === 0xffffffff) {
      let e = pos + 46 + nameLen;
      const end = e + extraLen;
      while (e + 4 <= end) {
        const id = buf.readUInt16LE(e);
        const size = buf.readUInt16LE(e + 2);
        if (id === 0x0001) {
          let p = e + 4;
          if (uncompressed === 0xffffffff && p + 8 <= e + 4 + size) {
            uncompressed = Number(buf.readBigUInt64LE(p));
            p += 8;
          }
          if (compressed === 0xffffffff && p + 8 <= e + 4 + size)
            compressed = Number(buf.readBigUInt64LE(p));
          break;
        }
        e += 4 + size;
      }
    }

    entries.push({
      name,
      compressedSize: compressed,
      uncompressedSize: uncompressed,
      isDirectory: name.endsWith('/'),
    });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Rejects an archive that is too large when expanded, has too many entries,
 * contains a path-traversal name or an entry with a bomb-like compression
 * ratio. Returns the entry list on success.
 */
export function assertSafeZip(
  buf: Buffer,
  limits: ZipLimits = kmzZipLimits(),
): ZipEntryInfo[] {
  const entries = readZipEntries(buf);
  if (entries.length > limits.maxEntries)
    throw new BadRequestException(
      `Archive has ${entries.length} entries; the limit is ${limits.maxEntries}.`,
    );

  let total = 0;
  for (const entry of entries) {
    if (!isSafeEntryName(entry.name))
      throw new BadRequestException(
        `Archive contains an unsafe path: "${entry.name.slice(0, 120)}".`,
      );
    total += entry.uncompressedSize;
    // Small entries compress absurdly well (blank textures, padding), so the
    // ratio test only applies once an entry is big enough to matter.
    if (
      entry.uncompressedSize > 10 * 1024 * 1024 &&
      entry.uncompressedSize > entry.compressedSize * limits.maxRatio
    )
      throw new BadRequestException(
        `Archive entry "${entry.name.slice(0, 120)}" has a suspicious compression ratio.`,
      );
  }
  if (total > limits.maxTotalUncompressed)
    throw new BadRequestException(
      `Archive expands to ${formatBytes(total)}; the limit is ${formatBytes(limits.maxTotalUncompressed)}.`,
    );
  return entries;
}

/**
 * Running total of bytes actually extracted. Central-directory sizes can lie,
 * so extraction code calls `add()` with every decompressed entry too.
 */
export class ExtractionBudget {
  private used = 0;
  private count = 0;

  constructor(private readonly limits: ZipLimits = kmzZipLimits()) {}

  /** Throws once the real extracted size or entry count exceeds the limits. */
  add(entryName: string, bytes: number): void {
    if (!isSafeEntryName(entryName))
      throw new BadRequestException(
        `Archive contains an unsafe path: "${entryName.slice(0, 120)}".`,
      );
    this.used += bytes;
    this.count += 1;
    if (this.count > this.limits.maxEntries)
      throw new BadRequestException('Archive has too many entries.');
    if (this.used > this.limits.maxTotalUncompressed)
      throw new BadRequestException(
        `Archive expands beyond ${formatBytes(this.limits.maxTotalUncompressed)}.`,
      );
  }

  get bytes() {
    return this.used;
  }
}

function formatBytes(n: number): string {
  if (n >= GB) return `${(n / GB).toFixed(1)} GB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Pre-uploaded file URLs ──────────────────────────────────────────────

/**
 * The "from-url" upload flow makes the API download a file the browser put
 * on the file-server. Accept only file-server paths (`/files/...`) on our own
 * origins, so the endpoint cannot be used to make the server fetch arbitrary
 * internal or external URLs (SSRF).
 */
export function assertTrustedFileUrl(
  fileUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const reject = () =>
    new BadRequestException(
      'fileUrl must point at the RTB file server (/files/...).',
    );
  const raw = (fileUrl ?? '').trim();
  let pathname: string;

  if (/^https?:\/\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw reject();
    }
    if (url.username || url.password) throw reject();
    const allowed = new Set<string>();
    for (const value of [
      env.FILE_SERVER_BASE_URL || 'http://localhost:3002',
      env.APP_PUBLIC_URL,
      ...(env.APP_CORS_ORIGINS || 'http://localhost:5173').split(','),
    ]) {
      try {
        if (value?.trim())
          allowed.add(new URL(value.trim()).host.toLowerCase());
      } catch {
        /* ignore malformed entries */
      }
    }
    if (!allowed.has(url.host.toLowerCase())) throw reject();
    pathname = decodeURIComponent(url.pathname);
  } else {
    if (raw.startsWith('//')) throw reject();
    pathname = decodeURIComponent(raw.split('?')[0]);
  }

  const normalised = '/' + pathname.replace(/^\/+/, '');
  if (
    !normalised.startsWith('/files/') ||
    normalised.split('/').includes('..') ||
    normalised.includes('\\')
  )
    throw reject();
}
