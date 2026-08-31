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
import GlbViewer from "./pages/GlbViewer";
import School3DView from "./components/School3DView";

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Stand-alone viewers (own full-screen chrome, still auth-gated) */}
          <Route
            path="/schools/:id/glb-viewer"
            element={
              <ProtectedRoute
                requiredPermission={Permission.SCHOOL_VIEW_2D3D_MAP}
              >
                <GlbViewer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schools/:id/3d-explorer"
            element={
              <ProtectedRoute
                requiredPermission={Permission.SCHOOL_VIEW_2D3D_MAP}
              >
                <School3DView
                  schoolId=""
                  schoolName=""
                  onClose={() => window.close()}
                />
              </ProtectedRoute>
            }
          />

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

            {/* Schools directory + records */}
            <Route
              element={
                <ProtectedRoute requiredPermission={Permission.VIEW_SCHOOLS} />
              }
            >
              <Route path="/schools" element={<SchoolsList />} />
              <Route path="/schools/:id" element={<SchoolDetail />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  requiredPermission={Permission.VIEW_INTELLIGENCE}
                />
              }
            >
              <Route
                path="/schools/:id/decision"
                element={<SchoolDecisionDashboard />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  requiredPermission={Permission.SCHOOL_VIEW_2D3D_MAP}
                />
              }
            >
              <Route path="/schools/:id/3dview" element={<School3DViewPage />} />
            </Route>

            {/* Analytics */}
            <Route
              element={
                <ProtectedRoute requiredPermission={Permission.VIEW_ANALYTICS} />
              }
            >
              <Route path="/analytics" element={<AnalyticsDecisions />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  requiredAnyPermission={[
                    Permission.VIEW_POPULATION,
                    Permission.VIEW_ANALYTICS,
                  ]}
                />
              }
            >
              <Route
                path="/analytics/population"
                element={<PopulationAnalytics />}
              />
            </Route>

            {/* Geospatial uploads */}
            <Route
              element={
                <ProtectedRoute requiredPermission={Permission.UPLOAD_KMZ} />
              }
            >
              <Route path="/schools/:id/kmz" element={<KmzUpload />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  requiredPermission={Permission.EDIT_SITE_ANNOTATIONS}
                />
              }
            >
              <Route
                path="/schools/:id/places-overlay"
                element={<PlacesOverlayUpload />}
              />
            </Route>

            {/* Field reporting */}
            <Route
              element={
                <ProtectedRoute
                  requiredAnyPermission={[
                    Permission.VIEW_REPORTING,
                    Permission.CREATE_REPORT,
                    Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD,
                  ]}
                />
              }
            >
              <Route path="/reporting" element={<SchoolReporting />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  requiredPermission={
                    Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD
                  }
                />
              }
            >
              <Route path="/reports" element={<Reports />} />
            </Route>

            {/* Administration */}
            <Route
              element={
                <ProtectedRoute
                  requiredAnyPermission={[
                    Permission.MANAGE_USERS,
                    Permission.VIEW_USERS,
                    Permission.MANAGE_ROLES,
                    Permission.VIEW_AUDIT_LOGS,
                  ]}
                />
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
