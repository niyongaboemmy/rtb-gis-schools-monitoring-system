/**
 * tdmp-smoke.ts
 *
 * Live check of the TDMP data API with the configured partner key: the
 * freshness probe, one full list page, the TSS / VTC split, one school detail,
 * how the rows normalise, and which pending endpoints are still refused.
 * Prints counts and codes only — never the key, never personal data.
 *
 * READ-ONLY towards TDMP and does not touch the database.
 *
 * Run from /server:
 *   npx ts-node --transpile-only scripts/tdmp-smoke.ts
 * Key: TDMP_API_KEY (and optional TDMP_BASE_URL) from the environment or
 * server/.env. Exit code 0 = list + detail readable, 1 = not, 2 = no key.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { TdmpConfig } from '../src/modules/tdmp/tdmp.config';
import { TdmpApiClient } from '../src/modules/tdmp/tdmp-api.client';
import { TdmpSchoolSource } from '../src/modules/tdmp/tdmp-school.source';
import { normaliseTdmpSchool } from '../src/modules/tdmp/tdmp-school.normalise';
import type { TdmpSchool } from '../src/modules/tdmp/tdmp.types';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const file = path.join(__dirname, '..', '.env');
  if (fs.existsSync(file))
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  return { ...env, ...(process.env as Record<string, string>) };
}

async function main(): Promise<number> {
  const config = new TdmpConfig(new ConfigService(loadEnv()));
  if (!config.apiKey) {
    console.error('TDMP_API_KEY is not set (environment or server/.env).');
    return 2;
  }
  const api = new TdmpApiClient(config);
  const source = new TdmpSchoolSource(config, api);
  console.log(
    `TDMP: ${config.baseUrl}  filter: ${new URLSearchParams(config.schoolFilter)}`,
  );

  const t0 = Date.now();
  const meta = await source.probe();
  console.log(
    `probe     ok  ${Date.now() - t0} ms  total=${meta.page?.total}  lastMaterialisedAt=${meta.lastMaterialisedAt}`,
  );

  const page = await api.page<TdmpSchool>('/schools', {
    ...config.schoolFilter,
    page: 1,
    limit: config.pageSize,
  });
  const rows = page.data ?? [];
  const results = rows.map((r) => normaliseTdmpSchool(r, config.ignoreSources));
  const skipped = results.filter((r) => !r.ok);
  console.log(
    `page 1    ok  rows=${rows.length}  usable=${rows.length - skipped.length}  skipped=${skipped.length}`,
  );
  for (const s of skipped.slice(0, 5))
    if (!s.ok) console.log(`          skip ${s.code ?? '—'}: ${s.reason}`);

  const bands = await source.bands();
  const tss = [...bands.values()].filter((b) => b === 'TSS').length;
  console.log(
    `bands     ok  TSS=${tss}  VTC=${bands.size - tss}  neither=${(meta.page?.total ?? 0) - bands.size}`,
  );

  const first = results.find((r) => r.ok);
  if (!first?.ok) {
    console.error('No usable school on page 1.');
    return 1;
  }
  const detail = await source.school(first.school.schoolCode);
  console.log(
    `detail    ${detail ? 'ok' : 'MISSING'}  ${first.school.schoolCode}  established=${detail?.establishmentDate ?? '—'}  gps=${detail?.gpsLat != null ? 'yes' : 'no'}`,
  );

  console.log('pending endpoints (403 = TDMP has not granted it yet):');
  for (const [p, req] of [
    ['/reports/trades/students', 'R1'],
    ['/reports/teachers/summary', 'R1'],
    ['/trades', 'R1'],
    ['/performance/summary', 'R11'],
  ] as const) {
    const r = await api.check(p);
    console.log(`          ${String(r.status).padEnd(4)}${p}  (${req})`);
  }
  return detail ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`TDMP smoke failed: ${(err as Error).message}`);
    process.exit(1);
  });
