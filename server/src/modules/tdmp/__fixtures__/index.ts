import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TdmpSchool } from '../tdmp.types';

/** Live TDMP rows captured on 2026-11-12 (school-level data, no personal data). */
interface TdmpFixtures {
  list: Record<
    | 'tvetActive'
    | 'tvetPrivate'
    | 'unfetched'
    | 'mixedCase'
    | 'testSource'
    | 'manualSeed'
    | 'nullActive'
    | 'inactive',
    TdmpSchool
  >;
  detail270501: TdmpSchool;
}

const fixtures = JSON.parse(
  readFileSync(join(__dirname, 'tdmp-schools.json'), 'utf8'),
) as TdmpFixtures;

export default fixtures;
