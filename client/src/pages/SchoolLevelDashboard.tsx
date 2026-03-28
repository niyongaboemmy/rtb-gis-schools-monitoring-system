import SchoolDecisionDashboard from "./SchoolDecisionDashboard";

/**
 * A dedicated page for school-level users to view their own school's dashboard.
 * It reuses the SchoolDecisionDashboard component which handles data fetching
 * based on the authenticated user's schoolId if no ID is present in the URL.
 */
export default function SchoolLevelDashboard() {
  return <SchoolDecisionDashboard />;
}
