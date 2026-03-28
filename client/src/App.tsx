import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute, AppLayout } from "./layouts/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NationalMap from "./pages/NationalMap";
import SchoolsList from "./pages/SchoolsList";
import AnalyticsDecisions from "./pages/AnalyticsDecisions";
import KmzUpload from "./pages/KmzUpload";
import PlacesOverlayUpload from "./pages/PlacesOverlayUpload";
import SchoolDetail from "./pages/SchoolDetail";
import PopulationAnalytics from "./pages/PopulationAnalytics";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Welcome from "./pages/Welcome";
import { Permission } from "./lib/permissions";
import { TooltipProvider } from "./components/ui/tooltip";
import Profile from "./pages/Profile";
import SchoolDecisionDashboard from "./pages/SchoolDecisionDashboard";
import School3DViewPage from "./pages/School3DViewPage";
import SchoolLevelDashboard from "./pages/SchoolLevelDashboard";
import SchoolReporting from "./pages/SchoolReporting";

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/welcome" element={<Welcome />} />
            
            <Route
              element={
                <ProtectedRoute requiredPermission={Permission.VIEW_DASHBOARD} />
              }
            >
              <Route path="/" element={<Dashboard />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  requiredPermission={Permission.SCHOOL_LEVEL_DASHBOARD}
                />
              }
            >
              <Route
                path="/school-dashboard"
                element={<SchoolLevelDashboard />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission={Permission.VIEW_MAP} />
              }
            >
              <Route path="/map" element={<NationalMap />} />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission={Permission.VIEW_SCHOOLS} />
              }
            >
              <Route path="/schools" element={<SchoolsList />} />
              <Route path="/schools/:id" element={<SchoolDetail />} />
              <Route path="/schools/:id/decision" element={<SchoolDecisionDashboard />} />
              <Route path="/schools/:id/3dview" element={<School3DViewPage />} />
            </Route>

            {/* Permission-protected routes */}
            <Route
              element={
                <ProtectedRoute
                  requiredPermission={Permission.VIEW_ANALYTICS}
                />
              }
            >
              <Route path="/analytics" element={<AnalyticsDecisions />} />
              <Route
                path="/analytics/population"
                element={<PopulationAnalytics />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission={Permission.UPLOAD_KMZ} />
              }
            >
              <Route path="/schools/:id/kmz" element={<KmzUpload />} />
              <Route
                path="/schools/:id/places-overlay"
                element={<PlacesOverlayUpload />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  requiredPermission={Permission.CREATE_REPORT}
                />
              }
            >
              <Route path="/reporting" element={<SchoolReporting />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  requiredPermission={Permission.EXPORT_REPORTS}
                />
              }
            >
              <Route path="/reports" element={<Reports />} />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission={Permission.MANAGE_USERS} />
              }
            >
              <Route path="/settings" element={<Settings />} />
            </Route>

            <Route path="/profile" element={<Profile />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
}
