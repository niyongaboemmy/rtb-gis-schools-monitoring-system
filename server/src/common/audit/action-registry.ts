import type { AuditSpec } from './audit.decorator';

/**
 * Central ACTION REGISTRY (WS11.2) keyed by `ControllerClass.handlerName`.
 *
 * Lookup order for a request: `@Audit()` decorator → this registry → fallback
 * `${METHOD} ${routePath}`. Keep it in sync when controllers gain handlers; an
 * unregistered mutating handler is still audited, just with the fallback name.
 *
 * Action codes are dotted `<resource>.<verb>`; the client maps them to
 * plain-English labels in `client/src/components/audit/auditLabels.ts`.
 */
const SCHOOL = { target: 'school', idParam: 'id', labelFrom: ['name'] };
const SCHOOL_BY_SCHOOL_ID = {
  target: 'school',
  idParam: 'schoolId',
  labelFrom: ['name', 'schoolName'],
};
const BUILDING = {
  target: 'building',
  idParam: 'id',
  labelFrom: ['name', 'buildingName'],
};
const USER: Omit<AuditSpec, 'action'> = {
  target: 'user',
  idParam: 'id',
  labelFrom: ['email'],
  subject: { param: 'id' },
};

/** Only the first page of a listing counts as a "view" (not every "Load more"). */
const firstPageOnly = (req: any): boolean => {
  const q = req?.query ?? {};
  return !q.cursor && (!q.offset || Number(q.offset) === 0);
};

