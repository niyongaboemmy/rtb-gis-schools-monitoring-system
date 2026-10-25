import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
} from "react-router-dom";
import { Suspense } from "react";
import { ProtectedRoute, AppLayout } from "./layouts/AppLayout";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import { Permission } from "./lib/permissions";
import { lazyPage } from "./lib/lazy";
import { useAuthStore } from "./store/authStore";
import { homePathFor } from "./hooks/useScope";
import { TooltipProvider } from "./components/ui/tooltip";
import { ToastProvider } from "./components/ui/toast";
import { GlobalTooltips } from "./components/ui/GlobalTooltips";
import { AuthGate, SessionSplash } from "./components/auth/AuthGate";

// Every page is its own chunk: sign-in only pays for sign-in, and the 3D
// (three.js) / 2D (OpenLayers) / charts code loads with the pages that use it.
// AppLayout wraps its <Outlet> in a <Suspense>, so the shell stays put.
const Dashboard = lazyPage(() => import("./pages/Dashboard"));
const NationalMap = lazyPage(() => import("./pages/NationalMap"));
const SchoolsList = lazyPage(() => import("./pages/SchoolsList"));
const AnalyticsDecisions = lazyPage(() => import("./pages/AnalyticsDecisions"));
const KmzUpload = lazyPage(() => import("./pages/KmzUpload"));
const PlacesOverlayUpload = lazyPage(() => import("./pages/PlacesOverlayUpload"));
const PopulationAnalytics = lazyPage(() => import("./pages/PopulationAnalytics"));
const Reports = lazyPage(() => import("./pages/Reports"));
const ReportValidation = lazyPage(() => import("./pages/ReportValidation"));
const Settings = lazyPage(() => import("./pages/Settings"));
const Welcome = lazyPage(() => import("./pages/Welcome"));
const Profile = lazyPage(() => import("./pages/Profile"));
const SchoolDecisionDashboard = lazyPage(() => import("./pages/SchoolDecisionDashboard"));
const School3DViewPage = lazyPage(() => import("./pages/School3DViewPage"));
const SchoolLevelDashboard = lazyPage(() => import("./pages/SchoolLevelDashboard"));
const SchoolReporting = lazyPage(() => import("./pages/SchoolReporting"));
const School3DView = lazyPage(() => import("./components/School3DView"));

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
        {/* Stand-alone routes (3D explorer); in-layout pages use AppLayout's own Suspense. */}
        <Suspense fallback={<SessionSplash />}>
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
              <Route path="/reports/validate" element={<ReportValidation />} />
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
        </Suspense>
      </BrowserRouter>
        <GlobalTooltips />
      </ToastProvider>
    </TooltipProvider>
  );
}
