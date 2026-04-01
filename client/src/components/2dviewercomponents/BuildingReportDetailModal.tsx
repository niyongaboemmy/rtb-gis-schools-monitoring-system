import { useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { FilePreview } from "../ui/file-preview";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  X,
  Pencil,
  Save,
  Tag,
  Layers,
  Camera,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api";

export type ReportStatus = "PENDING" | "SOLVED" | "NEED_INTERVENTION" | "FAILED";

export interface Report {
  id: string;
  facilityId: string;
  itemId: string;
  description: string;
  status: ReportStatus;
  issueCategory: string[];
  reportedBy: string;
  reporter?: { username: string; email: string };
  attachments: string[];
  createdAt: string;
  updatedAt?: string;
}

export const STATUS_CONFIG: Record<
  ReportStatus,
  {
    label: string;
    short: string;
    icon: React.ReactNode;
    color: string;
    accent: string;
    badge: string;
    activeBg: string;
  }
> = {
  NEED_INTERVENTION: {
    label: "Critical Priority",
    short: "Critical",
    icon: <AlertTriangle className="w-3 h-3" />,
    color: "text-rose-500",
    accent: "bg-rose-500",
    badge: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    activeBg: "bg-rose-500 text-white border-rose-500",
  },
  PENDING: {
    label: "Pending Review",
    short: "Pending",
    icon: <Clock className="w-3 h-3" />,
    color: "text-amber-500",
    accent: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    activeBg: "bg-amber-500 text-white border-amber-500",
  },
  SOLVED: {
    label: "Resolved",
    short: "Solved",
    icon: <CheckCircle className="w-3 h-3" />,
    color: "text-emerald-500",
    accent: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    activeBg: "bg-emerald-500 text-white border-emerald-500",
  },
  FAILED: {
    label: "Invalid / Failed",
    short: "Invalid",
    icon: <AlertCircle className="w-3 h-3" />,
    color: "text-slate-500",
    accent: "bg-slate-400",
    badge: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    activeBg: "bg-slate-500 text-white border-slate-500",
  },
};

interface BuildingReportDetailModalProps {
  report: Report | null;
  onClose: () => void;
  onReportUpdated: (updated: Report) => void;
  onReportStatusChange?: () => void;
  showToast: (message: string, type: "success" | "warning") => void;
}

export function BuildingReportDetailModal({
  report,
  onClose,
  onReportUpdated,
  onReportStatusChange,
  showToast,
}: BuildingReportDetailModalProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleStatusUpdate = async (status: ReportStatus) => {
    if (!report) return;
    setIsStatusUpdating(true);
    try {
      await api.patch(`/reports/${report.id}/status`, { status });
      onReportUpdated({ ...report, status });
      onReportStatusChange?.();
      showToast(
        `Status set to ${status.replace(/_/g, " ").toLowerCase()}`,
        "success",
      );
    } catch {
      showToast("Failed to update status", "warning");
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const handleSaveDescription = async () => {
    if (!report) return;
    setIsSaving(true);
    try {
      await api.patch(`/reports/${report.id}`, { description: editDescription });
      onReportUpdated({ ...report, description: editDescription });
      setIsEditMode(false);
      showToast("Report updated", "success");
    } catch {
      showToast("Failed to save changes", "warning");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (r: Report) => {
    setEditDescription(r.description);
    setIsEditMode(true);
  };

  const modal = (
    <AnimatePresence>
      {report && (
        <>
          {/* Backdrop */}
          <motion.div
            key="detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-100 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Side panel */}
          <motion.div
            key="detail-panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            className="fixed top-0 right-0 h-full z-101 w-full max-w-md bg-white dark:bg-[#0f1117] border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/8 bg-slate-50/80 dark:bg-white/3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                  <ClipboardList className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                    Report detail
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-white/75 mt-0.5 truncate">
                    {report.id.split("-").pop()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() =>
                    isEditMode ? setIsEditMode(false) : openEdit(report)
                  }
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all",
                    isEditMode
                      ? "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/88 border-slate-200 dark:border-white/10"
                      : "bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white hover:border-primary",
                  )}
                >
                  <Pencil className="w-3 h-3" />
                  {isEditMode ? "Cancel" : "Edit"}
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-white/65 hover:text-slate-900 dark:hover:text-white transition-all group"
                >
                  <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-5">

              {/* Status badge + date */}
              <div className="flex items-center justify-between">
                <Badge
                  className={cn(
                    "h-6 px-2.5 rounded-xl text-[11px] border flex items-center gap-1.5",
                    STATUS_CONFIG[report.status].badge,
                  )}
                >
                  {STATUS_CONFIG[report.status].icon}
                  {STATUS_CONFIG[report.status].short}
                </Badge>
                <span className="text-[11px] font-mono text-slate-400 dark:text-white/88 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(report.createdAt), "dd MMM yyyy · HH:mm")}
                </span>
              </div>

              {/* Status update */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500 dark:text-white/80 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Update status
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(STATUS_CONFIG) as ReportStatus[]).map((s) => {
                    const c = STATUS_CONFIG[s];
                    const isActive = report.status === s;
                    return (
                      <button
                        key={s}
                        disabled={isStatusUpdating || isActive}
                        onClick={() => handleStatusUpdate(s)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border text-xs font-medium transition-all active:scale-95",
                          isActive
                            ? c.activeBg
                            : "bg-white dark:bg-white/3 border-slate-200 dark:border-white/8 text-slate-600 dark:text-white/80 hover:bg-slate-50 dark:hover:bg-white/8 hover:border-slate-300 dark:hover:border-white/15",
                        )}
                      >
                        {isStatusUpdating && isActive ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          c.icon
                        )}
                        {c.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-white/8" />

              {/* Description */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500 dark:text-white/80 flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5" />
                  Description
                </p>
                {isEditMode ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={5}
                      className="text-sm resize-none rounded-xl bg-slate-50 dark:bg-white/3 border-slate-200 dark:border-white/8 text-slate-800 dark:text-white/80 placeholder:text-slate-300 dark:placeholder:text-white/40 focus:border-primary/40 focus:ring-primary/20"
                      placeholder="Describe the issue..."
                    />
                    <button
                      disabled={
                        isSaving ||
                        editDescription.trim() === report.description.trim()
                      }
                      onClick={handleSaveDescription}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-all disabled:opacity-40 active:scale-95"
                    >
                      {isSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Save changes
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/8 rounded-xl p-4">
                    <p className="text-sm text-slate-700 dark:text-white/88 leading-relaxed">
                      {report.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500 dark:text-white/80 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Details
                </p>
                <div className="rounded-xl border border-slate-200 dark:border-white/8 overflow-hidden bg-white dark:bg-white/3 divide-y divide-slate-100 dark:divide-white/5">
                  {[
                    {
                      label: "Facility",
                      value: report.facilityId
                        ?.replace(/_/g, " ")
                        .replace(/-/g, " "),
                      capitalize: true,
                    },
                    {
                      label: "Item",
                      value: report.itemId
                        ?.replace(/_/g, " ")
                        .replace(/-/g, " "),
                      capitalize: true,
                    },
                    {
                      label: "Reporter",
                      value: report.reporter?.username || "Inspector",
                    },
                  ].map(({ label, value, capitalize }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between px-4 py-2.5"
                    >
                      <span className="text-xs text-slate-500 dark:text-white/75">
                        {label}
                      </span>
                      <span
                        className={cn(
                          "text-sm text-slate-700 dark:text-white/88",
                          capitalize && "capitalize",
                        )}
                      >
                        {value || "—"}
                      </span>
                    </div>
                  ))}

                  {/* Categories */}
                  {(() => {
                    const cats = Array.isArray(report.issueCategory)
                      ? report.issueCategory
                      : report.issueCategory
                        ? [report.issueCategory]
                        : [];
                    if (!cats.length) return null;
                    return (
                      <div className="flex items-start justify-between px-4 py-2.5 gap-3">
                        <span className="text-xs text-slate-500 dark:text-white/75 shrink-0">
                          Categories
                        </span>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {cats.map((cat) => (
                            <Badge
                              key={cat}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-5 border-primary/20 text-primary rounded-full"
                            >
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500 dark:text-white/80 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  Evidence
                </p>
                {report.attachments?.length > 0 ? (
                  <div className="space-y-2">
                    {report.attachments.map((url, i) => (
                      <FilePreview
                        key={i}
                        url={url}
                        filename={`Evidence #${i + 1}`}
                        className="border-slate-200 dark:border-white/8"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-slate-200 dark:border-white/8 rounded-xl bg-slate-50 dark:bg-white/2">
                    <Camera className="w-5 h-5 text-slate-300 dark:text-white/65" />
                    <span className="text-xs text-slate-400 dark:text-white/60">
                      No evidence attached
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