export const AUDIT_ACTION_REGISTRY: Record<string, AuditSpec> = {
  // ── Schools ────────────────────────────────────────────────────────────
  'SchoolsController.create': {
    action: 'school.create',
    target: 'school',
    idFromResponse: 'id',
    labelFrom: ['name'],
  },
  'SchoolsController.update': { action: 'school.update', ...SCHOOL },
  'SchoolsController.remove': { action: 'school.delete', ...SCHOOL },
  'SchoolsController.requestChange': {
    action: 'school.change_request',
    ...SCHOOL,
  },
  'SchoolsController.initializeSurvey': {
    action: 'school.survey_initialize',
    ...SCHOOL,
  },
  'SchoolsController.bulkUpdateSurvey': {
    action: 'school.survey_update',
    ...SCHOOL,
  },
  'SchoolsController.updateSurveyItem': {
    action: 'school.survey_item_update',
    target: 'survey',
    idParam: 'surveyId',
  },
  'SchoolsController.addBuilding': {
    action: 'building.create',
    target: 'building',
    idFromResponse: 'id',
    labelFrom: ['name', 'buildingName'],
  },
  'SchoolsController.updateBuilding': {
    action: 'building.update',
    ...BUILDING,
  },
  'SchoolsController.removeBuilding': {
    action: 'building.delete',
    ...BUILDING,
  },
  'SchoolsController.exportExcel': {
    action: 'school.export',
    target: 'school',
    auditReads: true,
  },

  // ── KMZ / GLB / 2D overlays ────────────────────────────────────────────
  'KmzController.uploadGlbModel': {
    action: 'kmz.upload_model',
    ...SCHOOL_BY_SCHOOL_ID,
  },
  'KmzController.uploadGlbFromUrl': {
    action: 'kmz.upload_model_url',
    ...SCHOOL_BY_SCHOOL_ID,
  },
  'KmzController.reoptimizeGlb': {
    action: 'kmz.reoptimize',
    ...SCHOOL_BY_SCHOOL_ID,
  },
  'KmzController.rebuildKmz2dPyramid': {
    action: 'kmz.rebuild_pyramid',
    ...SCHOOL_BY_SCHOOL_ID,
  },
  'KmzController.rebuildKmz2dTiles': {
    action: 'kmz.rebuild_tiles',
    ...SCHOOL_BY_SCHOOL_ID,
  },
  'KmzController.uploadKmz2d': {
    action: 'kmz.upload_2d',
    ...SCHOOL_BY_SCHOOL_ID,
  },
  'KmzController.uploadKmz2dFromUrl': {
    action: 'kmz.upload_2d_url',
    ...SCHOOL_BY_SCHOOL_ID,
  },
  'KmzController.uploadPlacesOverlay': {
    action: 'kmz.upload_places_overlay',
    ...SCHOOL_BY_SCHOOL_ID,
  },
  'KmzController.addOverlay': {
    action: 'kmz.overlay_add',
    ...SCHOOL_BY_SCHOOL_ID,
  },
  'KmzController.removeOverlay': {
    action: 'kmz.overlay_remove',
    ...SCHOOL_BY_SCHOOL_ID,
  },
  'KmzController.addSiteAnnotation': {
    action: 'site_annotation.create',
    ...SCHOOL_BY_SCHOOL_ID,
  },
  'KmzController.removeSiteAnnotation': {
    action: 'site_annotation.delete',
    ...SCHOOL_BY_SCHOOL_ID,
  },
  'GlbAdminController.reoptimizeAll': {
    action: 'kmz.reoptimize_all',
    target: 'system',
  },

  // ── 3D viewer / site features ──────────────────────────────────────────
  'SiteFeaturesController.putViewerState': {
    action: 'viewer_state.update',
    target: 'school',
    idParam: 'schoolId',
  },
  'SiteFeaturesController.create': {
    action: 'site_feature.create',
    target: 'site_feature',
    idFromResponse: 'id',
    labelFrom: ['label'],
  },
  'SiteFeaturesController.update': {
    action: 'site_feature.update',
    target: 'site_feature',
    idParam: 'id',
    labelFrom: ['label'],
  },
  'SiteFeaturesController.remove': {
    action: 'site_feature.delete',
    target: 'site_feature',
    idParam: 'id',
  },

  // ── Users ──────────────────────────────────────────────────────────────
  'UsersController.findAll': {
    action: 'user.list_view',
    target: 'user',
    auditReads: true,
    readWhen: firstPageOnly,
  },
  'UsersController.findOne': { action: 'user.view', ...USER, auditReads: true },
  'UsersController.create': {
    action: 'user.create',
    target: 'user',
    idFromResponse: 'id',
    labelFrom: ['email'],
    subject: { response: 'id' },
  },
  'UsersController.update': { action: 'user.update', ...USER },
  'UsersController.deactivate': { action: 'user.deactivate', ...USER },
  'UsersController.uploadUsers': { action: 'user.bulk_create', target: 'user' },
  'UsersController.createBulkJson': {
    action: 'user.bulk_create',
    target: 'user',
  },
  'UsersController.updateProfile': {
    action: 'user.profile_update',
    target: 'user',
    subject: 'actor',
    labelFrom: ['email'],
  },
  'UsersController.changePassword': {
    action: 'user.password_change',
    target: 'user',
    subject: 'actor',
  },

  // ── Roles & access levels ──────────────────────────────────────────────
  'RolesController.create': {
    action: 'role.create',
    target: 'role',
    idFromResponse: 'id',
    labelFrom: ['name'],
  },
  'RolesController.update': {
    action: 'role.update',
    target: 'role',
    idParam: 'id',
    labelFrom: ['name'],
  },
  'RolesController.remove': {
    action: 'role.delete',
    target: 'role',
    idParam: 'id',
  },
  'AccessLevelsController.create': {
    action: 'access_level.create',
    target: 'access_level',
    idFromResponse: 'id',
    labelFrom: ['name'],
  },
  'AccessLevelsController.update': {
    action: 'access_level.update',
    target: 'access_level',
    idParam: 'id',
    labelFrom: ['name'],
  },
  'AccessLevelsController.remove': {
    action: 'access_level.delete',
    target: 'access_level',
    idParam: 'id',
  },

  // ── Issue reports ──────────────────────────────────────────────────────
  'ReportsController.create': {
    action: 'report.create',
    target: 'report',
    idFromResponse: 'id',
    labelFrom: ['title'],
  },
  'ReportsController.update': {
    action: 'report.update',
    target: 'report',
    idParam: 'id',
    labelFrom: ['title'],
  },
  'ReportsController.updateStatus': {
    action: 'report.status_change',
    target: 'report',
    idParam: 'id',
    labelFrom: ['title'],
  },
  'ReportsController.remove': {
    action: 'report.delete',
    target: 'report',
    idParam: 'id',
  },

  // ── Analytics / decisions ──────────────────────────────────────────────
  'AnalyticsController.createAction': {
    action: 'decision.action_create',
    target: 'school',
    idParam: 'schoolId',
  },
  'AnalyticsController.updateAction': {
    action: 'decision.action_update',
    target: 'decision_action',
    idParam: 'id',
  },
  'AnalyticsController.recalculate': {
    action: 'analytics.recalculate',
    target: 'system',
  },
  'AnalyticsController.recalculateOne': {
    action: 'analytics.recalculate_school',
    target: 'school',
    idParam: 'schoolId',
  },
  'AnalyticsController.exportCsv': {
    action: 'analytics.export',
    target: 'analytics',
    auditReads: true,
  },

  // ── Population ─────────────────────────────────────────────────────────
  'PopulationController.sync': { action: 'population.sync', target: 'system' },

  // ── Audit trail itself (WS11.5) ────────────────────────────────────────
  'AuditController.findAll': {
    action: 'audit.view',
    target: 'audit_log',
    auditReads: true,
    readWhen: firstPageOnly,
  },
  'AuditController.exportCsv': {
    action: 'audit.export',
    target: 'audit_log',
    auditReads: true,
  },
};

/**
 * Auth handlers audited explicitly by the auth module (Agent A) via
 * `AuditService.record()` — skipped here to avoid double rows.
 */
export const AUDIT_SKIP_HANDLERS = new Set<string>([
  'AuthController.login',
  'AuthController.googleLogin',
  'AuthController.refresh',
  'AuthController.logout',
  'AuthController.forgotPassword',
  'AuthController.verifyOtp',
  'AuthController.resetPassword',
]);

/** Any AuthController handler matching this is skipped too (2FA verify etc.). */
const AUTH_SKIP_PATTERN =
  /login|google|refresh|logout|forgot|reset|otp|2fa|twofactor|mfa|verify/i;

export function isSkippedHandler(key: string): boolean {
  if (AUDIT_SKIP_HANDLERS.has(key)) return true;
  const [cls, handler] = key.split('.');
  return cls === 'AuthController' && AUTH_SKIP_PATTERN.test(handler ?? '');
}

/** GET routes with these in the path are exports and always audited. */
export const EXPORT_PATH_RE = /export|xlsx|csv/i;

export function lookupAuditSpec(key: string): AuditSpec | undefined {
  return AUDIT_ACTION_REGISTRY[key];
}
