import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { Badge } from "../ui/badge";
import { AlertTriangle, CheckCircle, Clock, AlertCircle, Calendar, MessageSquare, User, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "../../lib/utils";

interface Report {
  id: string;
  facilityId: string;
  itemId: string;
  description: string;
  status: "PENDING" | "SOLVED" | "NEED_INTERVENTION" | "FAILED";
  issueCategory: string[];
  reportedBy: string;
  reporter?: {
    username: string;
    email: string;
  };
  attachments: string[];
  createdAt: string;
}

interface BuildingReportingTabProps {
  buildingId: string;
}

export function BuildingReportingTab({ buildingId }: BuildingReportingTabProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get("/reports", {
          params: { buildingId },
        });
        setReports(data.data || []); // API usually returns { data: [...], total: ... }
      } catch (err) {
        console.error("Failed to fetch reports:", err);
        setError("Unable to load report history.");
      } finally {
        setIsLoading(false);
      }
    };

    if (buildingId) fetchReports();
  }, [buildingId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING": return <Clock className="w-3.5 h-3.5" />;
      case "SOLVED": return <CheckCircle className="w-3.5 h-3.5" />;
      case "NEED_INTERVENTION": return <AlertTriangle className="w-3.5 h-3.5" />;
      case "FAILED": return <AlertCircle className="w-3.5 h-3.5" />;
      default: return <MessageSquare className="w-3.5 h-3.5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/5";
      case "SOLVED": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/5";
      case "NEED_INTERVENTION": return "bg-red-500/10 text-red-500 border-red-500/20 shadow-red-500/5";
      case "FAILED": return "bg-slate-500/10 text-slate-400 border-slate-500/20 shadow-slate-500/5";
      default: return "bg-white/5 text-white/40 border-white/10";
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-20 px-10">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-[10px] text-white/20 uppercase font-black tracking-widest text-center">Syncing Building Reports...</p>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-6 text-center h-full">
        <div className="w-20 h-20 rounded-full bg-white/2 border border-white/5 flex items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-primary/2 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CheckCircle className="w-8 h-8 text-white/5" />
        </div>
        <div>
          <p className="text-[10px] text-white/20 uppercase font-black tracking-widest mb-1">Clear Ledger</p>
          <p className="text-xs text-white/40 leading-relaxed max-w-[200px]">No issues or reports discovered for this building sector.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar space-y-4 pb-12">
      {/* Activity Title */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest antialiased">Action Log</p>
          <p className="text-xs text-white/60">Historical building monitoring</p>
        </div>
        <Badge variant="outline" className="bg-white/5 text-white/40 text-[9px] font-black border-none rounded-full px-2 h-5">
          {reports.length} ENTRIES
        </Badge>
      </div>

      <div className="space-y-3">
        {reports.map((report) => (
          <div 
            key={report.id} 
            className="group relative p-4 rounded-3xl bg-white/3 border border-white/5 hover:bg-white/5 hover:border-primary/10 transition-all shadow-inner overflow-hidden"
          >
            {/* Status & Date */}
            <div className="flex items-center justify-between mb-3">
              <Badge 
                className={cn(
                  "h-6 px-2.5 rounded-xl text-[9px] font-black tracking-widest border shadow-xl flex items-center gap-1.5 transition-transform group-hover:scale-105",
                  getStatusColor(report.status)
                )}
              >
                {getStatusIcon(report.status)}
                {report.status}
              </Badge>
              <div className="flex items-center gap-1.5 text-white/20 font-mono text-[9px] font-bold">
                <Calendar className="w-3 h-3" />
                {format(new Date(report.createdAt), "dd MMM yyyy")}
              </div>
            </div>

            {/* Description Card */}
            <div className="space-y-4">
              <div className="bg-black/20 p-3.5 rounded-2xl border border-white/5 shadow-inner">
                <p className="text-xs text-white/80 leading-relaxed font-medium antialiased italic">
                  "{report.description}"
                </p>
              </div>

              {/* metadata Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                  <User className="w-3 h-3 text-white/20" />
                  <div className="min-w-0">
                    <p className="text-[7.5px] uppercase font-black text-white/20 tracking-widest mb-0.5">Reporter</p>
                    <p className="text-[10px] font-bold text-white/60 truncate">{report.reporter?.username || "Inspector"}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-primary/20 transition-colors cursor-pointer group/link">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MessageSquare className="w-3 h-3 text-white/20 group-hover/link:text-primary transition-colors" />
                    <div className="min-w-0">
                      <p className="text-[7.5px] uppercase font-black text-white/20 tracking-widest mb-0.5">Facility</p>
                      <p className="text-[10px] font-bold text-white/60 truncate group-hover/link:text-white transition-colors">{report.facilityId}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-white/10 group-hover/link:text-primary ml-1 transition-all group-hover/link:translate-x-0.5" />
                </div>
              </div>
            </div>

            {/* Inline Glow Effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[60px] pointer-events-none group-hover:bg-primary/10 transition-colors duration-700" />
          </div>
        ))}
      </div>
    </div>
  );
}
