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
    if (fs.existsSync(TOOLS_NODE_MODULES)) return true;
    logger.log('glb-tools deps missing — running one-time npm install…');
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
    textureSize = 8192, // upper bound only — a smaller source atlas is kept as-is
    timeoutMs = Number.isFinite(envTimeout) && envTimeout > 0
      ? envTimeout
      : 40 * 60_000,
    heapMb = resolveHeapMb(),
  } = opts;
  // On a memory-constrained host, keep fewer triangles so the Meshopt WASM heap
  // and the child V8 heap both stay well clear of the ceiling.
  const lowMem = heapMb < 3072;
  const { ratio = lowMem ? 0.1 : 0.3 } = opts;

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
        env: {
          ...process.env,
          ...(lowMem
            ? {
                GLB_MAX_OUT_TRIS:
                  process.env.GLB_MAX_OUT_TRIS || String(2_000_000),
              }
            : {}),
        },
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
        resolve(JSON.parse(lastLine) as GlbOptimizeResult);
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
