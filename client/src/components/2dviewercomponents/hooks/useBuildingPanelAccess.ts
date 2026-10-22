import { useCallback } from "react";
import { useAuthorization } from "../../../hooks/useAuthorization";
import { Permission } from "../../../lib/permissions";
import type { ReviewReport } from "../../report-review/review-utils";

/** What the user may do in the building panel (2D and 3D viewers). */
export function useBuildingPanelAccess() {
  const { hasPermission } = useAuthorization();
  const canEditBuildings = hasPermission(Permission.EDIT_SCHOOL_BUILDINGS) || hasPermission(Permission.MANAGE_SCHOOLS);
  const canCreateReport = hasPermission(Permission.CREATE_REPORT);
  const canManageReports = hasPermission(Permission.MANAGE_REPORTS);
  const canEditLocation = hasPermission(Permission.EDIT_SCHOOL_LOCATION);
  // Same rule as PATCH /reports/:id/status: managers decide any report; GIS
  // analysts (EDIT_SCHOOL_LOCATION) close the change requests routed to them.
  const canDecide = useCallback(
    (r: ReviewReport) => canManageReports || (r.type === "data_change_request" && canEditLocation),
    [canManageReports, canEditLocation],
  );
  // Matches the /reports/validate route guard.
  const canOpenReview = hasPermission(Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD) || canEditLocation;
  return { canEditBuildings, canCreateReport, canDecide, canOpenReview };
}
