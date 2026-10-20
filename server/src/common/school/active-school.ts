/**
 * "Active school" filter — the single definition of which school rows feed
 * analytics, scoring, dashboards, rollups, exports and the national map.
 *
 * Only `SchoolStatus.ACTIVE` counts. `inactive` (decommissioned) and
 * `under_renovation` schools are excluded from every aggregate so national
 * KPIs, averages and budget totals reflect the operating network only.
 *
 * The literal is duplicated here (rather than importing the entity enum) to
 * keep this `common/` helper free of any dependency on the schools module.
 * Keep it in sync with `SchoolStatus.ACTIVE` in
 * `modules/schools/entities/school.entity.ts`.
 */
export const ACTIVE_SCHOOL_STATUS = 'active';

/** Adds `<alias>.status = 'active'` to a School query builder. */
export function whereActiveSchool<
  T extends { andWhere: (...args: any[]) => T },
>(qb: T, alias = 'school'): T {
  return qb.andWhere(`${alias}.status = :activeSchoolStatus`, {
    activeSchoolStatus: ACTIVE_SCHOOL_STATUS,
  });
}

/** In-memory predicate for already-loaded school rows. */
export const isActiveSchool = (school: { status?: string | null }): boolean =>
  school?.status === ACTIVE_SCHOOL_STATUS;
