import { fork } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { resolveHeapMb } from './glb-optimizer';

/**
 * GPU-compressed (KTX2 / UASTC) variant of a served GLB — Phase 3 of
 * docs/3D_QUALITY_IMPLEMENTATION_PLAN.md. Runs `glb-tools/ktx2.mjs` as a
 * forked child, like the optimizer.
 *
 * UASTC files are ≈ 2.8× larger to download than WebP but ≈ 4× smaller in
 * GPU memory. So the variant is built only when a model's textures would not
 * fit a phone's GPU budget as WebP; today's single-4K models keep WebP only.
 */
const logger = new Logger('GlbKtx2');

const TOOLS_DIR = path.join(process.cwd(), 'glb-tools');
const KTX2_SCRIPT = path.join(TOOLS_DIR, 'ktx2.mjs');
const INSTALL_SCRIPT = path.join(TOOLS_DIR, 'install-ktx.mjs');

/** Above this much GPU texture memory as WebP (one 4096² page ≈ 85 MB), build KTX2. */
export const KTX2_WEBP_GPU_LIMIT = 96 * 1024 * 1024;

export type Ktx2Mode = 'auto' | 'always' | 'off';

export interface Ktx2Result {
  bytesIn: number;
  bytesOut: number;
  /** GPU texture memory of the variant once transcoded. */
  gpuBytes: number;
  ms: number;
  textures: Array<{
    width: number;
    height: number;
    bytesIn: number;
    bytesOut: number;
    ms: number;
  }>;
}

/** GPU bytes of uncompressed RGBA8 pages with mipmaps (how WebP/JPEG load). */
export function webpGpuBytes(
  textures: Array<{ width?: number; height?: number }>,
): number {
  return Math.round(
    textures.reduce((s, t) => s + (t.width ?? 0) * (t.height ?? 0), 0) *
      4 *
      (4 / 3),
  );
}

export function ktx2Mode(env: NodeJS.ProcessEnv = process.env): Ktx2Mode {
  const v = (env.GLB_KTX2 || 'auto').toLowerCase();
  return v === 'always' || v === 'off' ? v : 'auto';
}

/** Build a KTX2 variant for these served textures? (GLB_KTX2 = auto | always | off) */
export function shouldBuildKtx2(
  textures: Array<{ width?: number; height?: number; mime?: string }>,
  mode: Ktx2Mode = ktx2Mode(),
): boolean {
  if (mode === 'off' || !textures.length) return false;
  if (textures.every((t) => t.mime === 'image/ktx2')) return false;
  return mode === 'always' || webpGpuBytes(textures) > KTX2_WEBP_GPU_LIMIT;
}

export function runTool<T>(
  script: string,
  args: string[],
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const child = fork(script, args, {
      cwd: TOOLS_DIR,
      execArgv: [`--max-old-space-size=${resolveHeapMb()}`],
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()));
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${path.basename(script)} timed out`));
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new Error(
            `${path.basename(script)} exited ${code}${signal ? `/${signal}` : ''}: ${(stderr.trim() || stdout.trim()).slice(-500)}`,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim().split('\n').pop() as string) as T);
      } catch {
        resolve(stdout.trim() as T);
      }
    });
  });
}

let ktxReady: Promise<boolean> | null = null;

/** Install the vendored `ktx` once per process (glb-tools/install-ktx.mjs). */
export function ensureKtx(): Promise<boolean> {
  if (!ktxReady) {
    ktxReady = runTool<string>(INSTALL_SCRIPT, [], 5 * 60_000)
      .then((bin) => {
        const ok = typeof bin === 'string' && bin.length > 0;
        logger[ok ? 'log' : 'warn'](
          ok
            ? `ktx ready: ${bin}`
            : 'ktx unavailable on this host — KTX2 variants disabled',
        );
        return ok;
      })
      .catch((err: Error) => {
        logger.warn(`ktx install failed: ${err.message}`);
        ktxReady = null; // retry on the next model
        return false;
      });
  }
  return ktxReady;
}

export async function buildKtx2Variant(
  inputPath: string,
  outputPath: string,
): Promise<Ktx2Result> {
  if (!fs.existsSync(KTX2_SCRIPT)) throw new Error('ktx2.mjs not found');
  if (!(await ensureKtx())) throw new Error('ktx unavailable');
  const envTimeout = Number(process.env.GLB_OPT_TIMEOUT_MS);
  return runTool<Ktx2Result>(
    KTX2_SCRIPT,
    [inputPath, outputPath],
    Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : 40 * 60_000,
  );
}

/** Object name of the KTX2 variant beside a served GLB: `x.glb` → `x.ktx2.glb`. */
export const ktx2ObjectName = (served: string): string =>
  served.replace(/\.glb$/i, '.ktx2.glb');

/** True for a KTX2 variant file (never itself a served model). */
export const isKtx2Variant = (name: string): boolean =>
  /\.ktx2\.glb$/i.test(name);
