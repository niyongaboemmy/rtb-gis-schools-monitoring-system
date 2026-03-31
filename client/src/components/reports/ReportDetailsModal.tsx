import { 
  Clock, 
  MapPin, 
  Layers, 
  AlertCircle,
  User as UserIcon,
  Tag,
  Camera,
  History,
  CheckCircle2,
  AlertTriangle,
  Info,
  Globe2
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { FilePreview } from "../ui/file-preview";
import { Modal } from "../ui/modal";
import SchoolMap from "../SchoolMap";

interface ReportDetailsModalProps {
  report: any;
  onClose: () => void;
  onUpdateStatus?: (reportId: string, status: string) => Promise<void>;
  isUpdating?: boolean;
}

const STATUS_CONFIG = {
  PENDING: { label: "Pending Review", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: <Clock className="w-3.5 h-3.5" /> },
  SOLVED: { label: "Solved", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  NEED_INTERVENTION: { label: "Critical Priority", color: "bg-rose-500/10 text-rose-500 border-rose-500/20", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  FAILED: { label: "Failed/Invalid", color: "bg-slate-500/10 text-slate-500 border-slate-500/20", icon: <Info className="w-3.5 h-3.5" /> },
};

export function ReportDetailsModal({ report, onClose, onUpdateStatus, isUpdating }: ReportDetailsModalProps) {
  if (!report) return null;

  const [isMapOpen, setIsMapOpen] = useState(false);

  const handleStatusChange = async (status: string) => {
    if (onUpdateStatus) {
      await onUpdateStatus(report.id, status);
    }
  };

  const status = STATUS_CONFIG[report.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.PENDING;
  const categories = Array.isArray(report.issueCategory) 
    ? report.issueCategory 
    : report.issueCategory 
      ? [report.issueCategory] 
      : ["Uncategorized"];

  return (
    <Modal
      isOpen={!!report}
      onClose={onClose}
      maxWidth="max-w-3xl"
      title={
        <div className="flex items-center gap-4">
          <Badge className={cn("rounded-full font-black text-[10px] px-3 py-1 border tracking-widest uppercase", status.color)}>
            {status.icon} <span className="ml-2">{status.label}</span>
          </Badge>
          <span className="text-xl font-black uppercase tracking-tighter">Incident Profile</span>
        </div>
      }
      description={`Permanent ID: ${report.id.split("-").pop()}`}
      footer={
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <h5 className="text-[10px] font-black uppercase tracking-tighter">Intervention Logic</h5>
              <p className="text-[9px] font-black text-muted-foreground opacity-50 uppercase">Update report status based on findings</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { id: 'PENDING', label: 'Reset', color: 'hover:bg-amber-500 hover:text-white border-amber-500/30 text-amber-500' },
              { id: 'SOLVED', label: 'Resolve', color: 'hover:bg-emerald-500 hover:text-white border-emerald-500/30 text-emerald-500' },
              { id: 'NEED_INTERVENTION', label: 'Critical', color: 'hover:bg-rose-500 hover:text-white border-rose-500/30 text-rose-500' },
              { id: 'FAILED', label: 'Invalid', color: 'hover:bg-slate-500 hover:text-white border-slate-500/30 text-slate-500' }
            ].map(btn => (
              <Button 
                key={btn.id}
                variant={report.status === btn.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusChange(btn.id)}
                disabled={isUpdating || report.status === btn.id}
                className={cn(
                  "h-10 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all active:scale-95 flex items-center justify-center gap-2",
                  report.status === btn.id 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : cn("bg-background hover:bg-muted/50 transition-colors", btn.color)
                )}
              >
                {isUpdating && <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-current"></div>}
                {report.status === btn.id ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : null}
                {btn.label}
              </Button>
            ))}
          </div>
        </div>
      }
    >
      <div className="space-y-8 py-2">
        {/* Core Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Building / Asset</p>
                    <p className="text-sm font-black uppercase tracking-tight">{report.building?.name || "Main Structure"} · {report.itemId}</p>
                  </div>
                  {report.school && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsMapOpen(true)}
                      className="h-8 px-3 rounded-full text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 flex items-center gap-2 border border-primary/10"
                    >
                      <Globe2 className="w-3.5 h-3.5" /> View on Map
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Tag className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Facility / Category</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  <span className="text-sm font-semibold capitalize mr-2">
                    {report.facilityId?.replace(/_/g, " ").replace(/-/g, " ")}
                  </span>
                  {categories.map((cat: string) => (
                    <Badge key={cat} variant="outline" className="rounded-full text-[7px] font-black uppercase px-2 py-0 border-primary/10 text-primary h-4">
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Captured At</p>
                <p className="text-[11px] font-bold uppercase">{format(new Date(report.createdAt), "PPP p")}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                <UserIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Author Signature</p>
                <p className="text-[11px] font-black uppercase">{report.reporter?.name || "Maintenance Staff"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border/10" />

        {/* Description Section */}
        <div className="bg-muted/50 p-5 rounded-2xl border border-border/10 relative overflow-hidden group">
          <AlertCircle className="absolute -bottom-2 -right-2 w-16 h-16 text-primary opacity-5" />
          <label className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-2 mb-3">
            <Layers className="w-3 h-3" /> Detailed Narrative
          </label>
          <p className="text-sm font-medium leading-relaxed text-card-foreground/80">{report.description}</p>
        </div>

        {/* Visual Evidence Section */}
        <div>
          <label className="text-[9px] font-black uppercase text-primary tracking-widest mb-4 flex items-center gap-2">
            <History className="w-3 h-3" /> Evidence Artifacts
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {report.attachments && report.attachments.length > 0 ? (
              report.attachments.map((url: string, i: number) => (
                <FilePreview key={i} url={url} filename={`Evidence #${i + 1}`} className="border-border/5" />
              ))
            ) : (
              <div className="col-span-full border-2 border-dashed border-border/10 rounded-2xl p-8 flex flex-col items-center justify-center opacity-40 bg-muted/30">
                <Camera className="w-8 h-8 mb-2" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">No imagery detected</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map Modal Overlay */}
      <Modal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        maxWidth="max-w-[95vw]"
        className="h-[90vh] sm:rounded-2xl overflow-hidden p-0"
        hideCloseButton
      >
        <div className="absolute inset-0 z-50">
          <SchoolMap 
            school={report.school} 
            buildings={report.school?.buildings}
            initialBuildingId={report.buildingId}
            onClose={() => setIsMapOpen(false)}
            onSelectBuilding={() => {}}
          />
        </div>
      </Modal>
    </Modal>
  );
}
