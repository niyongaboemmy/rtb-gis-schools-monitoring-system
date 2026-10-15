import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  DataSource,
  EntitySubscriberInterface,
  UpdateEvent,
} from 'typeorm';
import { getAuditContext } from './request-context';
import { REDACTED, SENSITIVE_DIFF_FIELD_RE, toJsonSafe } from './sanitize';

/** Entities whose updates get field-level diffs (WS11.4), by metadata name. */
export const DIFF_ENTITIES = new Set([
  'School',
  'SchoolBuilding',
  'User',
  'Role',
  'IssueReport',
]);

/** Minimal column shape (TypeORM ColumnMetadata satisfies it). */
export interface DiffColumn {
  propertyName: string;
  isCreateDate?: boolean;
  isUpdateDate?: boolean;
  isVersion?: boolean;
  relationMetadata?: unknown;
  getEntityValue(entity: any): unknown;
}

function comparable(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  try {
    return JSON.stringify(v ?? null) ?? 'null';
  } catch {
    return String(v);
  }
}

/**
 * Field-level diff between the stored and the saved entity. Sensitive fields
 * are reported as changed but with masked values; huge values (geometry) are
 * summarised by toJsonSafe.
 */
export function computeEntityDiff(
  columns: DiffColumn[],
  before: Record<string, unknown> | undefined | null,
  after: Record<string, unknown> | undefined | null,
): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  if (!before || !after) return out;
  for (const col of columns) {
    if (col.isCreateDate || col.isUpdateDate || col.isVersion) continue;
    const next = col.getEntityValue(after);
    if (next === undefined) continue; // not part of this save
    const prev = col.getEntityValue(before);
    if (comparable(prev) === comparable(next)) continue;
    const field = col.relationMetadata
      ? `${col.propertyName}Id`
      : col.propertyName;
    out[field] = SENSITIVE_DIFF_FIELD_RE.test(col.propertyName)
      ? [REDACTED, REDACTED]
      : [toJsonSafe(prev ?? null), toJsonSafe(next)];
  }
  return out;
}

/**
 * Stashes `changes` for key entities into the current request's audit
 * context; the request's audit row then carries them.
 *
 * LIMITATION: only `save()` paths fire `beforeUpdate` with `databaseEntity`.
 * `repository.update()` / query-builder updates bypass subscribers (and
 * `databaseEntity` is undefined for them), so those writes are audited by the
 * request row without a field diff — e.g. `UsersService.deactivate`. Upload
 * routes using multer may also lose the AsyncLocalStorage context.
 */
@Injectable()
export class AuditDiffSubscriber implements EntitySubscriberInterface {
  constructor(@InjectDataSource() dataSource: DataSource) {
    if (!dataSource.subscribers.includes(this))
      dataSource.subscribers.push(this);
  }

  beforeUpdate(event: UpdateEvent<any>): void {
    try {
      const ctx = getAuditContext();
      if (!ctx || !event.metadata || !DIFF_ENTITIES.has(event.metadata.name))
        return;
      const entity = event.entity as Record<string, unknown> | undefined;
      const columns: DiffColumn[] = event.metadata
        .columns as unknown as DiffColumn[];
      const fields = computeEntityDiff(
        columns,
        event.databaseEntity as Record<string, unknown> | undefined,
        entity,
      );
      if (Object.keys(fields).length === 0) return;
      const id = (entity?.id ?? event.databaseEntity?.id) as string | undefined;
      ctx.changes.push({ entity: event.metadata.name, id, fields });
    } catch {
      /* diffs are best-effort; never break the write */
    }
  }
}
