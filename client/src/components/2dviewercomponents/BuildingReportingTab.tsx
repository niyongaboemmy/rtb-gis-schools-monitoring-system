import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api";
import {
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Plus,
  X,
  ClipboardList,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import SchoolReporting from "../../pages/SchoolReporting";
import {
  BuildingReportDetailModal,
  STATUS_CONFIG,
} from "./BuildingReportDetailModal";
import type { Report, ReportStatus } from "./BuildingReportDetailModal";

const STATUS_ORDER: ReportStatus[] = [
  "NEED_INTERVENTION",
  "PENDING",
  "SOLVED",
  "FAILED",
];

interface BuildingReportingTabProps {
  buildingId: string;
  schoolId: string;
  onReportStatusChange?: () => void;
}

export function BuildingReportingTab({
  buildingId,
  schoolId,
  onReportStatusChange,
}: BuildingReportingTabProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "warning" | null;
  }>({ message: "", type: null });

  const showToast = (message: string, type: "success" | "warning") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: null }), 5000);
  };

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/reports", { params: { buildingId } });
      setReports(data.data || []);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setIsLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    if (buildingId) fetchReports();
  }, [buildingId, fetchReports]);

  const groupedReports = useMemo(() => {
    const map: Record<ReportStatus, Report[]> = {
      NEED_INTERVENTION: [],
      PENDING: [],
      SOLVED: [],
      FAILED: [],
    };
    reports.forEach((r) => map[r.status]?.push(r));
    return map;
  }, [reports]);

  const handleReportUpdated = (updated: Report) => {
    setSelectedReport(updated);
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  // ── Toast ─────────────────────────────────────────────────────────────────

  const renderToast = () => (
    <AnimatePresence>
      {toast.type && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={cn(
            "absolute bottom-4 left-1/2 -translate-x-1/2 z-60 flex items-center gap-2 px-4 py-2.5 rounded-2xl border shadow-xl text-xs whitespace-nowrap",
            toast.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          )}
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Create modal (portaled) ───────────────────────────────────────────────

  const renderCreateModal = () => (
    <AnimatePresence>
      {showCreateModal && (
        <>
          <motion.div
            key="create-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-100 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <motion.div
            key="create-panel"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed inset-0 z-101 flex items-center justify-center px-4 py-6 pointer-events-none"
          >
            <div
              className="relative w-full h-[97vh] bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/8 bg-slate-50/80 dark:bg-white/3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-2xl bg-primary/10">
                    <ClipboardList className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                      New Report
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-white/55 mt-0.5">
                      File an issue for this building
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-all active:scale-95 group"
                >
                  <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>

              {/* Embedded multi-step form */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <SchoolReporting
                  schoolId={schoolId}
                  initialBuildingId={buildingId}
                  hideHeader
                  mode="modal"
                  onReportSubmitted={() => {
                    setShowCreateModal(false);
                    fetchReports();
                    onReportStatusChange?.();
                    showToast("Report submitted successfully!", "success");
                  }}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-20">
        <div className="w-8 h-8 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-[11px] text-slate-500 dark:text-white/50">
          Loading reports…
        </p>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────

  if (reports.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/8 flex items-center justify-center">
          <FileText className="w-6 h-6 text-slate-400 dark:text-white/30" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-white/70 mb-1">
            No reports yet
          </p>
          <p className="text-[11px] text-slate-500 dark:text-white/50 leading-relaxed max-w-48">
            No issues have been filed for this building.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          File first report
        </button>
        {renderToast()}
        {createPortal(renderCreateModal(), document.body)}
      </div>
    );
  }

  // ── Grouped list ──────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 pt-2 pb-3 shrink-0">
        <p className="text-xs text-slate-500 dark:text-white/50">
          {reports.length} report{reports.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          New report
        </button>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 space-y-4">
        {STATUS_ORDER.map((status) => {
          const group = groupedReports[status];
          if (!group.length) return null;
          const cfg = STATUS_CONFIG[status];

          return (
            <div key={status}>
              {/* Group header */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className={cn("text-xs font-semibold", cfg.color)}>
                  {cfg.label}
                </span>
                <span className="text-xs text-slate-400 dark:text-white/35">
                  · {group.length}
                </span>
              </div>

              {/* Rows */}
              <div className="rounded-xl border border-slate-200 dark:border-white/8 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                {group.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className="w-full flex items-start gap-3 px-3.5 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/4 transition-colors group"
                  >
                    <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", cfg.accent)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-slate-700 dark:text-white/75 leading-snug truncate">
                        {report.description || "No description"}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-white/35 mt-0.5">
                        {format(new Date(report.createdAt), "dd MMM yyyy")}
                        {report.facilityId && (
                          <span className="ml-1.5 capitalize">
                            · {report.facilityId.replace(/[_-]/g, " ")}
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-white/20 group-hover:text-primary transition-colors shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {renderToast()}

      <BuildingReportDetailModal
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        onReportUpdated={handleReportUpdated}
        onReportStatusChange={onReportStatusChange}
        showToast={showToast}
      />

      {createPortal(renderCreateModal(), document.body)}
    </div>
  );
}
