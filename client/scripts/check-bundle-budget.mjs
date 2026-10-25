#!/usr/bin/env node
// Bundle budget: fails when the JavaScript needed before the first screen
// (entry script + its modulepreloads in dist/index.html) grows past the
// budget, or when Cesium is injected again. Run after `vite build`.
// Usage: node scripts/check-bundle-budget.mjs [--budget-kb 400]
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const flag = process.argv.indexOf("--budget-kb");
const BUDGET_KB = flag > -1 ? Number(process.argv[flag + 1]) : 400;

if (!existsSync(join(DIST, "index.html"))) {
  console.error("✗ dist/index.html not found — run `npm run build` first.");
  process.exit(1);
}
const html = readFileSync(join(DIST, "index.html"), "utf8");
const failures = [];

if (/\/cesium\//i.test(html) || existsSync(join(DIST, "cesium"))) {
  failures.push("Cesium is back in the build (index.html or dist/cesium/).");
}

const scripts = [
  ...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g),
].map((m) => m[1]);

let total = 0;
const rows = scripts.map((src) => {
  const gz = gzipSync(readFileSync(join(DIST, src.replace(/^\//, "")))).length;
  total += gz;
  return { file: src.replace("/assets/", ""), kb: gz / 1024 };
});
rows.sort((a, b) => b.kb - a.kb);
for (const r of rows.slice(0, 6)) console.log(`  ${r.kb.toFixed(1).padStart(7)} KB  ${r.file}`);
const totalKb = total / 1024;
console.log(`Start-up JavaScript: ${totalKb.toFixed(1)} KB gzipped (budget ${BUDGET_KB} KB, ${scripts.length} files)`);

if (totalKb > BUDGET_KB) {
  failures.push(
    `Start-up JavaScript is ${totalKb.toFixed(1)} KB gzipped, over the ${BUDGET_KB} KB budget. ` +
      "A heavy library is probably imported statically from the app shell or the login page " +
      "(load it with lazyPage()/import() instead), or a codeSplitting group in vite.config.ts captured a shared module.",
  );
}

if (failures.length) {
  for (const f of failures) console.error(`✗ ${f}`);
  process.exit(1);
}
console.log("✓ Bundle budget OK");
