import { useState, useEffect, useRef, useMemo } from "react";
import { useAuthStore } from "../store/authStore";
import { useSchoolsStore } from "../store/schoolsStore";
import { api, apiErrorMessage, fileApi } from "../lib/api";
import { useToast } from "../components/ui/toast";
import { hasPermission, Permission } from "../lib/permissions";
import { ReportingOverview } from "../components/reporting/ReportingOverview";
import {
  Building2,
  ChevronRight,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  School as SchoolIcon,
  Layers,
  Check,
  Camera,
  MapPin,
  Filter,
  Calendar,
  ChevronLeft,
  Edit2,
  Search,
  MapPinned,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { SegmentedTabs } from "../components/school-dashboard/details/primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";
import { ImigongoPattern } from "../components/ui/ImigongoPattern";
import { FileUploader } from "../components/ui/file-uploader";
import { ReportAnalytics } from "../components/reports/ReportAnalytics";
import SchoolMap from "../components/SchoolMap";
import { Skeleton } from "../components/ui/skeleton";
import { Textarea } from "../components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import type { PeriodRange } from "../components/ui/period-filter";
import { startOfMonth } from "date-fns";
import { ReportDetailsModal } from "../components/reports/ReportDetailsModal";
import { DeleteConfirmationModal } from "../components/ui/delete-confirmation-modal";
import { RichDropdown } from "../components/ui/rich-dropdown";
import { Input } from "../components/ui/input";
import { EmptyState } from "../components/ui/empty-state";
import { ErrorState } from "../components/ui/error-state";
import { errorMessage } from "../components/ui/error-message";
import { useNavigate, useSearchParams } from "react-router-dom";
import { viewerLink } from "../lib/viewer-tools";
import { label } from "../lib/labels";
import { PILL_BUTTON, TONE_PILL, TONE_TILE } from "../components/ui/surfaces";
import {
  ChoiceCard,
  ChoiceGrid,
  StepHeader,
  StepPanel,
  WizardSection,
  WizardStepper,
} from "../components/reporting/wizard-ui";

interface Facility {
  facilityId: string;
  title: string;
  items: Array<{
    id: string;
    label: string;
    issueCategories?: string[];
  }>;
}

interface Building {
  id: string;
  name: string;
  facilities: Array<{
    facility_id: string;
    facility_name: string;
  }>;
}

interface IssueEntry {
  category: string[];
  description: string;
  files: File[];
}

interface SchoolReportingProps {
  schoolId?: string;
  hideHeader?: boolean;
  initialBuildingId?: string;
  mode?: "page" | "modal";
  onReportSubmitted?: () => void;
}

export default function SchoolReporting({
  schoolId: propSchoolId,
  hideHeader,
  initialBuildingId,
  mode = "page",
  onReportSubmitted,
}: SchoolReportingProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Refs to prevent duplicate / stale API calls
  const historyAbortRef = useRef<AbortController | null>(null);
  const analyticsAbortRef = useRef<AbortController | null>(null);
  // Track which target school ID was last used to initialize, so auth-store
  // hydration (undefined → value) does not trigger a duplicate fetch.
  // undefined = not yet initialized (sentinel distinct from null = "no school")
  const initTargetRef = useRef<string | null | undefined>(undefined);

  // Derive admin permission
  const isAdmin = hasPermission(
    user,
    Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD,
  );

  const [activeTab, setActiveTab] = useState<
    "overview" | "report" | "history" | "analytics"
  >(mode === "modal" ? "report" : isAdmin ? "overview" : "report");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── Shared store (schools list + facility definitions) ─────────────────
  const {
    schools,
    meta: schoolsMeta,
    schoolsLoading,
    fetchSchools: fetchSchoolsFromStore,
    facilities: storeFacilities,
    fetchFacilities,
  } = useSchoolsStore();

  // Selection state
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(
    propSchoolId || user?.location?.schoolId || "",
  );
  const [buildings, setBuildings] = useState<Building[]>([]);
  /** Where the last report was filed — for "See on map" after submitting. */
  const [lastPlace, setLastPlace] = useState<{ schoolId: string; buildingId: string | null } | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(
    null,
  );
  // Facilities come from the shared store (cast for backward-compat)
  const facilitiesDefinitions = storeFacilities as Facility[];
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(
    null,
  );
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [step2Tab, setStep2Tab] = useState<"list" | "map">("list");
  const [selectedSchoolDetails, setSelectedSchoolDetails] = useState<any>(null);

  // Form state
  const [issues, setIssues] = useState<IssueEntry[]>([]);
  const [currentIssue, setCurrentIssue] = useState<IssueEntry>({
    category: [],
    description: "",
    files: [],
  });
  const [formErrors, setFormErrors] = useState<{
    description?: string;
    category?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const canTriage = hasPermission(user, Permission.MANAGE_REPORTS);
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkReportId = searchParams.get("report");
  const [selectedGalleryImages, setSelectedGalleryImages] = useState<
    string[] | null
  >(null);

  // Analytics Unified State
  const [allReports, setAllReports] = useState<any[]>([]);
  const [analyticsRange, setAnalyticsRange] = useState<PeriodRange>({
    label: "This Month",
    key: "this_month",
    startDate: startOfMonth(new Date()),
    endDate: new Date(),
  });

  const [submittedReportId, setSubmittedReportId] = useState<string | null>(
    null,
  );
  const [submissionStatus, setSubmissionStatus] = useState<
    "success" | "error" | null
  >(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  /** Bumped after a triage change so the overview figures reload. */
  const [overviewRefresh, setOverviewRefresh] = useState(0);

  // Deep link from notifications: /reporting?report=<id> opens that report.
  useEffect(() => {
    if (!deepLinkReportId || mode === "modal") return;
    let cancelled = false;
    api
      .get(`/reports/${deepLinkReportId}`)
      .then((res) => !cancelled && setSelectedReport(res.data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [deepLinkReportId, mode]);

  const closeSelectedReport = () => {
    setSelectedReport(null);
    if (deepLinkReportId && mode !== "modal") {
      const next = new URLSearchParams(searchParams);
      next.delete("report");
      setSearchParams(next, { replace: true });
    }
  };

  // School list pagination & search (delegated to store)
  const [schoolsPage, setSchoolsPage] = useState(1);
  const schoolsTotal = schoolsMeta.total;
  const [schoolsSearch, setSchoolsSearch] = useState("");
  const schoolsLimit = 15;

  // History Pagination & Filtering
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [historyDateRange, setHistoryDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null });

  // History search
  const [historySearch, setHistorySearch] = useState("");

  // Delete & Edit State
  const [reportToDelete, setReportToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState<string | false>(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return history;
    const q = historySearch.toLowerCase();
    return history.filter(
      (r) =>
        r.description?.toLowerCase().includes(q) ||
        r.facilityId?.toLowerCase().includes(q) ||
        r.itemId?.toLowerCase().includes(q),
    );
  }, [history, historySearch]);

  useEffect(() => {
    const targetSchoolId = propSchoolId || user?.location?.schoolId || null;

    // Skip when the resolved target hasn't actually changed (e.g. auth-store hydration
    // changes the user object but the schoolId stays the same / undefined)
    if (initTargetRef.current === targetSchoolId) return;
    initTargetRef.current = targetSchoolId;

    // Fetch facilities from shared store (no-op if already loaded)
    fetchFacilities();

    if (targetSchoolId) {
      setSelectedSchoolId(targetSchoolId);
      fetchSchoolBuildings(targetSchoolId);
      setStep(2);
    } else {
      fetchSchoolsLocal(1, "");
    }
  }, [propSchoolId, user?.location?.schoolId]);

  useEffect(() => {
    if (activeTab === "history") {
      setHistoryLoading(true); // prevent empty-state flash before fetch starts
      fetchHistory();
    }
    if (activeTab === "analytics") fetchAnalyticsData();
  }, [
    activeTab,
    analyticsRange,
    selectedSchoolId,
    historyPage,
    statusFilter,
    historyDateRange,
  ]);

  const fetchAnalyticsData = async () => {
    if (!selectedSchoolId) return;

    // Cancel any in-flight request before starting a new one
    analyticsAbortRef.current?.abort();
    const controller = new AbortController();
    analyticsAbortRef.current = controller;

    setAnalyticsLoading(true);
    try {
      const params: any = {
        schoolId: selectedSchoolId,
        limit: 1000,
      };
      if (analyticsRange.startDate)
        params.startDate = analyticsRange.startDate.toISOString();
      if (analyticsRange.endDate)
        params.endDate = analyticsRange.endDate.toISOString();

      const res = await api.get("/reports", {
        params,
        signal: controller.signal,
      });
      const reportsArray = res.data.data || res.data || [];
      setAllReports(Array.isArray(reportsArray) ? reportsArray : []);
    } catch (err: any) {
      if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
      console.error("Failed to fetch analytics", err);
      setAllReports([]);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const showToast = (message: string, type: "success" | "warning" | "error") => {
    toast[type](message);
  };

  const handleUpdateReportStatus = async (reportId: string, status: string) => {
    setIsStatusUpdating(true);
    try {
      await api.patch(`/reports/${reportId}/status`, { status });
      // Optimistic update
      const updatedReports = allReports.map((r) =>
        r.id === reportId ? { ...r, status } : r,
      );
      setAllReports(updatedReports);

      // Update the currently viewed report if open
      if (selectedReport?.id === reportId) {
        setSelectedReport({ ...selectedReport, status });
      }

      showToast(`Report marked ${label("reportStatus", status)}`, "success");
      fetchHistory(); // Refresh history tab as well
      setOverviewRefresh((k) => k + 1);
    } catch (err) {
      console.error("Failed to update report status", err);
      showToast(apiErrorMessage(err, "Could not update the report status"), "error");
      throw err;
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const fetchHistory = async () => {
    if (!user?.id && !selectedSchoolId) return;

    // Cancel any in-flight request before starting a new one
    historyAbortRef.current?.abort();
    const controller = new AbortController();
    historyAbortRef.current = controller;

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const params: any = {
        page: historyPage,
        limit: historyLimit,
      };

      // Scope history to the selected school when available; otherwise show current user's reports
      if (selectedSchoolId) {
        params.schoolId = selectedSchoolId;
      } else if (user?.id) {
        params.reportedBy = user.id;
      }

      if (statusFilter !== "ALL") params.status = statusFilter;
      if (historyDateRange.start)
        params.startDate = historyDateRange.start.toISOString();
      if (historyDateRange.end)
        params.endDate = historyDateRange.end.toISOString();

      const res = await api.get("/reports", {
        params,
        signal: controller.signal,
      });

      if (res.data && res.data.data) {
        setHistory(res.data.data);
        setHistoryTotal(res.data.total);
      } else {
        setHistory(res.data || []);
        setHistoryTotal(res.data?.length || 0);
      }
    } catch (err: any) {
      if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
      console.error("Failed to load history", err);
      setHistoryError(errorMessage(err, "Your report history could not be loaded."));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/reports/${reportToDelete.id}`);
      showToast("Report deleted", "success");
      fetchHistory();
      setReportToDelete(null);
    } catch (err) {
      console.error("Failed to delete report", err);
      showToast(apiErrorMessage(err, "Could not delete the report"), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditReport = async (report: any) => {
    setIsHistoryLoading(true); // temporary overloading of loading state
    try {
      // 1. Set identifiers
      setSelectedSchoolId(report.schoolId);

      // 2. Fetch dependencies
      const schoolRes = await api.get(`/schools/${report.schoolId}`);
      setSelectedSchoolDetails(schoolRes.data);
      setBuildings(schoolRes.data.buildings || []);

      const building = (schoolRes.data.buildings || []).find(
        (b: any) => b.id === report.buildingId,
      );
      setSelectedBuilding(building || null);

      const facilityDef = facilitiesDefinitions.find(
        (f) => f.facilityId === report.facilityId,
      );
      setSelectedFacility(facilityDef || null);

      const targetItem = facilityDef?.items.find(
        (i: any) => i.id === report.itemId,
      );
      setSelectedItem(targetItem || null);

      // 3. Set current issue details
      setCurrentIssue({
        category: Array.isArray(report.issueCategory)
          ? report.issueCategory
          : [report.issueCategory],
        description: report.description,
        files: [], // Files cannot be pre-filled easily from URLs
      });

      // 4. Set UI state
      setIsEditing(report.id);
      setActiveTab("report");
      setStep(5);

      showToast("Editing report: update the details below.", "success");
    } catch (err) {
      console.error("Failed to prepare edit mode", err);
      showToast(apiErrorMessage(err, "Could not open this report for editing"), "error");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const setIsHistoryLoading = (val: boolean) => setHistoryLoading(val); // simple wrapper

  // Wrapper that delegates to the shared store
  const fetchSchoolsLocal = async (
    page = schoolsPage,
    search = schoolsSearch,
  ) => {
    setSchoolsPage(page);
    await fetchSchoolsFromStore({
      page,
      limit: schoolsLimit,
      search: search.trim() || "",
    });
  };

  const fetchSchoolBuildings = async (schoolId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/schools/${schoolId}`);
      setSelectedSchoolDetails(res.data);
      const fetchedBuildings = res.data.buildings || [];
      setBuildings(fetchedBuildings);
      // Pre-select building and skip to step 3 when initialBuildingId is provided
      if (initialBuildingId && fetchedBuildings.length) {
        const b = fetchedBuildings.find((b: any) => b.id === initialBuildingId);
        if (b) {
          setSelectedBuilding(b);
          setStep(3);
        }
      }
    } catch (err) {
      console.error("Failed to load school buildings", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSchoolSelect = (id: string) => {
    setSelectedSchoolId(id);
    fetchSchoolBuildings(id);
    setStep(2);
  };

  // ── Admin overview tab fetch ──────────────────────────────────────────────
  // Admin dashboard fetches its own data internally (all schools, no schoolId filter)

  const handleBuildingSelect = (building: Building) => {
    setSelectedBuilding(building);
    setStep(3);
  };

  const handleFacilitySelect = (facility: any) => {
    const definition = facilitiesDefinitions.find(
      (f) => f.facilityId === facility.facility_id,
    );
    if (definition) {
      setSelectedFacility(definition);
      setStep(4);
    } else {
      console.error("Facility definition not found");
    }
  };

  const handleItemSelect = (item: any) => {
    setSelectedItem(item);
    setStep(5);
  };

  const addIssue = () => {
    const errors: { description?: string; category?: string } = {};
    if (
      !currentIssue.description ||
      currentIssue.description.trim().length < 20
    ) {
      errors.description = "Description must be at least 20 characters.";
    }
    if (currentIssue.description.trim().length > 1000) {
      errors.description = "Description cannot exceed 1000 characters.";
    }
    if (currentIssue.category.length === 0) {
      errors.category = "Please select at least one issue category.";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return false;
    }
    setFormErrors({});
    setIssues([...issues, { ...currentIssue }]);
    setCurrentIssue({ category: [], description: "", files: [] });
    return true;
  };

  const removeIssue = (index: number) => {
    setIssues(issues.filter((_, i) => i !== index));
  };

  const uploadFilesToExternalServer = async (files: File[]) => {
    if (!files.length) return [];

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const { data } = await fileApi.post("/upload?folder=reports", formData);
    if (!data?.success || !Array.isArray(data.urls)) {
      throw new Error(data?.message || "File server upload failed");
    }
    // data.urls are relative /files/... paths — stored as-is
    return data.urls as string[];
  };

  const handleSubmit = async () => {
    const finalIssues = [...issues];
    if (currentIssue.category.length > 0 || currentIssue.description) {
      finalIssues.push(currentIssue);
    }
    if (issues.length === 0 && !currentIssue.description) {
      showToast("Please add at least one issue.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        // UPDATE MODE
        const issue = finalIssues[0];
        const attachmentUrls = await uploadFilesToExternalServer(issue.files);

        const payload = {
          description: issue.description,
          issueCategory: issue.category,
          attachments: [
            ...(selectedReport?.attachments || []),
            ...attachmentUrls,
          ],
        };

        await api.patch(`/reports/${isEditing}`, payload);
        showToast("Report updated", "success");
      } else {
        // CREATE MODE
        for (const issue of finalIssues) {
          const attachmentUrls = await uploadFilesToExternalServer(issue.files);
          const payload = {
            schoolId: selectedSchoolId!,
            buildingId: selectedBuilding?.id || "",
            facilityId: selectedFacility?.facilityId || "",
            itemId: selectedItem?.id || "",
            description: issue.description,
            issueCategory: issue.category,
            attachments: attachmentUrls,
          };
          await api.post("/reports", payload);
        }
        showToast(
          finalIssues.length === 1
            ? "Report submitted"
            : `${finalIssues.length} reports submitted`,
          "success",
        );
      }

      if (!isEditing && selectedSchoolId) {
        setLastPlace({ schoolId: selectedSchoolId, buildingId: selectedBuilding?.id || null });
      }
      setIssues([]);
      setCurrentIssue({ category: [], description: "", files: [] });
      setSubmittedReportId("success");
      if (mode !== "modal") {
        setSubmissionStatus("success");
      }
      fetchHistory(); // Reload history
      if (onReportSubmitted) {
        onReportSubmitted();
      }
    } catch (err) {
      console.error("Failed to submit report", err);
      if (mode !== "modal") {
        setSubmissionStatus("error");
      }
      showToast(
        apiErrorMessage(err, err instanceof Error && err.message ? err.message : "Could not submit the report. Please try again."),
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    const schoolId = propSchoolId || user?.location?.schoolId;
    setIssues([]);
    setSubmittedReportId(null);
    setSelectedFacility(null);
    setSelectedItem(null);
    setCurrentIssue({ description: "", category: [], files: [] });

    if (initialBuildingId && buildings.length) {
      const b = buildings.find((b) => b.id === initialBuildingId);
      if (b) {
        setSelectedBuilding(b);
        setStep(3);
        return;
      }
    }

    if (schoolId) {
      setSelectedSchoolId(schoolId);
      fetchSchoolBuildings(schoolId);
      setStep(2);
    } else {
      setSelectedSchoolId("");
      setSelectedBuilding(null);
      setStep(1);
    }
  };

  const renderStatusModal = () => {
    if (!submissionStatus) return null;

    const isSuccess = submissionStatus === "success";

    return (
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-2xl"
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative bg-card p-6 sm:p-10 rounded-2xl border border-border/10 max-w-md w-full text-center overflow-hidden"
        >
          <ImigongoPattern className="absolute inset-0 text-primary pointer-events-none opacity-[0.03]" />

          <div className="relative z-10 space-y-6">
            <div
              className={cn(
                "w-24 h-24 rounded-2xl mx-auto flex items-center justify-center",
                isSuccess
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-rose-500/10 text-rose-500",
              )}
            >
              {isSuccess ? (
                <CheckCircle2 className="w-12 h-12" />
              ) : (
                <AlertCircle className="w-12 h-12" />
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-medium tracking-tight">
                {isSuccess ? "Report sent" : "Could not send"}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isSuccess
                  ? "The review team can see it now."
                  : "Check your connection and try again."}
              </p>
            </div>

            <div className="pt-4 flex flex-col gap-3">
              <Button
                onClick={() => {
                  setSubmissionStatus(null);
                  if (isSuccess) resetForm();
                }}
                className={cn(
                  "rounded-full h-12 text-sm font-medium transition-all active:scale-95",
                  isSuccess ? "bg-primary" : "bg-rose-500 hover:bg-rose-600",
                )}
              >
                {isSuccess ? "Report another problem" : "Try again"}
              </Button>

              {isSuccess && lastPlace && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubmissionStatus(null);
                    navigate(viewerLink("2d", lastPlace.schoolId, { buildingId: lastPlace.buildingId, tab: lastPlace.buildingId ? "reporting" : undefined }));
                  }}
                  className="rounded-full h-12 text-sm font-medium"
                >
                  <MapPinned className="mr-2 h-4 w-4" aria-hidden />
                  See it on the map
                </Button>
              )}

              {isSuccess && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSubmissionStatus(null);
                    setActiveTab("history");
                  }}
                  className="rounded-full h-11 text-sm text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-all"
                >
                  My reports
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderSubmissionReview = () => (
    <div className="space-y-5">
      <StepHeader
        title="Review and send"
        subtitle={`${issues.length} issue${issues.length === 1 ? "" : "s"} · check the details before you send`}
        onBack={() => setStep(5)}
        backLabel="Back to issue details"
        actions={
          selectedSchoolDetails?.tifFilePath ? (
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", TONE_PILL.primary.box)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", TONE_PILL.primary.dot)} aria-hidden />
              High-res map
            </span>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <WizardSection
          title="Where"
          icon={MapPin}
          className="order-2 lg:order-1 lg:col-span-4"
        >
          <dl className="space-y-3">
            {[
              { label: "School", value: schools.find((s) => s.id === selectedSchoolId)?.name ?? selectedSchoolDetails?.name, icon: SchoolIcon },
              { label: "Building", value: selectedBuilding?.name, icon: Building2 },
              { label: "Facility and item", value: `${selectedFacility?.title || "—"} · ${selectedItem?.label || "General"}`, icon: Layers },
            ].map(({ label: l, value, icon: Icon }) => (
              <div key={l} className="flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-white/40" aria-hidden />
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500 dark:text-white/50">{l}</dt>
                  <dd className="truncate text-sm font-medium text-slate-900 dark:text-white">{value || "Not set"}</dd>
                </div>
              </div>
            ))}
          </dl>
          <Button variant="outline" onClick={() => setStep(2)} className={cn(PILL_BUTTON.small, "mt-4 w-full")}>
            Change location
          </Button>
        </WizardSection>

        <div className="order-1 space-y-3 lg:order-2 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              Issues <span className="font-normal text-slate-500 dark:text-white/50">({issues.length})</span>
            </h4>
            <Button variant="ghost" onClick={() => setStep(5)} className={cn(PILL_BUTTON.small, "text-primary hover:bg-primary/10")}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add issue
            </Button>
          </div>

          <ul className="max-h-110 space-y-2.5 overflow-y-auto pr-1 custom-scrollbar">
            <AnimatePresence initial={false}>
              {issues.map((issue, idx) => (
                <motion.li
                  key={idx}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="group flex gap-3.5 rounded-2xl bg-white/70 p-4 ring-1 ring-slate-900/8 dark:bg-white/3 dark:ring-white/8"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900/5 text-xs font-semibold text-slate-600 dark:bg-white/6 dark:text-white/70">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {issue.category.map((cat) => (
                        <span key={cat} className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", TONE_PILL.primary.box)}>
                          {cat}
                        </span>
                      ))}
                      {issue.files?.length > 0 && (
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", TONE_PILL.neutral.box)}>
                          <Camera className="h-3 w-3" aria-hidden />
                          {issue.files.length} photo{issue.files.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-white/75">{issue.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeIssue(idx)}
                    aria-label={`Remove issue ${idx + 1}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-white/50">
              The monitoring team reviews every report and updates its status.
            </p>
            <Button
              className={PILL_BUTTON.primary}
              onClick={handleSubmit}
              disabled={isSubmitting || issues.length === 0}
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                  Sending…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Send report
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSuccessView = () => (
    <div className="mx-auto max-w-md py-12 text-center">
      <span className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ring-inset", TONE_TILE.good)}>
        <CheckCircle2 className="h-7 w-7" aria-hidden />
      </span>
      <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Report sent</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-white/55">
        Reference <span className="font-mono text-slate-900 dark:text-white">{submittedReportId?.slice(0, 8) || "pending"}</span>
      </p>
      <div className="mt-6 rounded-2xl bg-white/70 p-4 text-left ring-1 ring-slate-900/8 dark:bg-white/3 dark:ring-white/8">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", TONE_PILL.warn.box)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", TONE_PILL.warn.dot)} aria-hidden />
          Pending review
        </span>
        <p className="mt-2 text-sm text-slate-600 dark:text-white/65">
          The monitoring team will review it and update the status. You can follow it under History.
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button className={PILL_BUTTON.primary} onClick={resetForm}>
          <Plus className="h-4 w-4" aria-hidden /> New report
        </Button>
        <Button variant="outline" className={PILL_BUTTON.secondary} onClick={() => setActiveTab("history")}>
          View history
        </Button>
      </div>
    </div>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "SOLVED":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "NEED_INTERVENTION":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      case "FAILED":
        return "bg-slate-500/10 text-slate-500 border-slate-500/12";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const renderStepIndicator = () => {
    // A school-scoped user, or the modal opened on a school, never picks a school.
    const skipSchool = !!(user?.location?.schoolId || propSchoolId);
    const labels = ["School", "Building", "Facility", "Item", "Details", "Review"];
    const steps = skipSchool ? labels.slice(1) : labels;
    const current = Math.min(step, 6) - (skipSchool ? 1 : 0);
    return <WizardStepper steps={steps} current={Math.max(1, current)} />;
  };

  return (
    <div
      className={cn(
        "relative space-y-4 overflow-hidden",
        mode !== "modal" ? "min-h-screen py-6 pt-0" : "py-4",
      )}
    >
      <AnimatePresence>
        {selectedReport && (
          <ReportDetailsModal
            report={selectedReport}
            onClose={closeSelectedReport}
            onUpdateStatus={canTriage ? handleUpdateReportStatus : undefined}
            isUpdating={isStatusUpdating}
          />
        )}
      </AnimatePresence>

      {mode !== "modal" && (
        <AnimatePresence>{renderStatusModal()}</AnimatePresence>
      )}
      {!hideHeader && mode !== "modal" && (
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_10px_24px_-10px_rgb(37_99_235/0.8)]">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-tight text-slate-900 dark:text-white">School reporting</h1>
              <p className="text-[15px] text-slate-500 dark:text-white/55">
                {activeTab === "overview" ? "Issue Reports across your schools: what's open and where to act first." : "Report a facility problem and follow it to resolution."}
              </p>
            </div>
          </div>
          {(isAdmin || step > 1) && (
            <SegmentedTabs<"overview" | "report" | "history" | "analytics">
              idPrefix="reporting-sections"
              ariaLabel="Reporting sections"
              value={activeTab}
              onChange={setActiveTab}
              tabs={[
                ...(isAdmin ? [{ key: "overview" as const, label: "Overview" }] : []),
                ...(step > 1
                  ? [
                      { key: "report" as const, label: "New report" },
                      { key: "history" as const, label: history.length ? `History · ${history.length}` : "History" },
                      { key: "analytics" as const, label: "Analytics" },
                    ]
                  : [{ key: "report" as const, label: "New report" }]),
              ]}
            />
          )}
        </header>
      )}

      <div className="relative z-10">
        {/* ── Admin Overview Tab ─────────────────────────────────────────── */}
        {mode !== "modal" && activeTab === "overview" && isAdmin && (
          <ReportingOverview
            refreshKey={overviewRefresh}
            onOpenReport={(reportId) => {
              const next = new URLSearchParams(searchParams);
              next.set("report", reportId);
              setSearchParams(next);
            }}
          />
        )}

        {mode === "modal" || activeTab === "report" ? (
          <div className={cn(mode === "modal" && "px-5 pb-6 sm:px-6")}>
            {step < 7 && <div className="mb-6">{renderStepIndicator()}</div>}

            <AnimatePresence mode="wait" initial={false}>
              {/* STEP 1: School */}
              {step === 1 && !user?.location?.schoolId && (
                <StepPanel key="step1" id="step1" className="space-y-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <StepHeader
                      title="Choose a school"
                      subtitle={`${schoolsTotal} school${schoolsTotal !== 1 ? "s" : ""} available`}
                    />
                    <div className="relative mb-5 w-full sm:w-72">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                      <Input
                        type="search"
                        aria-label="Search schools"
                        className="h-10 rounded-full pl-10"
                        placeholder="Search schools…"
                        value={schoolsSearch}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSchoolsSearch(val);
                          setSchoolsPage(1);
                          fetchSchoolsLocal(1, val);
                        }}
                      />
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-slate-900/8 dark:bg-white/3 dark:ring-white/8">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-slate-900/6 hover:bg-transparent dark:border-white/6">
                          <TableHead className="text-xs font-medium text-slate-500">School</TableHead>
                          <TableHead className="hidden text-xs font-medium text-slate-500 sm:table-cell">Code</TableHead>
                          <TableHead className="hidden text-xs font-medium text-slate-500 md:table-cell">Type</TableHead>
                          <TableHead className="hidden text-xs font-medium text-slate-500 lg:table-cell">District</TableHead>
                          <TableHead className="hidden text-xs font-medium text-slate-500 lg:table-cell">Province</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500">Status</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schoolsLoading ? (
                          Array.from({ length: 6 }).map((_, i) => (
                            <TableRow key={i} className="pointer-events-none">
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                                  <Skeleton className="h-4 w-40 rounded" />
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16 rounded" /></TableCell>
                              <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-16 rounded" /></TableCell>
                              <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20 rounded" /></TableCell>
                              <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20 rounded" /></TableCell>
                              <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                              <TableCell />
                            </TableRow>
                          ))
                        ) : schools.length === 0 ? (
                          <TableRow>
                            <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                              {schoolsSearch ? `No schools match "${schoolsSearch}"` : "No schools found"}
                            </td>
                          </TableRow>
                        ) : (
                          schools.map((s) => (
                            <TableRow
                              key={s.id}
                              onClick={() => handleSchoolSelect(s.id)}
                              className={cn(
                                "cursor-pointer border-slate-900/5 transition-colors hover:bg-primary/4 dark:border-white/5",
                                selectedSchoolId === s.id && "bg-primary/6",
                              )}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", TONE_TILE.neutral)}>
                                    <SchoolIcon className="h-4 w-4" aria-hidden />
                                  </span>
                                  <span className="text-sm font-medium text-slate-900 dark:text-white">{s.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <span className="font-mono text-xs text-slate-500">{s.code || "—"}</span>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <span className="text-xs text-slate-500">{s.type ? label("schoolType", s.type) : "—"}</span>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <span className="text-xs text-slate-500">{s.district || "—"}</span>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <span className="text-xs text-slate-500">{s.province || "—"}</span>
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const tone = s.status === "ACTIVE" ? "good" : s.status === "UNDER_RENOVATION" ? "warn" : "neutral";
                                  return (
                                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", TONE_PILL[tone].box)}>
                                      <span className={cn("h-1.5 w-1.5 rounded-full", TONE_PILL[tone].dot)} aria-hidden />
                                      {label("schoolStatus", s.status)}
                                    </span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="pr-4 text-right">
                                <ChevronRight className="inline-block h-4 w-4 text-slate-400" aria-hidden />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {schoolsTotal > schoolsLimit && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-500">
                        Page {schoolsPage} of {Math.ceil(schoolsTotal / schoolsLimit)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          aria-label="Previous page of schools"
                          variant="outline"
                          size="sm"
                          disabled={schoolsPage <= 1}
                          onClick={() => fetchSchoolsLocal(Math.max(1, schoolsPage - 1), schoolsSearch)}
                          className="h-8 w-8 rounded-full p-0"
                        >
                          <ChevronLeft className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          aria-label="Next page of schools"
                          variant="outline"
                          size="sm"
                          disabled={schoolsPage >= Math.ceil(schoolsTotal / schoolsLimit)}
                          onClick={() => fetchSchoolsLocal(schoolsPage + 1, schoolsSearch)}
                          className="h-8 w-8 rounded-full p-0"
                        >
                          <ChevronRight className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  )}
                </StepPanel>
              )}

              {/* STEP 2: Building */}
              {step === 2 && (
                <StepPanel key="step2" id="step2" className="mx-auto max-w-6xl">
                  <StepHeader
                    title="Choose a building"
                    subtitle={selectedSchoolDetails?.name || "School buildings"}
                    onBack={user?.location?.schoolId ? undefined : () => setStep(1)}
                    backLabel="Back to school selection"
                    actions={
                      <SegmentedTabs<"list" | "map">
                        idPrefix="report-buildings"
                        ariaLabel="Show buildings as"
                        value={step2Tab}
                        onChange={setStep2Tab}
                        tabs={[
                          { key: "list", label: "List" },
                          { key: "map", label: "Map" },
                        ]}
                      />
                    }
                  />

                  {loading ? (
                    <ChoiceGrid>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-19 rounded-2xl" />
                      ))}
                    </ChoiceGrid>
                  ) : step2Tab === "map" ? (
                    <div className="relative h-130 overflow-hidden rounded-2xl ring-1 ring-slate-900/8 dark:ring-white/8">
                      {selectedSchoolDetails ? (
                        <SchoolMap
                          school={selectedSchoolDetails}
                          buildings={buildings}
                          isEmbed
                          onSelectBuilding={(b) => handleBuildingSelect(b)}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
                          <AlertCircle className="h-4 w-4" aria-hidden /> Map data isn't available for this school.
                        </div>
                      )}
                    </div>
                  ) : buildings.length === 0 ? (
                    <EmptyState
                      icon={Building2}
                      title="No buildings yet"
                      description="This school has no buildings on record. Ask the GIS team to add them, then report the problem."
                      action={user?.location?.schoolId ? undefined : { label: "Choose another school", onClick: () => setStep(1) }}
                    />
                  ) : (
                    <ChoiceGrid>
                      {buildings.map((b) => (
                        <ChoiceCard
                          key={b.id}
                          icon={Building2}
                          title={b.name}
                          meta={`${b.facilities?.length || 0} facilit${b.facilities?.length === 1 ? "y" : "ies"}`}
                          selected={selectedBuilding?.id === b.id}
                          onClick={() => handleBuildingSelect(b)}
                        />
                      ))}
                    </ChoiceGrid>
                  )}
                </StepPanel>
              )}

              {/* STEP 3: Facility */}
              {step === 3 && selectedBuilding && (
                <StepPanel key="step3" id="step3" className="mx-auto max-w-6xl">
                  <StepHeader
                    title="Which facility?"
                    subtitle={selectedBuilding.name}
                    onBack={() => setStep(2)}
                    backLabel="Back to building selection"
                  />
                  {selectedBuilding.facilities?.length ? (
                    <ChoiceGrid>
                      {selectedBuilding.facilities.map((f: any) => (
                        <ChoiceCard
                          key={f.facility_id}
                          icon={Layers}
                          title={f.facility_name}
                          meta={(() => {
                            const n = facilitiesDefinitions.find((x) => x.facilityId === f.facility_id)?.items.length;
                            return n ? `${n} item${n === 1 ? "" : "s"} to check` : "Facility";
                          })()}
                          onClick={() => handleFacilitySelect(f)}
                        />
                      ))}
                    </ChoiceGrid>
                  ) : (
                    <EmptyState
                      icon={Layers}
                      title="No facilities listed"
                      description="This building has no facilities recorded yet."
                      action={{ label: "Choose another building", onClick: () => setStep(2) }}
                    />
                  )}
                </StepPanel>
              )}

              {/* STEP 4: Item */}
              {step === 4 && selectedFacility && (
                <StepPanel key="step4" id="step4" className="mx-auto max-w-6xl">
                  <StepHeader
                    title="What has the problem?"
                    subtitle={`${selectedBuilding?.name ?? ""}${selectedBuilding ? " · " : ""}${(selectedFacility as any)?.facility_name || selectedFacility.title || "Facility"}`}
                    onBack={() => setStep(3)}
                    backLabel="Back to facility selection"
                  />
                  <ChoiceGrid>
                    {selectedFacility.items.map((item) => (
                      <ChoiceCard
                        key={item.id}
                        icon={ClipboardList}
                        tone="neutral"
                        title={item.label}
                        meta={item.issueCategories?.length ? `${item.issueCategories.length} common issues` : undefined}
                        onClick={() => handleItemSelect(item)}
                      />
                    ))}
                  </ChoiceGrid>
                </StepPanel>
              )}

              {/* STEP 5: Details */}
              {step === 5 && selectedItem && (
                <StepPanel key="step5" id="step5" className="mx-auto max-w-6xl">
                  <StepHeader
                    title={isEditing ? "Edit the issue" : "Describe the problem"}
                    subtitle={selectedItem.label}
                    onBack={() => setStep(4)}
                    backLabel="Back to item selection"
                  />

                  {isEditing && (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning/10 px-4 py-3 ring-1 ring-inset ring-warning/25">
                      <p className="flex items-center gap-2 text-sm text-slate-800 dark:text-white/85">
                        <AlertCircle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
                        You're editing a sent report. Send it again to save your changes.
                      </p>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setIsEditing(false);
                          resetForm();
                        }}
                        className={cn(PILL_BUTTON.small, "text-warning hover:bg-warning/10")}
                      >
                        Cancel edit
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
                    <WizardSection
                      className="lg:col-span-3"
                      icon={AlertCircle}
                      title="Type of issue"
                      hint="Pick one or more; it routes the report to the right team."
                    >
                      <div className="flex flex-wrap gap-2" role="group" aria-label="Issue type">
                        {selectedItem.issueCategories?.map((cat: string) => {
                          const on = currentIssue.category.includes(cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                setCurrentIssue({
                                  ...currentIssue,
                                  category: on
                                    ? currentIssue.category.filter((c) => c !== cat)
                                    : [...currentIssue.category, cat],
                                })
                              }
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors duration-150",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                                on
                                  ? "bg-primary text-primary-foreground ring-primary"
                                  : "bg-white/70 text-slate-700 ring-slate-900/10 hover:bg-primary/6 hover:ring-primary/30 dark:bg-white/3 dark:text-white/75 dark:ring-white/10",
                              )}
                            >
                              {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                      {formErrors.category && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" aria-hidden /> {formErrors.category}
                        </p>
                      )}

                      <label htmlFor="report-description" className="mb-1.5 mt-5 block text-sm font-medium text-slate-900 dark:text-white">
                        What's wrong?
                      </label>
                      <Textarea
                        id="report-description"
                        className="min-h-35"
                        placeholder="Describe the problem: where it is, how bad, since when…"
                        value={currentIssue.description}
                        aria-invalid={!!formErrors.description || undefined}
                        onChange={(e) =>
                          setCurrentIssue({
                            ...currentIssue,
                            description: e.target.value,
                          })
                        }
                      />
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        {formErrors.description ? (
                          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                            <AlertCircle className="h-3.5 w-3.5" aria-hidden /> {formErrors.description}
                          </p>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-white/45">At least 20 characters.</span>
                        )}
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            currentIssue.description.length > 900 ? "text-destructive" : "text-slate-400 dark:text-white/40",
                          )}
                        >
                          {currentIssue.description.length}/1000
                        </span>
                      </div>
                    </WizardSection>

                    <div className="space-y-4 lg:col-span-2">
                      <WizardSection icon={Camera} title="Photos" hint="Optional, up to 3. A photo helps the team act faster.">
                        <FileUploader
                          maxFiles={3}
                          onFilesSelected={(files) =>
                            setCurrentIssue({ ...currentIssue, files })
                          }
                        />
                      </WizardSection>

                      {issues.length > 0 && (
                        <p className="px-1 text-xs text-slate-500 dark:text-white/50">
                          {issues.length} issue{issues.length === 1 ? "" : "s"} already on this report.
                        </p>
                      )}

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          variant="outline"
                          className={cn(PILL_BUTTON.secondary, "flex-1")}
                          onClick={() => {
                            if (addIssue()) showToast("Issue added to the list", "success");
                          }}
                          disabled={
                            !currentIssue.description ||
                            currentIssue.category.length === 0
                          }
                        >
                          <Plus className="h-4 w-4" aria-hidden /> Add another
                        </Button>
                        <Button
                          className={cn(PILL_BUTTON.primary, "flex-1")}
                          onClick={() => {
                            const errors: {
                              description?: string;
                              category?: string;
                            } = {};
                            if (
                              currentIssue.description &&
                              currentIssue.description.trim().length < 20
                            ) {
                              errors.description =
                                "Description must be at least 20 characters.";
                            }
                            if (
                              currentIssue.description &&
                              currentIssue.description.trim().length > 1000
                            ) {
                              errors.description =
                                "Description cannot exceed 1000 characters.";
                            }
                            if (
                              currentIssue.description &&
                              currentIssue.category.length === 0
                            ) {
                              errors.category =
                                "Please select at least one issue category.";
                            }
                            if (Object.keys(errors).length > 0) {
                              setFormErrors(errors);
                              return;
                            }
                            setFormErrors({});
                            if (
                              currentIssue.description &&
                              currentIssue.category.length > 0
                            )
                              addIssue();
                            if (
                              issues.length === 0 &&
                              !currentIssue.description
                            ) {
                              showToast(
                                "Please add at least one issue before reviewing.",
                                "warning",
                              );
                              return;
                            }
                            setStep(6);
                          }}
                          disabled={
                            isSubmitting ||
                            (issues.length === 0 &&
                              (!currentIssue.description ||
                                !currentIssue.category))
                          }
                        >
                          Review
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  </div>
                </StepPanel>
              )}

              {/* STEP 6: Review */}
              {step === 6 && (
                <StepPanel key="step6" id="step6" className="mx-auto max-w-6xl">
                  {renderSubmissionReview()}
                </StepPanel>
              )}

              {/* STEP 7: Sent */}
              {step === 7 && (
                <StepPanel key="step7" id="step7" className="mx-auto max-w-6xl">
                  {renderSuccessView()}
                </StepPanel>
              )}
            </AnimatePresence>
          </div>
        ) : activeTab === "history" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* History Search */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <Input
                  className="pl-9 rounded-xl h-10 text-sm bg-card border-border/30"
                  placeholder="Search reports..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
              {historySearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHistorySearch("")}
                  className="rounded-full h-9 px-3 text-xs text-muted-foreground"
                >
                  Clear
                </Button>
              )}
              <span className="text-xs text-muted-foreground/60 ml-auto">
                {historyTotal} total
              </span>
            </div>

            {/* History Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-4">
              <div className="md:col-span-4 space-y-2">
                <label className="text-[15px] font-black uppercase text-primary tracking-widest pl-2 flex items-center gap-2">
                  <Filter className="w-3 h-3" /> Filter by Status
                </label>
                <RichDropdown
                  options={[
                    { label: "All Reports", value: "ALL" },
                    { label: "Pending Review", value: "PENDING" },
                    { label: "Resolved", value: "SOLVED" },
                    { label: "Needs Intervention", value: "NEED_INTERVENTION" },
                    { label: "Failed / Invalid", value: "FAILED" },
                  ]}
                  value={statusFilter}
                  onChange={(val) => {
                    setStatusFilter(val);
                    setHistoryPage(1);
                  }}
                  className="rounded-2xl"
                />
              </div>

              <div className="md:col-span-4 space-y-2">
                <label className="text-[15px] font-black uppercase text-primary tracking-widest pl-2 flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> Date Range
                </label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    className="rounded-2xl h-11 text-[15px] font-bold"
                    onChange={(e) =>
                      setHistoryDateRange((prev) => ({
                        ...prev,
                        start: e.target.value ? new Date(e.target.value) : null,
                      }))
                    }
                  />
                  <Input
                    type="date"
                    className="rounded-2xl h-11 text-[15px] font-bold"
                    onChange={(e) =>
                      setHistoryDateRange((prev) => ({
                        ...prev,
                        end: e.target.value ? new Date(e.target.value) : null,
                      }))
                    }
                  />
                </div>
                {(historyDateRange.start || historyDateRange.end) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setHistoryDateRange({ start: null, end: null })
                    }
                    className="h-9 px-3 text-xs rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    Clear dates
                  </Button>
                )}
              </div>

              <div className="md:col-span-4 flex justify-end pb-0.5">
                <div className="bg-muted/30 p-1.5 rounded-full border border-border/10 flex items-center gap-2">
                  <Button
                    aria-label="Previous page"
                    variant="ghost"
                    size="sm"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    className="rounded-full h-8 w-8 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden />
                  </Button>
                  <span className="text-[15px] font-black px-4 uppercase tracking-widest">
                    Page {historyPage} of{" "}
                    {Math.ceil(historyTotal / historyLimit) || 1}
                  </span>
                  <Button
                    aria-label="Next page"
                    variant="ghost"
                    size="sm"
                    disabled={
                      historyPage >= Math.ceil(historyTotal / historyLimit)
                    }
                    onClick={() => setHistoryPage((p) => p + 1)}
                    className="rounded-full h-8 w-8 p-0"
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                {[1, 2, 3, 4].map((n) => (
                  <Card
                    key={n}
                    className="bg-card rounded-2xl border-2 border-border/10 p-8 space-y-4"
                  >
                    <div className="flex justify-between">
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-4 w-24 rounded-full" />
                    </div>
                    <Skeleton className="h-8 w-3/4 rounded-lg" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : historyError ? (
              <ErrorState message={historyError} onRetry={fetchHistory} />
            ) : filteredHistory.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={statusFilter !== "ALL" ? "No reports with this status" : "No reports yet"}
                description={
                  statusFilter !== "ALL"
                    ? "Try another status or period."
                    : "Reports you file for this school will appear here, with their status as RTB follows up."
                }
                action={
                  hasPermission(user, Permission.CREATE_REPORT)
                    ? { label: "Report an issue", onClick: () => setActiveTab("report"), icon: Plus }
                    : undefined
                }
              />
            ) : (
              <div className="space-y-6">
                {/* Desktop Table View */}
                <div className="hidden md:block rounded-2xl border-2 border-border/10 overflow-hidden bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-dashed">
                        <TableHead>Date</TableHead>
                        <TableHead>Asset / Target</TableHead>
                        <TableHead>Building</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Log Summary</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map((record) => (
                        <TableRow
                          key={record.id}
                          className="group/row hover:bg-primary/5 cursor-pointer transition-colors border-border/5"
                          onClick={() => setSelectedReport(record)}
                        >
                          <TableCell>
                            <div className="text-[15px] font-black text-muted-foreground opacity-50">
                              {new Date(record.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="text-[13px] font-black uppercase tracking-tight truncate max-w-[150px]">
                                {record.facilityId}
                              </div>
                              <div className="text-[12px] font-bold text-primary opacity-70">
                                {record.itemId}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-[13px] font-semibold text-muted-foreground truncate max-w-[120px]">
                              {record.building?.name || "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(record.issueCategory) ? (
                                record.issueCategory.map((cat: string) => (
                                  <Badge
                                    key={cat}
                                    variant="outline"
                                    className="text-[13px] font-black uppercase rounded-full px-2"
                                  >
                                    {cat}
                                  </Badge>
                                ))
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[13px] font-black uppercase rounded-full px-2"
                                >
                                  {record.issueCategory || "General"}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-[13px] font-medium line-clamp-1 max-w-[200px] text-muted-foreground">
                              {record.description}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "rounded-full font-black text-[13px] px-2.5 py-0.5 border capitalize",
                                getStatusColor(record.status),
                              )}
                            >
                              {label("reportStatus", record.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2 pr-2">
                              <Button
                                aria-label="Edit report"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditReport(record);
                                }}
                                className="h-8 w-8 rounded-full p-0 flex items-center justify-center hover:bg-primary/10 transition-all text-primary"
                              >
                                <Edit2 className="w-3.5 h-3.5" aria-hidden />
                              </Button>

                              <Button
                                aria-label="Delete report"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReportToDelete(record);
                                }}
                                className="h-8 w-8 rounded-full p-0 flex items-center justify-center hover:bg-rose-500/10 transition-all text-rose-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden />
                              </Button>

                              {record.attachments &&
                                record.attachments.length > 0 && (
                                  <Button
                                    aria-label="View photos"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedGalleryImages(
                                        record.attachments,
                                      );
                                    }}
                                    className="h-8 w-8 rounded-full p-0 flex items-center justify-center hover:bg-muted transition-all text-muted-foreground"
                                  >
                                    <Camera className="w-3.5 h-3.5" aria-hidden />
                                  </Button>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {filteredHistory.map((record) => (
                    <Card
                      key={record.id}
                      onClick={() => setSelectedReport(record)}
                      className="p-5 rounded-2xl border border-border/20 bg-card active:scale-[0.98] transition-all space-y-3 cursor-pointer hover:border-primary/30"
                    >
                      {/* Header row */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <ClipboardList className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-[12px] font-semibold text-muted-foreground uppercase tracking-widest">
                              #{record.id.split("-").pop()}
                            </div>
                            <div className="text-xs font-bold uppercase tracking-tight">
                              {record.facilityId
                                ?.replace(/_/g, " ")
                                .replace(/-/g, " ") || "General Report"}
                            </div>
                          </div>
                        </div>
                        <Badge
                          className={cn(
                            "rounded-full font-semibold text-[12px] px-2.5 py-0.5 border capitalize",
                            getStatusColor(record.status),
                          )}
                        >
                          {label("reportStatus", record.status)}
                        </Badge>
                      </div>

                      {/* Description snippet */}
                      {record.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 pl-12">
                          {record.description}
                        </p>
                      )}

                      {/* Categories */}
                      <div className="pl-12 flex flex-wrap gap-1">
                        {Array.isArray(record.issueCategory)
                          ? record.issueCategory.map((cat: string) => (
                              <Badge
                                key={cat}
                                variant="outline"
                                className="rounded-full text-[13px] font-semibold uppercase px-2 border-primary/20 text-primary"
                              >
                                {cat}
                              </Badge>
                            ))
                          : record.issueCategory && (
                              <Badge
                                variant="outline"
                                className="rounded-full text-[13px] font-semibold uppercase px-2 border-primary/20 text-primary"
                              >
                                {record.issueCategory}
                              </Badge>
                            )}
                      </div>

                      {/* Footer actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/10 pl-12">
                        <div className="text-[12px] text-muted-foreground/50 font-semibold">
                          {new Date(record.createdAt).toLocaleDateString()}
                        </div>
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            aria-label="Edit report"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-full hover:bg-primary/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditReport(record);
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5 text-primary" aria-hidden />
                          </Button>
                          <Button
                            aria-label="Delete report"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-full hover:bg-rose-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReportToDelete(record);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ) : activeTab === "analytics" ? (
          <ReportAnalytics
            reports={allReports}
            buildings={buildings}
            facilities={facilitiesDefinitions}
            loading={analyticsLoading}
            range={analyticsRange}
            onRangeChange={setAnalyticsRange}
            onUpdateStatus={canTriage ? handleUpdateReportStatus : undefined}
          />
        ) : null}
      </div>

      {/* Gallery Modal */}
      <AnimatePresence>
        {selectedGalleryImages && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedGalleryImages(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -2 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.9, opacity: 0, rotate: 2 }}
              className="relative bg-card p-4 rounded-2xl border border-border/20 max-w-4xl w-full z-10"
            >
              <ImigongoPattern
                className="absolute inset-0 text-primary pointer-events-none"
                opacity={0.03}
              />
              <div className="flex justify-between items-center mb-6 px-4 pt-4">
                <h3 className="text-base font-bold uppercase tracking-tighter">
                  Evidence Gallery
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedGalleryImages(null)}
                  aria-label="Close gallery"
                  className="rounded-full"
                >
                  <Plus className="w-6 h-6 rotate-45" aria-hidden />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-4 no-scrollbar">
                {selectedGalleryImages.map((img: string, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-2xl overflow-hidden border border-border/10 aspect-video relative group"
                  >
                    <img
                      src={img}
                      className="w-full h-full object-cover"
                      alt={`Evidence ${idx + 1}`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1544216717-3bbf52512659?w=800&auto=format&fit=crop";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Badge className="bg-white/20 backdrop-blur-md border-white/20 text-white font-black uppercase text-[15px]">
                        Evidence #{idx + 1}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 text-center">
                <p className="text-[15px] font-black text-muted-foreground uppercase tracking-widest">
                  End of Gallery
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteConfirmationModal
        isOpen={!!reportToDelete}
        onClose={() => setReportToDelete(null)}
        onConfirm={handleDeleteReport}
        isLoading={isDeleting}
        title="Confirm Report Deletion"
        description="Are you sure you want to delete this infrastructure report? This action will remove the record from high-command intelligence logs permanently."
      />
    </div>
  );
}
