import { useState, useEffect, Fragment } from "react";
import { useAuthStore } from "../store/authStore";
import { api } from "../lib/api";
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
  ArrowLeft,
  Camera,
  MapPin,
  List,
  Map as MapIcon,
  Filter,
  Calendar,
  ChevronLeft,
  Edit2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { PageHeader } from "../components/ui/page-header";
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

interface School {
  id: string;
  name: string;
}

interface IssueEntry {
  category: string[];
  description: string;
  files: File[];
}

interface SchoolReportingProps {
  schoolId?: string;
  hideHeader?: boolean;
}

export default function SchoolReporting({
  schoolId: propSchoolId,
  hideHeader,
}: SchoolReportingProps) {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<
    "report" | "history" | "analytics"
  >("report");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Selection state
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(
    propSchoolId || user?.location?.schoolId || "",
  );
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(
    null,
  );
  const [facilitiesDefinitions, setFacilitiesDefinitions] = useState<
    Facility[]
  >([]);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "warning" | null;
  }>({
    message: "",
    type: null,
  });

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
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

  // History Pagination & Filtering
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [historyDateRange, setHistoryDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null });

  // Delete & Edit State
  const [reportToDelete, setReportToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);

  useEffect(() => {
    fetchFacilitiesDefinitions();
    const targetSchoolId = propSchoolId || user?.location?.schoolId;
    if (targetSchoolId) {
      setSelectedSchoolId(targetSchoolId);
      fetchSchoolBuildings(targetSchoolId);
      setStep(2);
    } else {
      fetchSchools();
    }
  }, [propSchoolId, user?.location?.schoolId]);

  useEffect(() => {
    if (activeTab === "history") fetchHistory();
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
    setAnalyticsLoading(true);
    try {
      const params: any = {
        schoolId: selectedSchoolId,
        limit: 1000, // Get a larger set for analytics trend calculation
      };
      if (analyticsRange.startDate)
        params.startDate = analyticsRange.startDate.toISOString();
      if (analyticsRange.endDate)
        params.endDate = analyticsRange.endDate.toISOString();

      const res = await api.get("/reports", { params });
      // Extract data array from paginated response { data: [], total: x }
      const reportsArray = res.data.data || res.data || [];
      setAllReports(Array.isArray(reportsArray) ? reportsArray : []);
    } catch (err) {
      console.error("Failed to fetch analytics", err);
      setAllReports([]); // Safety fallback
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const showToast = (message: string, type: "success" | "warning") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: null }), 5000);
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

      showToast(`Status updated to ${status.replace("_", " ")}`, "success");
      fetchHistory(); // Refresh history tab as well
    } catch (err) {
      console.error("Failed to update report status", err);
      showToast("Failed to update status", "warning");
      throw err;
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const fetchHistory = async () => {
    if (!user?.id) return;
    setHistoryLoading(true);
    try {
      const params: any = {
        reportedBy: user.id,
        page: historyPage,
        limit: historyLimit,
      };

      if (statusFilter !== "ALL") {
        params.status = statusFilter;
      }

      if (historyDateRange.start) {
        params.startDate = historyDateRange.start.toISOString();
      }

      if (historyDateRange.end) {
        params.endDate = historyDateRange.end.toISOString();
      }

      const res = await api.get("/reports", { params });

      // Backend now returns { data, total }
      if (res.data && res.data.data) {
        setHistory(res.data.data);
        setHistoryTotal(res.data.total);
      } else {
        setHistory(res.data || []);
        setHistoryTotal(res.data?.length || 0);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/reports/${reportToDelete.id}`);
      showToast("Report deleted successfully", "success");
      fetchHistory();
      setReportToDelete(null);
    } catch (err) {
      console.error("Failed to delete report", err);
      showToast("Failed to delete report", "warning");
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

      showToast("Edit mode: Update incident details", "success");
    } catch (err) {
      console.error("Failed to prepare edit mode", err);
      showToast("Failed to enter edit mode", "warning");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const setIsHistoryLoading = (val: boolean) => setHistoryLoading(val); // simple wrapper

  const fetchSchools = async () => {
    try {
      const res = await api.get("/schools");
      setSchools(res.data.data || []);
    } catch (err) {
      console.error("Failed to load schools", err);
    }
  };

  const fetchSchoolBuildings = async (schoolId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/schools/${schoolId}`);
      setSelectedSchoolDetails(res.data);
      setBuildings(res.data.buildings || []);
    } catch (err) {
      console.error("Failed to load school buildings", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFacilitiesDefinitions = async () => {
    try {
      const res = await api.get("/schools/facilities");
      setFacilitiesDefinitions(res.data || []);
    } catch (err) {
      console.error("Failed to load facility definitions", err);
    }
  };

  const handleSchoolSelect = (id: string) => {
    setSelectedSchoolId(id);
    fetchSchoolBuildings(id);
    setStep(2);
  };

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
    if (currentIssue.category.length === 0 && !currentIssue.description) return;
    setIssues([...issues, { ...currentIssue }]);
    setCurrentIssue({ category: [], description: "", files: [] });
  };

  const removeIssue = (index: number) => {
    setIssues(issues.filter((_, i) => i !== index));
  };

  const uploadFilesToExternalServer = async (files: File[]) => {
    if (!files.length) return [];

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("File server upload failed");

    const data = await response.json();
    // data.urls are relative /files/... paths — use as-is
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
        showToast("Report updated successfully", "success");
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
        showToast("Report submitted successfully!", "success");
      }

      setIssues([]);
      setCurrentIssue({ category: [], description: "", files: [] });
      setSubmittedReportId("success");
      setSubmissionStatus("success");
      showToast("Report submitted successfully!", "success");
      fetchHistory(); // Reload history
    } catch (err) {
      console.error("Failed to submit report", err);
      setSubmissionStatus("error");
      showToast("Failed to submit report. Please try again.", "warning");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    const schoolId = propSchoolId || user?.location?.schoolId;
    if (schoolId) {
      setSelectedSchoolId(schoolId);
      fetchSchoolBuildings(schoolId);
      setStep(2);
    } else {
      setSelectedSchoolId("");
      setStep(1);
    }
    setIssues([]);
    setSubmittedReportId(null);
    setSelectedBuilding(null);
    setSelectedFacility(null);
    setSelectedItem(null);
    setCurrentIssue({
      description: "",
      category: [],
      files: [],
    });
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
          className="relative bg-card p-10 rounded-[50px] border border-border/10 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] max-w-md w-full text-center overflow-hidden"
        >
          <ImigongoPattern className="absolute inset-0 text-primary pointer-events-none opacity-[0.03]" />

          <div className="relative z-10 space-y-6">
            <div
              className={cn(
                "w-24 h-24 rounded-[40px] mx-auto flex items-center justify-center",
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
              <h3 className="text-3xl font-black uppercase tracking-tighter">
                {isSuccess ? "Transmission Confirmed" : "Transmission Fault"}
              </h3>
              <p className="text-xs font-bold text-muted-foreground uppercase opacity-60 leading-relaxed">
                {isSuccess
                  ? "Your infrastructure report has been securely synchronized with the central maintenance database. Engineering teams will be notified immediately."
                  : "We encountered a synchronization error while attempting to securely transmit your record. Please verify your connection and try again."}
              </p>
            </div>

            <div className="pt-4 flex flex-col gap-3">
              <Button
                onClick={() => {
                  setSubmissionStatus(null);
                  if (isSuccess) resetForm();
                }}
                className={cn(
                  "rounded-full h-14 text-[11px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95",
                  isSuccess
                    ? "bg-primary shadow-primary/20"
                    : "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20",
                )}
              >
                {isSuccess ? "Continue Reporting" : "Retry Submission"}
              </Button>

              {isSuccess && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSubmissionStatus(null);
                    setActiveTab("history");
                  }}
                  className="rounded-full h-12 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 hover:bg-primary/5 transition-all"
                >
                  View Transmission Log
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderSubmissionReview = () => (
    <div className="space-y-6">
      <div className="bg-primary/5 p-8 rounded-[40px] border border-primary/10 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
          <ClipboardList className="w-24 h-24 text-primary" />
        </div>
        <div className="relative z-10">
          <Badge className="bg-primary/20 text-primary border-none text-[8px] font-black uppercase rounded-full px-3 py-1 mb-4">
            Validation Phase
          </Badge>
          <h3 className="text-3xl font-black uppercase tracking-tighter leading-none mb-2">
            Final Reporting Authority
          </h3>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-80">
            Verify all critical signatures before dispatching dispatch
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        <div className="lg:col-span-4 order-2 lg:order-1 space-y-4">
          <Card className="p-8 rounded-[40px] border border-border/10 bg-card/30 backdrop-blur-xl relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-linear-to-r from-primary/50 to-transparent"></div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-8 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Deployment Context
            </h4>

            <div className="space-y-6">
              {[
                {
                  label: "Mission School",
                  value: schools.find((s) => s.id === selectedSchoolId)?.name,
                  icon: <SchoolIcon className="w-4 h-4" />,
                },
                {
                  label: "Target Block/Building",
                  value: selectedBuilding?.name,
                  icon: <Building2 className="w-4 h-4" />,
                },
                {
                  label: "Operations Unit",
                  value: `${selectedFacility?.title || "N/A"} • ${selectedItem?.label || "General"}`,
                  icon: <Layers className="w-4 h-4" />,
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center shrink-0 border border-border/5 group-hover:bg-primary group-hover:text-primary transition-all">
                    {item.icon}
                  </div>
                  <div className="space-y-1">
                    <div className="text-[8px] font-black uppercase text-muted-foreground tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
                      {item.label}
                    </div>
                    <div className="text-sm font-black truncate max-w-[200px] group-hover:translate-x-1 transition-transform">
                      {item.value || "Incomplete Reference"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={() => setStep(2)}
              className="w-full mt-8 rounded-full h-12 text-[9px] font-black uppercase tracking-widest border-2 border-border/10 hover:border-primary/40 hover:bg-primary/5 transition-all"
            >
              Modify Location
            </Button>
          </Card>
        </div>

        <div className="lg:col-span-8 order-1 lg:order-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-3">
              Incidents Catalog ({issues.length})
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(5)}
              className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary/10 hover:text-primary transition-all rounded-full h-8"
            >
              <Plus className="w-3 h-3" /> Add More
            </Button>
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar pr-2 pb-4">
            <AnimatePresence mode="popLayout">
              {issues.map((issue, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card className="p-6 rounded-[35px] border border-border/10 bg-card/40 backdrop-blur-md hover:border-primary/30 transition-all flex gap-5 group relative overflow-hidden">
                    <div className="w-12 h-12 rounded-2xl bg-background/50 border border-border/5 flex items-center justify-center shrink-0 text-xs font-black text-muted-foreground group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                      {idx + 1}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-wrap gap-1">
                          {issue.category.map((cat) => (
                            <Badge
                              key={cat}
                              className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase rounded-full px-3"
                            >
                              {cat}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-3">
                          {issue.files?.length > 0 && (
                            <Badge
                              variant="outline"
                              className="rounded-full text-[8px] font-black border-primary/20 text-primary/80"
                            >
                              {issue.files.length} Signatures
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                            onClick={() => removeIssue(idx)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs font-bold leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                        {issue.description}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="pt-4">
            <Button
              className={cn(
                "w-max rounded-full py-3 text-[12px] font-black uppercase tracking-[0.3em] shadow-2xl transition-all",
                isSubmitting
                  ? "bg-muted"
                  : "bg-primary hover:scale-[1.01] active:scale-[0.98] shadow-primary/30",
              )}
              onClick={handleSubmit}
              disabled={isSubmitting || issues.length === 0}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Dispatching Authority...
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5" /> Secure Submission
                </div>
              )}
            </Button>
            <p className="text-center text-[8px] font-black uppercase tracking-widest text-muted-foreground mt-4 opacity-40">
              Confirming this action will create a permanent audit log in the
              RTB Intelligence engine.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSuccessView = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-xl mx-auto py-20 text-center space-y-8"
    >
      <div className="w-24 h-24 bg-green-500/10 rounded-[35px] flex items-center justify-center mx-auto border border-green-500/20 shadow-2xl shadow-green-500/20 relative">
        <div className="absolute inset-0 bg-green-500/20 rounded-[35px] animate-ping opacity-20" />
        <CheckCircle2 className="w-12 h-12 text-green-500" />
      </div>
      <div className="space-y-3">
        <h3 className="text-4xl font-black uppercase tracking-tighter">
          Transmission Confirmed
        </h3>
        <p className="text-sm font-black text-muted-foreground uppercase tracking-widest opacity-60">
          Report Reference:{" "}
          <span className="text-primary">
            {submittedReportId?.slice(0, 8) || "Processing"}
          </span>
        </p>
      </div>
      <Card className="bg-card/30 backdrop-blur-xl p-8 rounded-[40px] border border-border/10 shadow-2xl overflow-hidden relative group text-left">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <ImigongoPattern className="w-32 h-32" />
        </div>
        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">
          Current Status
        </p>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-blue-500/50" />
          <p className="text-sm font-black uppercase tracking-tight">
            Queued for HQ Intelligence Review
          </p>
        </div>
        <p className="text-xs font-bold text-muted-foreground opacity-80 leading-relaxed">
          This report has been successfully dispatched to the regional
          monitoring authority. You will be notified of its categorization once
          reviewed by the centralized structural intelligence team.
        </p>
      </Card>
      <div className="flex gap-4 pt-4">
        <Button
          className="flex-1 rounded-full h-14 font-black uppercase text-[10px] tracking-widest bg-primary shadow-xl shadow-primary/20"
          onClick={resetForm}
        >
          New Report
        </Button>
        <Button
          variant="outline"
          className="flex-1 rounded-full h-14 font-black uppercase text-[10px] tracking-widest border-2 border-border/10 hover:bg-primary/5 transition-all"
          onClick={() => setActiveTab("history")}
        >
          View History
        </Button>
      </div>
    </motion.div>
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
        return "bg-slate-500/10 text-slate-500 border-slate-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: 1, label: "School" },
      { id: 2, label: "Location" },
      { id: 3, label: "Facility" },
      { id: 4, label: "Target" },
      { id: 5, label: "Details" },
      { id: 6, label: "Review" },
    ];

    return (
      <div className="flex items-center justify-between max-w-2xl mx-auto px-2 md:px-4">
        {steps.map((s, idx) => {
          const isCompleted = step > s.id;
          const isActive = step === s.id;
          return (
            <Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1.5 md:gap-2 group shrink-0">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isActive ? 1.15 : 1,
                  }}
                  className={cn(
                    "w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[10px] md:text-xs font-black transition-all relative z-10 shadow-sm",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-primary/20"
                      : isCompleted
                        ? "bg-white dark:bg-green-700/20 text-green-600 border border-green-600/60"
                        : "bg-muted dark:bg-muted/50 text-muted-foreground",
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                  ) : (
                    s.id
                  )}
                </motion.div>
                <span
                  className={cn(
                    "text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-colors hidden sm:block",
                    isActive ? "text-primary" : "text-muted-foreground/50",
                  )}
                >
                  {s.label}
                </span>
                {isActive && (
                  <span className="text-[7px] font-black uppercase tracking-widest text-primary block sm:hidden">
                    Step {s.id}
                  </span>
                )}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-[2px] mb-4 md:mb-6 mx-1 md:mx-2 rounded-full transition-colors",
                    isCompleted ? "bg-emerald-500" : "bg-muted/30",
                  )}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    );
  };

  const renderToast = () => (
    <AnimatePresence>
      {toast.type && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          className={cn(
            "fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-3",
            toast.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
              : "bg-amber-500/10 border-amber-500/20 text-amber-500",
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">
            {toast.message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative min-h-screen py-6 pt-0 space-y-4 overflow-hidden">
      <AnimatePresence>
        {selectedReport && (
          <ReportDetailsModal
            report={selectedReport}
            onClose={() => setSelectedReport(null)}
            onUpdateStatus={handleUpdateReportStatus}
            isUpdating={isStatusUpdating}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{renderStatusModal()}</AnimatePresence>
      {renderToast()}
      <ImigongoPattern className="absolute top-0 right-0 w-64 h-64 text-primary pointer-events-none rotate-12 opacity-5" />

      {!hideHeader && (
        <PageHeader
          title="Infrastructure Care"
          description="Monitor and report facility maintenance issues across campus."
          icon={ClipboardList}
          actions={
            <div className="bg-muted/50 backdrop-blur-md p-1 rounded-full border border-border/5 flex gap-1">
              {[
                { id: "report", label: "New Report", count: null },
                { id: "history", label: "History", count: history.length },
                { id: "analytics", label: "Analytics", count: null },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/5",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          }
        />
      )}

      <div className="relative z-10">
        {activeTab === "report" ? (
          <div className="max-w-6xl mx-auto">
            {step < 7 && <div className="mb-5">{renderStepIndicator()}</div>}

            <AnimatePresence mode="wait">
              {/* STEP 1: School Selection */}
              {step === 1 && !user?.location?.schoolId && (
                <motion.div
                  key="step1"
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -30, opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <h3 className="text-base font-bold uppercase tracking-tighter">
                      Identify Your School
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {schools.map((s) => (
                      <motion.div
                        key={s.id}
                        whileHover={{ y: -2 }}
                        onClick={() => handleSchoolSelect(s.id)}
                      >
                        <Card
                          className={cn(
                            "cursor-pointer group relative overflow-hidden h-24 flex items-center justify-between px-5 rounded-3xl border-2 transition-all",
                            selectedSchoolId === s.id
                              ? "border-primary bg-primary/5"
                              : "border-border/10 hover:border-primary/20",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                              <SchoolIcon className="w-5 h-5" />
                            </div>
                            <div className="font-black text-sm truncate pr-6">
                              {s.name}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Building Selection */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -30, opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-6 mb-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep(1)}
                      className="rounded-full h-10 w-10 p-0 font-black uppercase text-[9px] bg-white dark:bg-gray-900 hover:bg-primary hover:text-white shrink-0 border border-border/10"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex-1">
                      <h3 className="text-base font-bold uppercase tracking-tighter">
                        Locate Block
                      </h3>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase opacity-60">
                        {selectedSchoolDetails?.name || "School Infrastructure"}{" "}
                        · Step 2 of 6
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-muted/50 p-1 rounded-full flex gap-1 border border-border/10">
                        <Button
                          variant={step2Tab === "list" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setStep2Tab("list")}
                          className="rounded-full h-8 px-4 text-[9px] font-black uppercase tracking-widest transition-all"
                        >
                          <List className="w-3.5 h-3.5 mr-2" /> List
                        </Button>
                        <Button
                          variant={step2Tab === "map" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setStep2Tab("map")}
                          className="rounded-full h-8 px-4 text-[9px] font-black uppercase tracking-widest transition-all"
                        >
                          <MapIcon className="w-3.5 h-3.5 mr-2" /> Map
                        </Button>
                      </div>
                    </div>
                  </div>

                  {loading ? (
                    <div className="py-10 text-center space-y-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Loading school data...
                      </p>
                    </div>
                  ) : step2Tab === "map" ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-3xl overflow-hidden border-2 border-border/10 h-[600px] relative bg-card/20 backdrop-blur-md"
                    >
                      {selectedSchoolDetails ? (
                        <SchoolMap
                          school={selectedSchoolDetails}
                          buildings={buildings}
                          isEmbed
                          onSelectBuilding={(b) => handleBuildingSelect(b)}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <AlertCircle className="w-5 h-5 text-muted-foreground mr-2" />
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-50">
                            GIS data unavailable
                          </span>
                        </div>
                      )}
                    </motion.div>
                  ) : buildings.length === 0 ? (
                    <Card className="bg-card/30 backdrop-blur-md p-10 rounded-3xl text-center border-dashed border-2 border-border/20">
                      <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
                      <h4 className="text-lg font-black mb-2 uppercase">
                        No Infrastructure Data
                      </h4>
                      <p className="text-muted-foreground text-xs max-w-sm mx-auto mb-6">
                        GIS verification pending for this location.
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStep(1)}
                        className="rounded-full h-10 px-6 font-black uppercase text-[10px] transition-all hover:bg-primary/10"
                      >
                        Go Back
                      </Button>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {buildings.map((b) => (
                        <Card
                          key={b.id}
                          onClick={() => handleBuildingSelect(b)}
                          className={cn(
                            "group cursor-pointer p-5 rounded-3xl border-2 transition-all active:scale-95 flex items-center justify-between",
                            selectedBuilding?.id === b.id
                              ? "bg-primary/5 border-primary shadow-primary/10"
                              : "bg-white dark:bg-card/40 border-slate-100 dark:border-border/5 hover:border-primary/20 hover:bg-primary/5",
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-muted/50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                              <Building2 className="w-7 h-7" />
                            </div>
                            <div className="text-left">
                              <div className="font-black text-sm mb-1 uppercase tracking-tight line-clamp-2">
                                {b.name}
                              </div>
                              <div className="text-[9px] font-black text-muted-foreground uppercase opacity-50 tracking-widest flex items-center gap-2">
                                <MapPin className="w-2.5 h-2.5" />{" "}
                                {b.facilities?.length || 0} Critical Facilities
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                        </Card>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* STEP 3: Facility Selection */}
              {step === 3 && selectedBuilding && (
                <motion.div
                  key="step3"
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -30, opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep(2)}
                      className="rounded-full h-10 w-10 p-0 font-black uppercase text-[9px] bg-white dark:bg-gray-900 hover:bg-primary hover:text-white shrink-0 border border-border/10"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                      <h3 className="text-base font-bold uppercase tracking-tighter">
                        Locate Facility
                      </h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                        {selectedBuilding?.name} · Step 3 of 6
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedBuilding.facilities?.map((f: any) => (
                      <Card
                        key={f.facility_id}
                        className="cursor-pointer group bg-card dark:bg-card/40 rounded-[28px] border-2 border-border/10 hover:border-primary/40 transition-all p-5 flex items-center gap-4 active:scale-[0.98]"
                        onClick={() => handleFacilitySelect(f)}
                      >
                        <div className="w-12 h-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                          <Layers className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="font-black uppercase text-[10px] tracking-widest truncate">
                            {f.facility_name}
                          </div>
                          <div className="text-[8px] font-bold text-muted-foreground uppercase opacity-50">
                            Engineering Unit
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-40 group-hover:opacity-100 transition-all" />
                      </Card>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* STEP 4: Item/Target Selection */}
              {step === 4 && selectedFacility && (
                <motion.div
                  key="step4"
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -30, opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep(3)}
                      className="rounded-full h-10 w-10 p-0 font-black uppercase text-[9px] bg-white dark:bg-gray-900 hover:bg-primary hover:text-white shrink-0 border border-border/10"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                      <h3 className="text-base font-bold uppercase tracking-tighter">
                        Select Target
                      </h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                        {(selectedFacility as any)?.facility_name || "Facility"}{" "}
                        · Step 4 of 6
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedFacility.items.map((item) => (
                      <Card
                        key={item.id}
                        className="cursor-pointer group bg-card dark:bg-card/40 rounded-[28px] border-2 border-border/10 hover:border-primary/40 transition-all p-5 flex items-center gap-4 active:scale-[0.98]"
                        onClick={() => handleItemSelect(item)}
                      >
                        <div className="w-12 h-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                          <Check className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="font-black uppercase text-[10px] tracking-widest truncate">
                            {item.label}
                          </div>
                          <div className="text-[8px] font-bold text-muted-foreground uppercase opacity-50">
                            Structural Point
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-40 group-hover:opacity-100 transition-all" />
                      </Card>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* STEP 5: Details/Evidence */}
              {step === 5 && selectedItem && (
                <motion.div
                  key="step5"
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -30, opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep(4)}
                      className="rounded-full h-10 w-10 p-0 font-black uppercase text-[9px] bg-white dark:bg-gray-900 hover:bg-primary hover:text-white shrink-0 border border-border/10"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                      <h3 className="text-base font-bold uppercase tracking-tighter">
                        {isEditing ? "Modify Incident" : "Incident Details"}
                      </h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                        {selectedItem.label} ·{" "}
                        {isEditing ? "Update Logic" : "Final Step"}
                      </p>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-3xl mb-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-tighter text-amber-500">
                            Edit Mode Active
                          </p>
                          <p className="text-[8px] font-bold uppercase text-amber-500/60">
                            You are modifying a submitted report. Submit to save
                            changes.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditing(false);
                          resetForm();
                        }}
                        className="rounded-full h-8 px-4 text-[9px] font-black uppercase tracking-widest text-amber-500 hover:bg-amber-500/10"
                      >
                        Cancel Edit
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    <div className="space-y-6">
                      <Card className="bg-card/40 backdrop-blur-md p-6 rounded-[35px] border border-border/10 relative overflow-hidden group">
                        <ImigongoPattern
                          className="absolute inset-0 text-primary pointer-events-none"
                          opacity={0.03}
                        />

                        <div className="space-y-4 relative z-10">
                          <div className="space-y-2">
                            <div className="space-y-4">
                              <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10">
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-3 mb-2">
                                  <AlertCircle className="w-4 h-4" /> Critical:
                                  Choose Issue Type
                                </h4>
                                <p className="text-[9px] font-bold text-muted-foreground opacity-80 uppercase leading-snug">
                                  Every incident must be categorized to alert
                                  the correct engineering response team. Please
                                  select one below:
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2.5 pt-2">
                                {selectedItem.issueCategories?.map(
                                  (cat: string) => (
                                    <button
                                      key={cat}
                                      type="button"
                                      onClick={() => {
                                        const isSelected =
                                          currentIssue.category.includes(cat);
                                        setCurrentIssue({
                                          ...currentIssue,
                                          category: isSelected
                                            ? currentIssue.category.filter(
                                                (c) => c !== cat,
                                              )
                                            : [...currentIssue.category, cat],
                                        });
                                      }}
                                      className={cn(
                                        "px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border-2",
                                        currentIssue.category.includes(cat)
                                          ? "bg-primary border-primary text-white shadow-primary/20 scale-[1.05]"
                                          : "bg-white dark:bg-gray-900 border-border text-muted-foreground hover:border-primary/30 hover:bg-primary/5",
                                      )}
                                    >
                                      {cat}
                                    </button>
                                  ),
                                )}
                              </div>
                            </div>
                          </div>

                          <Textarea
                            className="min-h-[140px] text-[13px] rounded-2xl bg-background/30 border-2 border-border focus:border-primary/40"
                            placeholder="Problem description... be as specific as possible"
                            value={currentIssue.description}
                            onChange={(e) =>
                              setCurrentIssue({
                                ...currentIssue,
                                description: e.target.value,
                              })
                            }
                          />
                        </div>
                      </Card>
                    </div>

                    <div className="space-y-4">
                      <Card className="bg-card/40 backdrop-blur-md p-6 rounded-[35px] border border-border/10 space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                          <Camera className="w-3.5 h-3.5" /> Visual Evidence
                        </h4>
                        <FileUploader
                          maxFiles={3}
                          onFilesSelected={(files) =>
                            setCurrentIssue({ ...currentIssue, files })
                          }
                        />
                      </Card>

                      <div className="flex gap-3 pt-2">
                        <Button
                          variant="outline"
                          className="flex-1 rounded-full h-12 text-[10px] font-black uppercase tracking-widest border-2 hover:bg-primary/5 transition-all"
                          onClick={() => {
                            addIssue();
                            showToast("Issue added to list", "success");
                          }}
                          disabled={
                            !currentIssue.description ||
                            currentIssue.category.length === 0
                          }
                        >
                          <Plus className="mr-2 w-3.5 h-3.5 text-primary" /> Add
                          To List
                        </Button>
                        <Button
                          className="flex-1 rounded-full h-12 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 bg-primary group"
                          onClick={() => {
                            if (
                              currentIssue.description &&
                              currentIssue.category
                            )
                              addIssue();
                            setStep(6);
                          }}
                          disabled={
                            isSubmitting ||
                            (issues.length === 0 &&
                              (!currentIssue.description ||
                                !currentIssue.category))
                          }
                        >
                          Review & Submit
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 6: Review & Approve */}
              {step === 6 && (
                <motion.div
                  key="step6"
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -30, opacity: 0 }}
                  className="space-y-6"
                >
                  {renderSubmissionReview()}
                </motion.div>
              )}

              {/* STEP 7: Success View */}
              {step === 7 && (
                <motion.div
                  key="step7"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {renderSuccessView()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : activeTab === "history" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* History Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-4">
              <div className="md:col-span-4 space-y-2">
                <label className="text-[10px] font-black uppercase text-primary tracking-widest pl-2 flex items-center gap-2">
                  <Filter className="w-3 h-3" /> Filter by Status
                </label>
                <RichDropdown
                  options={[
                    { label: "ALL REPORTS", value: "ALL" },
                    { label: "PENDING REVIEW", value: "PENDING" },
                    { label: "SOLVED / CLOSED", value: "SOLVED" },
                    { label: "CRITICAL PRIORITY", value: "NEED_INTERVENTION" },
                    { label: "FAILED / INVALID", value: "FAILED" },
                  ]}
                  value={statusFilter}
                  onChange={(val) => {
                    setStatusFilter(val);
                    setHistoryPage(1);
                  }}
                  className="rounded-3xl"
                />
              </div>

              <div className="md:col-span-4 space-y-2">
                <label className="text-[10px] font-black uppercase text-primary tracking-widest pl-2 flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> Date Range
                </label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    className="rounded-2xl h-11 text-[10px] font-bold"
                    onChange={(e) =>
                      setHistoryDateRange((prev) => ({
                        ...prev,
                        start: e.target.value ? new Date(e.target.value) : null,
                      }))
                    }
                  />
                  <Input
                    type="date"
                    className="rounded-2xl h-11 text-[10px] font-bold"
                    onChange={(e) =>
                      setHistoryDateRange((prev) => ({
                        ...prev,
                        end: e.target.value ? new Date(e.target.value) : null,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="md:col-span-4 flex justify-end pb-0.5">
                <div className="bg-muted/30 p-1.5 rounded-full border border-border/10 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    className="rounded-full h-8 w-8 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-[10px] font-black px-4 uppercase tracking-widest">
                    Page {historyPage} of{" "}
                    {Math.ceil(historyTotal / historyLimit) || 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      historyPage >= Math.ceil(historyTotal / historyLimit)
                    }
                    onClick={() => setHistoryPage((p) => p + 1)}
                    className="rounded-full h-8 w-8 p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                {[1, 2, 3, 4].map((n) => (
                  <Card
                    key={n}
                    className="bg-card/30 rounded-[35px] border-2 border-border/10 p-8 space-y-4"
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
            ) : history.length === 0 ? (
              <Card className="bg-card/30 backdrop-blur-md p-20 rounded-[40px] text-center border-dashed border-2 border-border/20">
                <ClipboardList className="w-16 h-16 text-muted-foreground/30 mx-auto mb-6" />
                <h3 className="text-base font-bold uppercase tracking-tighter mb-2">
                  No Reports Yet
                </h3>
                <p className="text-muted-foreground font-medium mb-8">
                  You haven't submitted any facility reports yet.
                </p>
                <Button
                  onClick={() => setActiveTab("report")}
                  className="rounded-full px-8 h-12 font-black uppercase text-xs"
                >
                  Start Reporting
                </Button>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Desktop Table View */}
                <div className="hidden md:block rounded-3xl border-2 border-border/10 overflow-hidden bg-card/30 backdrop-blur-md">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-dashed">
                        <TableHead>Date</TableHead>
                        <TableHead>Asset / Target</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Log Summary</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((record) => (
                        <TableRow
                          key={record.id}
                          className="group/row hover:bg-primary/5 cursor-pointer transition-colors border-border/5"
                          onClick={() => setSelectedReport(record)}
                        >
                          <TableCell>
                            <div className="text-[10px] font-black text-muted-foreground opacity-50">
                              {new Date(record.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="text-[11px] font-black uppercase tracking-tight truncate max-w-[150px]">
                                {record.facilityId}
                              </div>
                              <div className="text-[9px] font-bold text-primary opacity-70">
                                {record.itemId}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(record.issueCategory) ? (
                                record.issueCategory.map((cat: string) => (
                                  <Badge
                                    key={cat}
                                    variant="outline"
                                    className="text-[8px] font-black uppercase rounded-full px-2"
                                  >
                                    {cat}
                                  </Badge>
                                ))
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[8px] font-black uppercase rounded-full px-2"
                                >
                                  {record.issueCategory || "General"}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-[11px] font-medium line-clamp-1 max-w-[200px] text-muted-foreground">
                              {record.description}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "rounded-full font-black text-[8px] px-2.5 py-0.5 border capitalize",
                                getStatusColor(record.status),
                              )}
                            >
                              {record.status.toLowerCase().replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2 pr-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditReport(record);
                                }}
                                className="h-8 w-8 rounded-full p-0 flex items-center justify-center hover:bg-primary/10 transition-all text-primary"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReportToDelete(record);
                                }}
                                className="h-8 w-8 rounded-full p-0 flex items-center justify-center hover:bg-rose-500/10 transition-all text-rose-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>

                              {record.attachments &&
                                record.attachments.length > 0 && (
                                  <Button
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
                                    <Camera className="w-3.5 h-3.5" />
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
                  {history.map((record) => (
                    <Card
                      key={record.id}
                      onClick={() => setSelectedReport(record)}
                      className="p-5 rounded-[28px] border-2 border-border/5 bg-card/40 active:scale-[0.98] transition-all space-y-4"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <ClipboardList className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                              Ref: #{record.id.split("-").pop()}
                            </div>
                            <div className="text-xs font-black uppercase tracking-tight">
                              {record.facilityId || "Main Structure"}
                            </div>
                          </div>
                        </div>
                        <Badge
                          className={cn(
                            "rounded-full font-black text-[7px] px-2 py-0.5 border capitalize",
                            getStatusColor(record.status),
                          )}
                        >
                          {record.status?.toLowerCase().replace(/_/g, " ")}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(record.issueCategory) ? (
                          record.issueCategory.map((cat: string) => (
                            <Badge
                              key={cat}
                              variant="outline"
                              className="rounded-full text-[7px] font-black uppercase px-2 border-primary/20 text-primary"
                            >
                              {cat}
                            </Badge>
                          ))
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-full text-[7px] font-black uppercase px-2 border-primary/20 text-primary"
                          >
                            {record.issueCategory || "Uncategorized"}
                          </Badge>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-border/5">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditReport(record);
                              }}
                            >
                              <Edit2 className="w-3 h-3 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReportToDelete(record);
                              }}
                            >
                              <Trash2 className="w-3 h-3 text-rose-500" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-4 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-full"
                          >
                            Details <ChevronRight className="ml-1 w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                  <div className="p-10 text-center border-t border-dashed border-border/10">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      End of history log · Total {history.length} records
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <ReportAnalytics
            reports={allReports}
            buildings={buildings}
            facilities={facilitiesDefinitions}
            loading={analyticsLoading}
            range={analyticsRange}
            onRangeChange={setAnalyticsRange}
            onUpdateStatus={handleUpdateReportStatus}
          />
        )}
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
              className="relative bg-card p-4 rounded-[40px] border border-border/20 shadow-2xl max-w-4xl w-full z-10"
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
                  className="rounded-full"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-4 no-scrollbar">
                {selectedGalleryImages.map((img: string, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-3xl overflow-hidden border border-border/10 aspect-video relative group"
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
                      <Badge className="bg-white/20 backdrop-blur-md border-white/30 text-white font-black uppercase text-[10px]">
                        Evidence #{idx + 1}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 text-center">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
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
