import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
} from "react-router-dom";
import { ProtectedRoute, AppLayout } from "./layouts/AppLayout";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import NationalMap from "./pages/NationalMap";
import SchoolsList from "./pages/SchoolsList";
import AnalyticsDecisions from "./pages/AnalyticsDecisions";
import KmzUpload from "./pages/KmzUpload";
import PlacesOverlayUpload from "./pages/PlacesOverlayUpload";
import PopulationAnalytics from "./pages/PopulationAnalytics";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Welcome from "./pages/Welcome";
import { Permission } from "./lib/permissions";
import { useAuthStore } from "./store/authStore";
import { homePathFor } from "./hooks/useScope";
import { TooltipProvider } from "./components/ui/tooltip";
import { ToastProvider } from "./components/ui/toast";
import Profile from "./pages/Profile";
import SchoolDecisionDashboard from "./pages/SchoolDecisionDashboard";
import School3DViewPage from "./pages/School3DViewPage";
import SchoolLevelDashboard from "./pages/SchoolLevelDashboard";
import SchoolReporting from "./pages/SchoolReporting";
import School3DView from "./components/School3DView";
import { AuthGate } from "./components/auth/AuthGate";

function HomeRoute() {
  const user = useAuthStore((st) => st.user);
  const home = homePathFor(user);
  if (home !== "/") return <Navigate to={home} replace />;
  return <Dashboard />;
}

function GlbViewerRedirect() {
  const { id } = useParams();
  const { search } = useLocation();
  return <Navigate to={`/schools/${id}/3d-explorer${search}`} replace />;
}

export default function App() {
  return (
    <TooltipProvider>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Stand-alone viewers (own full-screen chrome, still auth-gated) */}
          {/* GlbViewer was retired; old links land on the 3D explorer. */}
          <Route
            path="/schools/:id/glb-viewer"
            element={
              <ProtectedRoute
                requiredPermission={Permission.SCHOOL_VIEW_2D3D_MAP}
              >
                <GlbViewerRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schools/:id/3d-explorer"
            element={
              <ProtectedRoute
                requiredPermission={Permission.SCHOOL_VIEW_2D3D_MAP}
              >
                <AuthGate>
                  <School3DView
                    schoolId=""
                    schoolName=""
                    onClose={() => window.close()}
                  />
                </AuthGate>
              </ProtectedRoute>
            }
          />

          <Route
            element={
              <ProtectedRoute>
                <AuthGate>
                  <AppLayout />
                </AuthGate>
              </ProtectedRoute>
            }
          >
            <Route path="/welcome" element={<Welcome />} />

            {/* Role-based home (WS3.6): school leaders → their school. */}
            <Route path="/" element={<HomeRoute />} />

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
              <Route
                path="/schools/:id"
                element={<Navigate to="decision" replace />}
              />
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
                  requiredAnyPermission={[
                    Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD,
                    // GIS analysts work the change requests routed to them (WS7.7)
                    Permission.EDIT_SCHOOL_LOCATION,
                  ]}
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
      </ToastProvider>
    </TooltipProvider>
  );
}
