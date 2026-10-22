/**
 * Plain-English labels for audit action codes (WS11.8). Codes come from the
 * server's action registry (server/src/common/audit/action-registry.ts) and the
 * auth module's explicit events. Unknown codes still render sensibly.
 */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Schools & buildings
  "school.create": "Created school",
  "school.update": "Updated school",
  "school.delete": "Deleted school",
  "school.change_request": "Requested a school change",
  "school.location_update": "Changed a school location",
  "school.survey_initialize": "Started facility survey",
  "school.survey_update": "Updated facility survey",
  "school.survey_item_update": "Updated a survey item",
  "school.export": "Exported schools",
  "building.create": "Added building",
  "building.update": "Updated building",
  "building.delete": "Deleted building",
  "site_annotation.create": "Added site annotation",
  "site_annotation.delete": "Removed site annotation",
  "viewer_state.update": "Saved 3D viewer state",
  "site_feature.create": "Saved a measurement or note",
  "site_feature.update": "Edited a measurement or note",
  "site_feature.delete": "Deleted a measurement or note",

  // GIS uploads
  "kmz.upload_model": "Uploaded 3D model",
  "kmz.upload_model_url": "Imported 3D model from link",
  "kmz.reoptimize": "Re-optimised 3D model",
  "kmz.reoptimize_all": "Re-optimised all 3D models",
  "kmz.upload_2d": "Uploaded 2D map (KMZ)",
  "kmz.upload_2d_url": "Imported 2D map from link",
  "kmz.upload_places_overlay": "Uploaded places overlay",
  "kmz.overlay_add": "Added map overlay",
  "kmz.overlay_remove": "Removed map overlay",

  // Users & access
  "user.create": "Created user",
  "user.update": "Updated user",
  "user.deactivate": "Deactivated user",
  "user.bulk_create": "Bulk-imported users",
  "user.profile_update": "Updated own profile",
  "user.password_change": "Changed password",
  "user.list_view": "Viewed user directory",
  "user.view": "Viewed user record",
  "role.create": "Created role",
  "role.update": "Updated role",
  "role.delete": "Deleted role",
  "access_level.create": "Created access level",
  "access_level.update": "Updated access level",
  "access_level.delete": "Deleted access level",

  // Reports & decisions
  "report.create": "Submitted issue report",
  "report.update": "Updated issue report",
  "report.status_change": "Changed report status",
  "report.delete": "Deleted issue report",
  "decision.action_create": "Planned an intervention",
  "decision.action_update": "Updated an intervention",
  "analytics.recalculate": "Recalculated all scores",
  "analytics.recalculate_school": "Recalculated school score",
  "analytics.export": "Exported analytics",
  "population.sync": "Synced population data",

  // Authentication & security
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in",
  "auth.account_locked": "Account locked",
  "auth.logout": "Signed out",
  "auth.google_login": "Signed in with Google",
  "auth.google_register": "Registered with Google",
  "auth.google_register_denied": "Google registration refused",
  "auth.google_linked": "Linked Google account",
  "auth.google_unlinked": "Unlinked Google account",
  "auth.refresh_reuse": "Reused refresh token (possible theft)",
  "auth.password_changed": "Changed password",
  "auth.password_change_failed": "Failed password change",
  "auth.password_reset": "Reset password",
  "auth.password_reset_requested": "Requested password reset",
  "auth.mfa_enabled": "Turned on two-step verification",
  "auth.mfa_disabled": "Turned off two-step verification",
  "auth.mfa_reset": "Reset two-step verification",
  "auth.2fa_reset": "Reset two-step verification",
  "auth.mfa_email_sent": "Sent sign-in code by email",
  "auth.mfa_recovery_used": "Used a recovery code",
  "auth.mfa_recovery_regenerated": "Regenerated recovery codes",
  "auth.session_revoked": "Signed out a session",
  "auth.privacy_accepted": "Accepted privacy notice",

  // Audit trail
  "audit.view": "Viewed audit trail",
  "audit.export": "Exported audit trail",
  "audit.archived": "Archived old audit records",
  "audit.integrity_failed": "Audit integrity check failed",
};

export const TARGET_TYPE_LABELS: Record<string, string> = {
  school: "School",
  building: "Building",
  survey: "Survey item",
  user: "User",
  role: "Role",
  access_level: "Access level",
  report: "Issue report",
  decision_action: "Intervention",
  analytics: "Analytics",
  audit_log: "Audit trail",
  system: "System",
};

export type AuditOutcome = "success" | "failure" | "denied";

export const OUTCOME_LABELS: Record<AuditOutcome, string> = {
  success: "Success",
  failure: "Failed",
  denied: "Denied",
};

function humanise(s: string): string {
  const spaced = s
    .replace(/[._-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : s;
}

/** "school.update" → "Updated school"; unknown codes are humanised. */
export function actionLabel(code: string | null | undefined): string {
  if (!code) return "Unknown action";
  const known = AUDIT_ACTION_LABELS[code];
  if (known) return known;
  // Fallback rows look like "PATCH /schools/:id".
  const route = /^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)$/.exec(code);
  if (route) {
    const verb = { GET: "Viewed", POST: "Created", PUT: "Saved", PATCH: "Updated", DELETE: "Deleted" }[
      route[1] as "GET"
    ];
    const resource = route[2].split("/").filter((p) => p && !p.startsWith(":")).join(" ");
    return `${verb} ${humanise(resource).toLowerCase()}`.trim();
  }
  const [resource, verb] = code.split(".");
  return verb ? `${humanise(verb)} (${humanise(resource).toLowerCase()})` : humanise(code);
}

export function targetTypeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return TARGET_TYPE_LABELS[type] ?? humanise(type);
}

export function outcomeLabel(outcome: string | null | undefined): string {
  return OUTCOME_LABELS[(outcome ?? "success") as AuditOutcome] ?? humanise(outcome ?? "");
}

/** "passwordResetToken" / "School.name" → "Password reset token" / "School › Name". */
export function fieldLabel(field: string): string {
  return field
    .split(".")
    .map((part) => humanise(part.replace(/#.*$/, "")))
    .join(" › ");
}
