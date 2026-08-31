import { fork } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '@nestjs/common';

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
const SCRIPT_PATH = path.join(process.cwd(), 'glb-tools', 'optimize.mjs');

export interface GlbOptimizeResult {
  bytesIn: number;
  bytesOut: number;
  trisIn: number;
  trisOut: number;
  ratio: number;
  ms: number;
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
  return fs.existsSync(SCRIPT_PATH);
}

export function optimizeGlbFile(
  inputPath: string,
  outputPath: string,
  opts: GlbOptimizeOptions = {},
): Promise<GlbOptimizeResult> {
  const {
    ratio = 0.1,
    textureSize = 4096,
    timeoutMs = 20 * 60_000,
    heapMb = 4608,
  } = opts;

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(SCRIPT_PATH)) {
      reject(new Error(`optimize.mjs not found at ${SCRIPT_PATH} — run "npm --prefix server/glb-tools install"`));
      return;
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const child = fork(
      SCRIPT_PATH,
      [inputPath, outputPath, String(ratio), String(textureSize)],
      {
        execArgv: [`--max-old-space-size=${heapMb}`],
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      },
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

    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new Error(
            `optimize.mjs exited ${code}: ${(stderr.trim() || stdout.trim()).slice(-500)}`,
          ),
        );
        return;
      }
      try {
        const lastLine = stdout.trim().split('\n').pop() as string;
        resolve(JSON.parse(lastLine) as GlbOptimizeResult);
      } catch {
        reject(new Error(`optimize.mjs succeeded but output was unparseable: ${stdout.slice(0, 500)}`));
      }
    });
  });
}

export { logger as glbOptimizerLogger };
