import { fork, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Logger } from '@nestjs/common';

/**
 * V8 old-space ceiling for the optimizer child, in MB.
 *
 * A dense photogrammetry GLB briefly needs a lot of heap, but a fixed 8 GB
 * ceiling gets the child OOM-killed instantly on a 2–4 GB box (exit code 137 /
 * null) — and then the raw model is served forever. Size it to the host: 70% of
 * total RAM, clamped to [1536, 8192]. Override with GLB_OPT_HEAP_MB.
 */
export function resolveHeapMb(): number {
  const env = Number(process.env.GLB_OPT_HEAP_MB);
  if (Number.isFinite(env) && env >= 512) return Math.floor(env);
  const totalMb = os.totalmem() / 1024 / 1024;
  return Math.max(1536, Math.min(8192, Math.floor(totalMb * 0.7)));
}

/**
 * Processing profile for one model. "Low-memory" (small heap, or an input
 * larger than 15% of RAM) limits GEOMETRY only — rough decimation and a
 * triangle cap. Textures are never shrunk for memory: web-ready atlases pass
 * through optimize.mjs untouched, and the max texture edge stays 8192.
 */
export function optimizeProfile(o: {
  heapMb: number;
  inputBytes: number;
  totalMem: number;
  ratio?: number;
  textureSize?: number;
  env?: NodeJS.ProcessEnv;
}): {
  lowMem: boolean;
  ratio: number;
  textureSize: number;
  env: Record<string, string>;
} {
  const env = o.env ?? {};
  const lowMem = o.heapMb < 3072 || o.inputBytes > o.totalMem * 0.15;
  return {
    lowMem,
    ratio: o.ratio ?? (lowMem ? 0.08 : 0.3),
    textureSize: o.textureSize ?? 8192,
    env: lowMem
      ? {
          GLB_FORCE_SLOPPY: env.GLB_FORCE_SLOPPY || '1',
          GLB_MAX_OUT_TRIS: env.GLB_MAX_OUT_TRIS || String(1_500_000),
        }
      : {},
  };
}

/**
 * Bridge to the standalone `server/glb-tools/optimize.mjs` pipeline.
 *
 * The optimizer is ESM-only (@gltf-transform) and briefly needs ~2 GB of heap
 * for a multi-hundred-MB photogrammetry GLB, so it runs as a forked child with
 * its own memory ceiling — a failure or OOM there never touches rtb-api, and
 * the raw model stays served in the meantime.
 */
const logger = new Logger('GlbOptimizer');

// pm2 runs rtb-api with cwd = <repo>/server; `nest start` in dev is the same.
const TOOLS_DIR = path.join(process.cwd(), 'glb-tools');
const SCRIPT_PATH = path.join(TOOLS_DIR, 'optimize.mjs');
const TOOLS_NODE_MODULES = path.join(
  TOOLS_DIR,
  'node_modules',
  '@gltf-transform',
);
// A nested second `sharp` (pulled by ndarray-pixels) means two libvips builds
// load into one process — the WebP texture encoder then fails mid-run with
// `webpsave: unable to encode`. package.json pins sharp to match, so its
// presence just signals the install predates that pin and needs a redo.
const DUP_SHARP = path.join(
  TOOLS_DIR,
  'node_modules',
  'ndarray-pixels',
  'node_modules',
  'sharp',
);

export interface GlbOptimizeResult {
  bytesIn: number;
  bytesOut: number;
  trisIn: number;
  trisOut: number;
  ratio: number;
  ms: number;
  /** Decimation path taken: 'exact' | 'tiled' | 'sloppy' | 'none'. */
  method?: string;
  /** True when the source held geographic vertex coordinates that were baked
   *  into a local metric frame. */
  reprojected?: boolean;
  /** WGS84 centroid of the model when it was geographically referenced, so the
   *  school's location can be synced to it. Null otherwise. */
  lat?: number | null;
  lng?: number | null;
  /** Detail of the served model (quality.mjs) and of the file as delivered. */
  quality?: Record<string, unknown> | null;
  qualityIn?: Record<string, unknown> | null;
  /** What happened to each texture: kept byte for byte, or re-encoded. */
  textures?: Array<Record<string, unknown>>;
  /** 'standard' or 'low-memory' (rough decimation, triangle cap). */
  profile?: 'standard' | 'low-memory';
}

export interface GlbOptimizeOptions {
  /** Fraction of triangles to keep (0.1 = aggressive-ish, still dense). */
  ratio?: number;
  /** Max texture edge in px. */
  textureSize?: number;
  /** Kill the child after this long. */
  timeoutMs?: number;
  /** Child V8 old-space ceiling (MB). */
  heapMb?: number;
}

export function isGlbOptimizerAvailable(): boolean {
  return fs.existsSync(SCRIPT_PATH) && fs.existsSync(TOOLS_NODE_MODULES);
}

/**
 * Self-heal: if the pipeline script is present but its deps are not (deploy
 * didn't run `npm --prefix server/glb-tools install`), install them once in the
 * background. Runs at most once per process; survives future deploys since
 * `git reset --hard` doesn't touch node_modules.
 */
