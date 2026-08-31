#!/usr/bin/env node
/**
 * One-off: optimize every school GLB already sitting in file-server storage.
 *
 * For each `schools/<id>/3d/<name>.glb` that has not been optimized yet
 * (no `schools/<id>/3d/_source/<name>.glb` marker), this:
 *   1. runs optimize.mjs in a child process (isolated heap),
 *   2. moves the raw file to `_source/`,
 *   3. writes the optimized build in its place.
 *
 * The viewer URL is unchanged, so no DB updates are needed.
 *
 *   node reoptimize-all.mjs [--storage /var/lib/rtb/storage] [--ratio 0.1]
 *                           [--tex 4096] [--dry] [--force] [--only <schoolId>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fork } from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const STORAGE = path.resolve(
  flag('storage', process.env.RTB_STORAGE_DIR || '/var/lib/rtb/storage'),
);
const RATIO = flag('ratio', '0.1');
const TEX = flag('tex', '4096');
const DRY = has('dry');
const FORCE = has('force');
const ONLY = flag('only', null);

const OPTIMIZE = path.join(path.dirname(new URL(import.meta.url).pathname), 'optimize.mjs');
const schoolsDir = path.join(STORAGE, 'schools');

if (!fs.existsSync(schoolsDir)) {
  console.error(`No schools dir at ${schoolsDir} — pass --storage`);
  process.exit(1);
}

const runOptimize = (input, output) =>
  new Promise((resolve, reject) => {
    const child = fork(OPTIMIZE, [input, output, RATIO, TEX], {
      execArgv: ['--max-old-space-size=4608'],
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('exit', (code) =>
      code === 0
        ? resolve(JSON.parse(out.trim().split('\n').pop()))
        : reject(new Error(err.trim().slice(-400) || `exit ${code}`)),
    );
  });

const fmt = (b) => (b / 1048576).toFixed(1) + 'MB';
let done = 0;
let skipped = 0;
let failed = 0;
let savedBytes = 0;

for (const schoolId of fs.readdirSync(schoolsDir)) {
  if (ONLY && schoolId !== ONLY) continue;
  const dir = path.join(schoolsDir, schoolId, '3d');
  let entries;
  try {
    if (!fs.statSync(dir).isDirectory()) continue;
    entries = fs.readdirSync(dir);
  } catch {
    continue; // no 3d/ dir for this school
  }
  const glbs = entries.filter((f) => f.toLowerCase().endsWith('.glb'));
  const sourceDir = path.join(dir, '_source');

  for (const name of glbs) {
    const served = path.join(dir, name);
    const archived = path.join(sourceDir, name);

    if (!FORCE && fs.existsSync(archived)) {
      skipped++;
      continue;
    }

    const sizeBefore = fs.statSync(served).size;
    console.log(`\n▶ ${schoolId}/${name}  (${fmt(sizeBefore)})`);
    if (DRY) {
      done++;
      continue;
    }

    // Optimize from whichever is the true original.
    const input = fs.existsSync(archived) ? archived : served;
    const tmpOut = path.join(dir, `.opt-${Date.now()}.glb`);
    try {
      const r = await runOptimize(input, tmpOut);
      if (r.bytesOut >= r.bytesIn) {
        console.log(`  no gain (${fmt(r.bytesOut)}) — leaving raw`);
        fs.unlinkSync(tmpOut);
        skipped++;
        continue;
      }
      fs.mkdirSync(sourceDir, { recursive: true });
      if (!fs.existsSync(archived)) fs.copyFileSync(served, archived);
      fs.renameSync(tmpOut, served);
      savedBytes += r.bytesIn - r.bytesOut;
      done++;
      console.log(
        `  ✓ ${fmt(r.bytesIn)} -> ${fmt(r.bytesOut)} (${r.ratio}x, ` +
          `${r.trisIn.toLocaleString()} -> ${r.trisOut.toLocaleString()} tris, ${(r.ms / 1000).toFixed(0)}s)`,
      );
    } catch (e) {
      failed++;
      console.error(`  ✗ ${e.message}`);
      try {
        fs.unlinkSync(tmpOut);
      } catch {
        /* ignore */
      }
    }
  }
}

console.log(
  `\nDone. optimized=${done} skipped=${skipped} failed=${failed} freed=${fmt(savedBytes)}`,
);
