import { getMetadataArgsStorage } from 'typeorm';
import { School } from './entities/school.entity';

/**
 * School columns left out of list-style responses (schools list, reports,
 * decision queue). `kmz2dManifest` is the 2D tile index: ~570 KB per school
 * with drone imagery, never read by the client from a list, and fetched on
 * demand by the KMZ endpoints (which select it explicitly). Single-school
 * reads still return it.
 */
export const SCHOOL_LIST_OMIT: ReadonlySet<string> = new Set(['kmz2dManifest']);

let listColumns: string[] | null = null;

/**
 * `alias.column` selections for every School column except the heavy ones.
 * Read from the decorator metadata (not a live connection), so it is stable
 * and works with mocked query builders in unit tests.
 */
export function schoolListSelect(alias: string): string[] {
  listColumns ??= getMetadataArgsStorage()
    .columns.filter(
      (c) => c.target === School && !SCHOOL_LIST_OMIT.has(c.propertyName),
    )
    .map((c) => c.propertyName);
  return listColumns.map((p) => `${alias}.${p}`);
}
