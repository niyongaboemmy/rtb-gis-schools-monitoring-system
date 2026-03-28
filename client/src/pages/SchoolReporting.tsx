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
  category: string;
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

  // Form state
  const [issues, setIssues] = useState<IssueEntry[]>([]);
  const [currentIssue, setCurrentIssue] = useState<IssueEntry>({
    category: "",
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
  }, [activeTab, analyticsRange, selectedSchoolId]);

  const fetchAnalyticsData = async () => {
    if (!selectedSchoolId) return;
    setAnalyticsLoading(true);
    try {
      const params: any = { schoolId: selectedSchoolId };
      if (analyticsRange.startDate)
        params.startDate = analyticsRange.startDate.toISOString();
      if (analyticsRange.endDate)
        params.endDate = analyticsRange.endDate.toISOString();

      const res = await api.get("/reports", { params });
      setAllReports(res.data || []);
    } catch (err) {
      console.error("Failed to fetch analytics", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const showToast = (message: string, type: "success" | "warning") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: null }), 5000);
  };

  const handleUpdateReportStatus = async (reportId: string, status: string) => {
    try {
      await api.patch(`/reports/${reportId}/status`, { status });
      // Optimistic update
      setAllReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status } : r)),
      );
    } catch (err) {
      console.error("Failed to update report status", err);
      throw err;
    }
  };

  const fetchHistory = async () => {
    if (!user?.id) return;
    setHistoryLoading(true);
    try {
      const res = await api.get("/reports", {
        params: { reportedBy: user.id },
      });
      setHistory(res.data || []);
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setHistoryLoading(false);
    }
  };

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
    if (!currentIssue.category && !currentIssue.description) return;
    setIssues([...issues, { ...currentIssue }]);
    setCurrentIssue({ category: "", description: "", files: [] });
  };

  const removeIssue = (index: number) => {
    setIssues(issues.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const finalIssues = [...issues];
    if (currentIssue.category || currentIssue.description) {
      finalIssues.push(currentIssue);
    }
    if (issues.length === 0 && !currentIssue.description) {
      showToast("Please add at least one issue.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const allIssues =
        issues.length > 0
          ? issues
          : [
              {
                ...currentIssue,
                schoolId: selectedSchoolId,
                buildingId: selectedBuilding?.id,
                facilityId: (selectedFacility as any)?.facility_id,
              },
            ];

      for (const issue of allIssues) {
        const formData = new FormData();
        formData.append("schoolId", selectedSchoolId!);
        formData.append("buildingId", selectedBuilding?.id || "");
        formData.append(
          "facilityId",
          (selectedFacility as any)?.facility_id || "",
        );
        formData.append("itemId", selectedItem?.id || "");
        formData.append("description", issue.description);
        formData.append("issueCategory", issue.category || "");

        if (issue.files && issue.files.length > 0) {
          issue.files.forEach((file: File) => {
            formData.append("attachments", file);
          });
        }

        await api.post("/reports", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      showToast("Reports submitted successfully!", "success");
      resetForm();
      fetchAnalyticsData();
    } catch (error) {
      console.error("Submission failed:", error);
      showToast("Failed to submit reports. Please try again.", "warning");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(user?.location?.schoolId ? 2 : 1);
    setSelectedSchoolId(user?.location?.schoolId || "");
    setSelectedBuilding(null);
    setSelectedFacility(null);
    setSelectedItem(null);
    setIssues([]);
    setCurrentIssue({
      description: "",
      category: "",
      files: [],
    });
  };

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
      <div className="flex items-center justify-between mb-8 max-w-2xl mx-auto px-4">
        {steps.map((s, idx) => (
          <Fragment key={s.id}>
            <div className="flex flex-col items-center gap-2 group">
              <motion.div
                initial={false}
                animate={{
                  scale: step === s.id ? 1.1 : 1,
                  backgroundColor:
                    step === s.id
                      ? "var(--primary)"
                      : step > s.id
                        ? "var(--emerald-500)"
                        : "var(--muted)",
                }}
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black transition-all shadow-md relative z-10",
                  step === s.id
                    ? "text-primary-foreground shadow-primary/20"
                    : "text-muted-foreground shadow-none",
                )}
              >
                {step > s.id ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  s.id
                )}
              </motion.div>
              <span
                className={cn(
                  "text-[8px] font-black uppercase tracking-widest transition-colors",
                  step === s.id ? "text-primary" : "text-muted-foreground/50",
                )}
              >
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-[2px] mb-6 mx-2 rounded-full transition-colors",
                  step > s.id ? "bg-emerald-500" : "bg-muted/30",
                )}
              />
            )}
          </Fragment>
        ))}
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
    <div className="relative min-h-screen py-6 px-4 md:px-8 space-y-6 overflow-hidden">
      {renderToast()}
      <ImigongoPattern className="absolute top-0 right-0 w-64 h-64 text-primary pointer-events-none rotate-12 opacity-5" />
      <ImigongoPattern className="absolute bottom-0 left-0 w-64 h-64 text-primary pointer-events-none -rotate-12 opacity-5" />

      {!hideHeader && (
        <PageHeader
          title="Infrastructure Care"
          description="Monitor and report facility maintenance issues across campus."
          icon={ClipboardList}
          actions={
            <div className="bg-muted/50 backdrop-blur-md p-1 rounded-xl border border-border/5 flex gap-1">
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
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/5",
                  )}
                >
                  {tab.label} {tab.count !== null && `(${tab.count})`}
                </button>
              ))}
            </div>
          }
        />
      )}

      <div className="max-w-6xl mx-auto relative z-10">
        {activeTab === "report" ? (
          <>
            <div className="mb-10">{renderStepIndicator()}</div>

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
                    <h3 className="text-2xl font-black uppercase tracking-tighter">
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
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-black uppercase tracking-tighter">
                      Where is the issue?
                    </h3>
                  </div>

                  {loading ? (
                    <div className="py-10 text-center space-y-4">
                      <Skeleton className="h-40 w-full rounded-3xl" />
                    </div>
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
                        className="rounded-full h-10 px-6 font-black uppercase text-[10px]"
                      >
                        Go Back
                      </Button>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {buildings.map((b) => (
                        <motion.div
                          key={b.id}
                          whileHover={{ y: -3 }}
                          onClick={() => handleBuildingSelect(b)}
                        >
                          <Card
                            className={cn(
                              "cursor-pointer h-full group relative overflow-hidden rounded-3xl border-2 transition-all p-5 flex flex-col items-center text-center",
                              selectedBuilding?.id === b.id
                                ? "border-primary bg-primary/5"
                                : "border-border/10 hover:border-primary/10",
                            )}
                          >
                            <div className="w-14 h-14 bg-muted/50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-all">
                              <Building2 className="w-7 h-7" />
                            </div>
                            <div className="font-black text-sm mb-1">
                              {b.name}
                            </div>
                            <div className="text-[9px] font-black text-muted-foreground uppercase opacity-50 tracking-widest">
                              {b.facilities?.length || 0} Facilities
                            </div>
                          </Card>
                        </motion.div>
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
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-black uppercase tracking-tighter">
                      Locate Facility
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep(2)}
                      className="rounded-full h-8 px-4 font-black uppercase text-[9px]"
                    >
                      <ArrowLeft className="w-3 h-3 mr-2 text-primary" /> Back
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {selectedBuilding.facilities?.map((f: any) => (
                      <Card
                        key={f.facility_id}
                        className="cursor-pointer group bg-card/40 rounded-2xl border border-border/10 hover:border-primary/40 transition-all p-4 flex items-center gap-3"
                        onClick={() => handleFacilitySelect(f)}
                      >
                        <div className="w-9 h-9 rounded-xl bg-primary/5 text-primary flex items-center justify-center">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div className="flex-1 font-black uppercase text-[10px] tracking-widest truncate">
                          {f.facility_name}
                        </div>
                      </Card>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* STEP 4: Item Selection */}
              {step === 4 && selectedFacility && (
                <motion.div
                  key="step4"
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -30, opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-black uppercase tracking-tighter">
                      Select Target
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep(3)}
                      className="rounded-full h-8 px-4 font-black uppercase text-[9px]"
                    >
                      <ArrowLeft className="w-3 h-3 mr-2 text-primary" /> Back
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {selectedFacility.items.map((item) => (
                      <Card
                        key={item.id}
                        className="cursor-pointer group hover:bg-primary/5 rounded-xl border border-border/10 hover:border-primary/30 transition-all p-3 flex items-center justify-between"
                        onClick={() => handleItemSelect(item)}
                      >
                        <div className="font-bold text-[11px] group-hover:text-primary transition-colors truncate pr-2">
                          {item.label}
                        </div>
                        <Plus className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0" />
                      </Card>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* STEP 5: Detailed Report */}
              {step === 5 && selectedItem && (
                <motion.div
                  key="step5"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -30, opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between gap-4 bg-muted/20 p-5 rounded-3xl border border-border/5 relative overflow-hidden">
                    <div className="relative z-10">
                      <h3 className="text-2xl font-black uppercase tracking-tighter leading-none mb-1">
                        Issue Details
                      </h3>
                      <div className="text-[8px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1 opacity-60">
                        {selectedBuilding?.name}{" "}
                        <ChevronRight className="w-2 h-2" />
                        {selectedFacility?.title}{" "}
                        <ChevronRight className="w-2 h-2" />
                        <span className="text-primary">
                          {selectedItem.label}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep(4)}
                      className="rounded-full h-8 px-4 font-black uppercase text-[9px] border-2 relative z-10"
                    >
                      Go Back
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-12 space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <Card className="bg-card/40 backdrop-blur-md p-6 rounded-[35px] border border-border/10 shadow-sm space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                              <AlertCircle className="w-3.5 h-3.5" /> Incident
                              Details
                            </h4>

                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                                  Select Issue Type *
                                </label>
                                {!currentIssue.category && (
                                  <span className="text-[12px] font-black uppercase text-amber-500 animate-pulse">
                                    Required
                                  </span>
                                )}
                              </div>
                              {selectedItem.issueCategories?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedItem.issueCategories.map(
                                    (cat: string) => (
                                      <Badge
                                        key={cat}
                                        variant={
                                          currentIssue.category === cat
                                            ? "default"
                                            : "outline"
                                        }
                                        className="cursor-pointer rounded-full px-2.5 py-1 text-[9px] font-bold border-2 transition-all"
                                        onClick={() =>
                                          setCurrentIssue({
                                            ...currentIssue,
                                            category: cat,
                                          })
                                        }
                                      >
                                        {cat}
                                      </Badge>
                                    ),
                                  )}
                                </div>
                              )}
                            </div>

                            <Textarea
                              className="min-h-[140px] text-[13px] rounded-[25px] bg-background/30 border-border/5 focus:border-primary/40"
                              placeholder="Problem description... be as specific as possible"
                              value={currentIssue.description}
                              onChange={(e) =>
                                setCurrentIssue({
                                  ...currentIssue,
                                  description: e.target.value,
                                })
                              }
                            />
                          </Card>
                        </div>

                        <div className="space-y-4">
                          <Card className="bg-card/40 backdrop-blur-md p-6 rounded-[35px] border border-border/10 shadow-sm space-y-3">
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
                                !currentIssue.category
                              }
                            >
                              <Plus className="mr-2 w-3.5 h-3.5 text-primary" />{" "}
                              Add To List
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
                  <div className="bg-muted/20 p-6 rounded-3xl border border-border/5 relative overflow-hidden">
                    <h3 className="text-2xl font-black uppercase tracking-tighter">
                      Submission Review
                    </h3>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1">
                      Final check before dispatching reports
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-4 space-y-4">
                      <Card className="p-6 rounded-3xl border border-primary/10 bg-primary/5 space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary leading-none">
                          Location Details
                        </h4>
                        <div className="space-y-4 pt-2">
                          <div>
                            <div className="text-[8px] font-black uppercase text-muted-foreground tracking-widest opacity-60">
                              School
                            </div>
                            <div className="text-xs font-bold truncate">
                              {
                                schools.find((s) => s.id === selectedSchoolId)
                                  ?.name
                              }
                            </div>
                          </div>
                          <div>
                            <div className="text-[8px] font-black uppercase text-muted-foreground tracking-widest opacity-60">
                              Building
                            </div>
                            <div className="text-xs font-bold truncate">
                              {selectedBuilding?.name}
                            </div>
                          </div>
                          <div>
                            <div className="text-[8px] font-black uppercase text-muted-foreground tracking-widest opacity-60">
                              Facility / Target
                            </div>
                            <div className="text-xs font-bold truncate">
                              {(selectedFacility as any)?.facility_name} •{" "}
                              {selectedItem?.label}
                            </div>
                          </div>
                        </div>
                      </Card>

                      <Button
                        variant="ghost"
                        onClick={() => setStep(5)}
                        className="w-full rounded-full h-12 text-[10px] font-black uppercase tracking-widest hover:bg-muted"
                      >
                        <ArrowLeft className="mr-2 w-3 h-3" /> Edit Details
                      </Button>
                    </div>

                    <div className="lg:col-span-8 space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">
                        Summary of Issues ({issues.length})
                      </h4>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                        {issues.map((issue, idx) => (
                          <Card
                            key={idx}
                            className="p-5 rounded-[30px] border border-border/10 bg-card/40 backdrop-blur-md hover:border-primary/20 transition-all flex gap-4"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[10px] font-black text-primary">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-2">
                                <Badge className="bg-primary/5 text-primary border-none text-[8px] font-black uppercase rounded-full">
                                  {issue.category || "General"}
                                </Badge>
                                {issue.files.length > 0 && (
                                  <div className="flex items-center gap-1 text-[8px] font-black uppercase text-emerald-500 opacity-60">
                                    <Camera className="w-2.5 h-2.5" />{" "}
                                    {issue.files.length} Evidences
                                  </div>
                                )}
                              </div>
                              <p className="text-[11px] font-bold leading-relaxed opacity-90">
                                {issue.description}
                              </p>
                            </div>
                          </Card>
                        ))}
                      </div>

                      <Button
                        className="w-full rounded-full h-14 text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 relative overflow-hidden group"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <div className="flex items-center gap-3">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white" />
                            <span className="animate-pulse">
                              Processing Dispatch...
                            </span>
                          </div>
                        ) : (
                          <>Approve & Submit Reports</>
                        )}
                        <motion.div
                          className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
                          initial={false}
                        />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
              {/* Bulk Reporting Support */}
              {issues.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pt-10 border-t border-dashed"
                >
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
                    Pending in your list ({issues.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {issues.map((issue, idx) => (
                      <Card
                        key={idx}
                        className="bg-emerald-500/5 border-emerald-500/20 rounded-3xl overflow-hidden group"
                      >
                        <div className="p-4 flex items-start justify-between">
                          <div className="pr-4">
                            <Badge className="mb-2 bg-emerald-500/20 text-emerald-600 border-none text-[8px] font-black uppercase rounded-full">
                              {issue.category || "Issue"}
                            </Badge>
                            <p className="text-xs font-bold line-clamp-2">
                              {issue.description}
                            </p>
                            {issue.files.length > 0 && (
                              <span className="text-[8px] font-black text-muted-foreground uppercase block mt-1">
                                + {issue.files.length} Attachments
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeIssue(idx)}
                            className="text-destructive hover:bg-destructive/10 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : activeTab === "history" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
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
                <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">
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
              <Card className="rounded-[40px] border-2 border-border/10 overflow-hidden bg-card/30 backdrop-blur-md">
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
                    {history.map((h) => (
                      <TableRow
                        key={h.id}
                        className="group/row transition-all duration-300"
                      >
                        <TableCell>
                          <div className="text-[10px] font-black text-muted-foreground opacity-50">
                            {new Date(h.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="text-[11px] font-black uppercase tracking-tight truncate max-w-[150px]">
                              {h.facilityId}
                            </div>
                            <div className="text-[9px] font-bold text-primary opacity-70">
                              {h.itemId}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[8px] font-black uppercase rounded-full px-2"
                          >
                            {h.issueCategory || "General"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-[11px] font-medium line-clamp-1 max-w-[200px] text-muted-foreground">
                            {h.description}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "rounded-full font-black text-[8px] px-2.5 py-0.5 border capitalize shadow-sm",
                              getStatusColor(h.status),
                            )}
                          >
                            {h.status.toLowerCase().replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 pr-2">
                            {h.attachments && h.attachments.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setSelectedGalleryImages(h.attachments)
                                }
                                className="h-8 w-8 rounded-full p-0 flex items-center justify-center hover:bg-primary/10 group-hover/row:scale-110 transition-all text-primary"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 rounded-full p-0 flex items-center justify-center hover:bg-muted opacity-0 group-hover/row:opacity-100 transition-all"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-10 text-center border-t border-dashed border-border/10">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    End of history log · Total {history.length} records
                  </p>
                </div>
              </Card>
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
                  <h3 className="text-2xl font-black uppercase tracking-tighter">
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
                        src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}${img}`}
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
      </div>
    </div>
  );
}
