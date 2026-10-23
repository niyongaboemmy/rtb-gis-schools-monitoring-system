#!/usr/bin/env node
/**
 * Installs the KTX-Software `ktx` tool (Khronos, Apache-2.0) into
 * glb-tools/vendor/ktx/{bin,lib} — no root, no system package. Used by
 * ktx2.mjs to encode textures to KTX2 / UASTC (GPU-compressed).
 *
 *   node install-ktx.mjs          → installs if missing, prints the binary path
 *
 * The download is checked against a pinned SHA-256. Unsupported platforms
 * exit 0 with a message: KTX2 variants are optional, models still serve WebP.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KTX_VERSION = '4.4.2';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KTX_DIR = path.join(HERE, 'vendor', 'ktx');
export const KTX_BIN = path.join(KTX_DIR, 'bin', 'ktx');

const RELEASES = {
  'linux-x64': { file: 'Linux-x86_64.tar.bz2', sha256: 'a8781bad05f9624edbf910b7f258cd0a4ba7d3e63b49ecc0a0ab440bf6a0a245' },
  'linux-arm64': { file: 'Linux-arm64.tar.bz2', sha256: '60382e7b842177b8048bd58ccdc770383f8ef65b94452a25d3afdb55f2405c5a' },
  'darwin-arm64': { file: 'Darwin-arm64.pkg', sha256: '500bd8f9d63358c3f3a0d83b724c8574436a72c37dc0e4bad90ec1ca38032c3c' },
  'darwin-x64': { file: 'Darwin-x86_64.pkg', sha256: 'efecc685ab891a6e119a9fdc8cbe038e135f9a367eb2f5d8a059553f947f1fea' },
};

/** Environment for running the vendored binary (finds its shared library). */
export function ktxEnv(env = process.env) {
  const lib = path.join(KTX_DIR, 'lib');
  return { ...env, LD_LIBRARY_PATH: [lib, env.LD_LIBRARY_PATH].filter(Boolean).join(':') };
}

/** Path of a working `ktx`: KTX_BIN env, the vendored copy, or null. */
export function findKtx() {
  for (const bin of [process.env.KTX_BIN, KTX_BIN]) {
    if (!bin || !fs.existsSync(bin)) continue;
    try {
      execFileSync(bin, ['--version'], { env: ktxEnv(), stdio: 'pipe', timeout: 10_000 });
      return bin;
    } catch {
      /* not runnable here */
    }
  }
  return null;
}

export async function installKtx() {
  const found = findKtx();
  if (found) return found;
  const rel = RELEASES[`${os.platform()}-${os.arch()}`];
  if (!rel) {
    console.log(`ktx: no release for ${os.platform()}-${os.arch()}; KTX2 variants disabled`);
    return null;
  }
  const name = `KTX-Software-${KTX_VERSION}-${rel.file}`;
  const url = `https://github.com/KhronosGroup/KTX-Software/releases/download/v${KTX_VERSION}/${name}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ktx download failed: ${res.status} ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const sum = crypto.createHash('sha256').update(bytes).digest('hex');
  if (sum !== rel.sha256) throw new Error(`ktx download checksum mismatch for ${name}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ktx-'));
  try {
    const archive = path.join(tmp, name);
    fs.writeFileSync(archive, bytes);
    fs.rmSync(KTX_DIR, { recursive: true, force: true });
    fs.mkdirSync(path.join(KTX_DIR, 'bin'), { recursive: true });
    fs.mkdirSync(path.join(KTX_DIR, 'lib'), { recursive: true });
    let binDir;
    let libDir;
    if (rel.file.endsWith('.tar.bz2')) {
      execFileSync('tar', ['xjf', archive, '-C', tmp]);
      const root = path.join(tmp, name.replace(/\.tar\.bz2$/, ''));
      binDir = path.join(root, 'bin');
      libDir = path.join(root, 'lib');
    } else {
      // macOS installer package: unpack without installing.
      const x = path.join(tmp, 'x');
      execFileSync('pkgutil', ['--expand-full', archive, x]);
      const sub = (part) => path.join(x, `KTX-Software-${KTX_VERSION}-${rel.file.replace(/\.pkg$/, '')}-${part}.pkg`, 'Payload', 'usr', 'local');
      binDir = path.join(sub('tools'), 'bin');
      libDir = path.join(sub('library'), 'lib');
    }
    fs.copyFileSync(path.join(binDir, 'ktx'), KTX_BIN);
    fs.chmodSync(KTX_BIN, 0o755);
    for (const f of fs.readdirSync(libDir).filter((f) => /^libktx\.(so|dylib)|^libktx\.\d/.test(f))) {
      fs.cpSync(path.join(libDir, f), path.join(KTX_DIR, 'lib', f), { verbatimSymlinks: true });
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const bin = findKtx();
  if (!bin) throw new Error('ktx installed but does not run on this host');
  return bin;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  installKtx()
    .then((bin) => bin && console.log(bin))
    .catch((e) => {
      console.error(String(e.message || e));
      process.exit(1);
    });
}