let ensurePromise: Promise<boolean> | null = null;
export function ensureGlbTools(): Promise<boolean> {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    if (!fs.existsSync(SCRIPT_PATH)) return false;
    const haveDeps = fs.existsSync(TOOLS_NODE_MODULES);
    const dupSharp = fs.existsSync(DUP_SHARP);
    if (haveDeps && !dupSharp) return true;
    logger.log(
      haveDeps
        ? 'glb-tools: duplicate sharp/libvips detected — reinstalling to dedupe…'
        : 'glb-tools deps missing — running one-time npm install…',
    );
    return await new Promise<boolean>((resolve) => {
      const npm = spawn(
        'npm',
        ['install', '--omit=dev', '--no-audit', '--no-fund'],
        {
          cwd: TOOLS_DIR,
          stdio: 'ignore',
        },
      );
      npm.on('error', (e) => {
        logger.error(`glb-tools npm install failed to start: ${e.message}`);
        resolve(false);
      });
      npm.on('exit', (code) => {
        const ok = code === 0 && fs.existsSync(TOOLS_NODE_MODULES);
        if (ok && fs.existsSync(DUP_SHARP)) {
          logger.warn(
            'glb-tools: sharp is still duplicated after reinstall — WebP texture encode may fail on large models',
          );
        }
        logger[ok ? 'log' : 'error'](
          `glb-tools npm install exited ${code}${ok ? ' — optimizer ready' : ''}`,
        );
        resolve(ok);
      });
    });
  })();
  return ensurePromise;
}

export function optimizeGlbFile(
  inputPath: string,
  outputPath: string,
  opts: GlbOptimizeOptions = {},
): Promise<GlbOptimizeResult> {
  const envTimeout = Number(process.env.GLB_OPT_TIMEOUT_MS);
  const {
    timeoutMs = Number.isFinite(envTimeout) && envTimeout > 0
      ? envTimeout
      : 40 * 60_000,
    heapMb = resolveHeapMb(),
  } = opts;
  // "Memory-tight" isn't just a small heap ceiling — a huge input on a normal
  // box is the real killer: a 2 GB / ~80 M-tri photogrammetry export needs the
  // exact simplifier's WASM heap + a multi-GB gltf-transform document + the
  // WebP encoder's native buffer all at once, and OOM-kills an 8 GB box even
  // with swap. When either signal fires, take the low-memory path: single-pass
  // sloppy decimation and a hard triangle cap. Textures keep their size —
  // web-ready ones pass through without being decoded (optimizeProfile).
  let inputBytes = 0;
  try {
    inputBytes = fs.statSync(inputPath).size;
  } catch {
    /* ignore */
  }
  const {
    lowMem,
    ratio,
    textureSize,
    env: profileEnv,
  } = optimizeProfile({
    heapMb,
    inputBytes,
    totalMem: os.totalmem(),
    ratio: opts.ratio,
    textureSize: opts.textureSize,
    env: process.env,
  });
  if (lowMem) {
    logger.warn(
      `optimize: low-memory profile (heap ${heapMb}MB, input ${(
        inputBytes / 1048576
      ).toFixed(0)}MB) — sloppy decimation, ≤1.5M tris (texture kept)`,
    );
  }

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(SCRIPT_PATH)) {
      reject(
        new Error(
          `optimize.mjs not found at ${SCRIPT_PATH} — run "npm --prefix server/glb-tools install"`,
        ),
      );
      return;
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const child = fork(
      SCRIPT_PATH,
      [inputPath, outputPath, String(ratio), String(textureSize)],
      {
        execArgv: [`--max-old-space-size=${heapMb}`],
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        env: { ...process.env, ...profileEnv },
      },
    );
    logger.log(
      `optimize: heap=${heapMb}MB ratio=${ratio} timeout=${Math.round(
        timeoutMs / 60_000,
      )}min${lowMem ? ' (low-mem profile)' : ''}`,
    );

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()));

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`glb optimize timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0) {
        const oom =
          signal === 'SIGKILL' || code === 137 || code === null
            ? ` — likely OOM-killed (heap ${heapMb}MB); lower GLB_OPT_HEAP_MB / GLB_MAX_OUT_TRIS or add swap`
            : '';
        reject(
          new Error(
            `optimize.mjs exited ${code}${signal ? `/${signal}` : ''}${oom}: ${(
              stderr.trim() || stdout.trim()
            ).slice(-500)}`,
          ),
        );
        return;
      }
      try {
        const lastLine = stdout.trim().split('\n').pop() as string;
        resolve({
          ...(JSON.parse(lastLine) as GlbOptimizeResult),
          profile: lowMem ? 'low-memory' : 'standard',
        });
      } catch {
        reject(
          new Error(
            `optimize.mjs succeeded but output was unparseable: ${stdout.slice(0, 500)}`,
          ),
        );
      }
    });
  });
}

export { logger as glbOptimizerLogger };
