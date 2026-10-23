import * as fs from 'fs';
import * as path from 'path';
import { runTool } from './glb-ktx2';

/**
 * Ortho draping (glb-tools/drape.mjs): roofs and ground of a school model
 * textured from the site map's full-detail photo tiles (≈ 1 cm/px) instead of
 * the model's own texture (≈ 8 cm/px). Runs as a forked child like the
 * optimizer; never fatal — a skip or failure keeps the optimized model.
 */
const DRAPE_SCRIPT = path.join(process.cwd(), 'glb-tools', 'drape.mjs');

export interface DrapeResult {
  draped?: number;
  kept?: number;
  occluded?: number;
  pages?: Array<{ faces: number; bytes: number }>;
  cm?: number;
  zoom?: number;
  alignment?: {
    shiftEastCm: number;
    shiftSouthCm: number;
    ncc: number;
    median: number | null;
  };
  bytesOut?: number;
  /** Why nothing was draped (no output file then). */
  skipped?: string;
  ms?: number;
}

/** Texture page size (px) and detail (cm/px); GLB_DRAPE_CM overrides the detail. */
export const DRAPE_PAGE = 4096;
export const drapeCm = (env: NodeJS.ProcessEnv = process.env): number => {
  const v = Number(env.GLB_DRAPE_CM);
  return Number.isFinite(v) && v >= 0.5 && v <= 20 ? v : 2;
};

/**
 * At most this many 4096 px pages per model. Quality first: 16 keeps a whole
 * campus at 2 cm/px (Nyamirama: 11 pages, ≈ 108 MB model); only a larger site
 * steps the detail down a little. Lower it (e.g. 4 → Nyamirama 3.9 cm,
 * ≈ 60 MB) when download size matters more.
 */
export const DRAPE_MAX_PAGES_DEFAULT = 16;
export const drapeMaxPages = (env: NodeJS.ProcessEnv = process.env): number => {
  const v = Number(env.GLB_DRAPE_MAX_PAGES);
  return Number.isInteger(v) && v >= 1 && v <= 64 ? v : DRAPE_MAX_PAGES_DEFAULT;
};

/** Local folder of a tiles URL template (`…/_tiles/<build>/{z}/{x}/{y}.webp`). */
export function tilesDirFromUrl(
  url: string,
  localRoot: string | null,
): string | null {
  if (!localRoot) return null;
  const m = /\/files\/(.+?)\/\{z\}\/\{x\}\/\{y\}\.webp/.exec(url);
  return m ? path.join(localRoot, decodeURIComponent(m[1])) : null;
}

export function buildDrape(
  input: string,
  output: string,
  o: {
    lat: number;
    lng: number;
    tilesDir: string;
    tilesMaxZoom: number;
    cm?: number;
    /** The model's own texture detail (cm/px): no draping when it would not beat it. */
    modelCm?: number | null;
  },
): Promise<DrapeResult> {
  if (!fs.existsSync(DRAPE_SCRIPT))
    return Promise.resolve({ skipped: 'drape.mjs not found' });
  const envTimeout = Number(process.env.GLB_OPT_TIMEOUT_MS);
  return runTool<DrapeResult>(
    DRAPE_SCRIPT,
    [
      input,
      output,
      '--lat',
      String(o.lat),
      '--lng',
      String(o.lng),
      '--tiles',
      o.tilesDir,
      '--tiles-max-zoom',
      String(o.tilesMaxZoom),
      '--cm',
      String(o.cm ?? drapeCm()),
      '--page',
      String(DRAPE_PAGE),
      '--max-pages',
      String(drapeMaxPages()),
      ...(o.modelCm ? ['--model-cm', String(o.modelCm)] : []),
    ],
    Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : 40 * 60_000,
  );
}
