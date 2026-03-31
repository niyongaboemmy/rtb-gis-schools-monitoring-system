import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  LayoutGrid,
  Building2,
  Layers,
  AlertCircle,
  History,
} from "lucide-react";
import { format, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { PeriodFilter } from "../ui/period-filter";
import type { PeriodRange } from "../ui/period-filter";
import { cn } from "../../lib/utils";
import { AnimatePresence } from "framer-motion";
import { ReportDetailsModal } from "./ReportDetailsModal";

interface ReportAnalyticsProps {
  reports: any[];
  buildings: any[];
  facilities: any[];
  loading: boolean;
  range: PeriodRange;
  onRangeChange: (r: PeriodRange) => void;
  onUpdateStatus?: (reportId: string, status: string) => Promise<void>;
}

const COLORS = {
  PENDING: "#f59e0b",
  SOLVED: "#10b981",
  NEED_INTERVENTION: "#f43f5e",
  FAILED: "#6b7280",
};

export function ReportAnalytics({
  reports,
  buildings,
  facilities,
  loading,
  range,
  onRangeChange,
  onUpdateStatus,
}: ReportAnalyticsProps) {
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Safety: cast reports specifically as array for all memoized calculations
  const safeReports = useMemo(
    () => (Array.isArray(reports) ? reports : []),
    [reports],
  );

  const handleStatusUpdate = async (reportId: string, status: string) => {
    if (!onUpdateStatus) return;
    setIsUpdating(true);
    try {
      await onUpdateStatus(reportId, status);
      // Update local object to reflect change
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport({ ...selectedReport, status });
      }
    } catch (error) {
      console.error("Failed to update report status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Data transformations
  const stats = useMemo(() => ({
    TOTAL: safeReports.length,
    PENDING: safeReports.filter((r) => r.status === "PENDING").length,
    SOLVED: safeReports.filter((r) => r.status === "SOLVED").length,
    NEED_INTERVENTION: safeReports.filter((r) => r.status === "NEED_INTERVENTION").length,
    FAILED: safeReports.filter((r) => r.status === "FAILED").length,
  }), [safeReports]);

  const pieData = useMemo(
    () =>
      [
        { name: "Pending", value: stats.PENDING, color: COLORS.PENDING },
        { name: "Solved", value: stats.SOLVED, color: COLORS.SOLVED },
        { name: "Needs Intervention", value: stats.NEED_INTERVENTION, color: COLORS.NEED_INTERVENTION },
        { name: "Failed / Invalid", value: stats.FAILED, color: COLORS.FAILED },
      ].filter((d) => d.value > 0),
    [stats],
  );

  const resolutionRate = useMemo(
    () => (stats.TOTAL > 0 ? Math.round((stats.SOLVED / stats.TOTAL) * 100) : 0),
    [stats],
  );

  const facilityData = useMemo(() => {
    const map: Record<string, number> = {};
    safeReports.forEach((r) => {
      const fac = facilities.find((f) => f.facilityId === r.facilityId);
      const name = fac?.title || r.facilityId;
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [safeReports, facilities]);

  const trendData = useMemo(() => {
    if (!range.startDate || !range.endDate) return [];

    const days = eachDayOfInterval({
      start: range.startDate,
      end: range.endDate,
    });

    return days.map((day) => {
      const count = safeReports.filter((r) =>
        isSameDay(parseISO(r.createdAt), day),
      ).length;
      return {
        date: format(day, "MMM dd"),
        count,
      };
    });
  }, [safeReports, range]);

  const buildingHierarchy = useMemo(() => {
    return buildings
      .map((b) => {
        const bReports = safeReports.filter((r) => r.buildingId === b.id);
        const facMap: Record<string, any[]> = {};
        bReports.forEach((r) => {
          if (!facMap[r.facilityId]) facMap[r.facilityId] = [];
          facMap[r.facilityId].push(r);
        });

        return {
          ...b,
          reportsCount: bReports.length,
          facilities: Object.entries(facMap).map(([fid, freports]) => {
            const facDef = facilities.find((f) => f.facilityId === fid);
            return {
              id: fid,
              name: facDef?.title || fid,
              count: freports.length,
              reports: freports,
            };
          }),
        };
      })
      .filter((b) => b.reportsCount > 0);
  }, [buildings, safeReports, facilities]);

  if (loading && safeReports.length === 0) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Calculating Analytics...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-bold tracking-tighter leading-none mb-2">
            School Intelligence
          </h3>
          <p className="text-muted-foreground text-[10px] font-normal tracking-widest">
            Cumulative Report Analytics
          </p>
        </div>
        <PeriodFilter onRangeChange={onRangeChange} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          {
            label: "Total Reports",
            value: stats.TOTAL,
            icon: BarChart3,
            color: "text-primary",
          },
          {
            label: "Pending Review",
            value: stats.PENDING,
            icon: AlertCircle,
            color: "text-amber-500",
          },
          {
            label: "Solved",
            value: stats.SOLVED,
            icon: TrendingUp,
            color: "text-emerald-500",
          },
          {
            label: "Needs Intervention",
            value: stats.NEED_INTERVENTION,
            icon: AlertCircle,
            color: "text-rose-500",
          },
          {
            label: "Failed / Invalid",
            value: stats.FAILED,
            icon: AlertCircle,
            color: "text-slate-500",
          },
          {
            label: "Resolution Rate",
            value: `${resolutionRate}%`,
            icon: TrendingUp,
            color: "text-blue-500",
          },
        ].map((s, idx) => (
          <Card
            key={idx}
            className="p-5 rounded-xl border border-border/20 bg-card flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-1 relative overflow-hidden group hover:border-primary/30 transition-all active:scale-[0.98]"
          >
            <div
              className={cn(
                "w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center transition-colors group-hover:bg-primary/10",
                s.color,
              )}
            >
              <s.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 sm:flex-none">
              <div className="text-2xl font-black uppercase tracking-tighter sm:mt-2">
                {s.value}
              </div>
              <div className="text-[9px] font-black uppercase text-muted-foreground tracking-widest leading-tight opacity-60">
                {s.label}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {safeReports.length === 0 && !loading && (
        <div className="py-16 text-center space-y-3 border-2 border-dashed border-border/20 rounded-2xl">
          <BarChart3 className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm font-semibold text-muted-foreground">No reports for this period</p>
          <p className="text-xs text-muted-foreground/60">Try adjusting the date range above.</p>
        </div>
      )}

      {safeReports.length > 0 && (
        <>
          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Trend Chart */}
            <Card className="lg:col-span-12 p-6 rounded-2xl border border-border/20 bg-card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight">
                      Daily Report Trend
                    </h4>
                    <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest opacity-60">
                      Reports submitted per day
                    </p>
                  </div>
                </div>
              </div>
              <div className="h-55 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="var(--primary)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--primary)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="currentColor"
                      opacity={0.08}
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fontWeight: 700 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fontWeight: 700 }}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                        fontSize: "10px",
                        fontWeight: "900",
                        textTransform: "uppercase",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--primary)"
                      strokeWidth={4}
                      fillOpacity={1}
                      fill="url(#colorCount)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Status Distribution */}
            <Card className="lg:col-span-5 p-6 rounded-2xl border border-border/20 bg-card">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <PieIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight">
                    Status Distribution
                  </h4>
                </div>
              </div>

              <div className="h-50 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                        fontSize: "10px",
                        fontWeight: "900",
                        textTransform: "uppercase",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 mt-6">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-[9px] font-semibold text-muted-foreground">{d.name}</span>
                    <span className="ml-auto text-[9px] font-black">{d.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top Facilities */}
            <Card className="lg:col-span-7 p-6 rounded-2xl border border-border/20 bg-card">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight">
                    Most Reported Facilities
                  </h4>
                </div>
              </div>

              <div className="h-[200px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={facilityData}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="currentColor"
                      opacity={0.08}
                    />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9 }}
                      width={100}
                    />
                    <RechartsTooltip
                      cursor={{ fill: "rgba(0,0,0,0.02)" }}
                      contentStyle={{ borderRadius: "8px", border: "none" }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#3b82f6"
                      radius={[0, 10, 10, 0]}
                      barSize={30}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Cumulative Structure View */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xl font-bold tracking-tighter">
                  Facility Structure
                </h4>
                <p className="text-[10px] font-normal text-muted-foreground tracking-widest">
                  Organization by Building & Area
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {buildingHierarchy.map((building) => (
                <Card
                  key={building.id}
                  className="rounded-2xl border-2 border-border/10 overflow-hidden bg-card flex flex-col"
                >
                  <div className="p-6 border-b border-border/10 bg-primary/5">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="font-black text-sm uppercase tracking-tight truncate pr-2">
                        {building.name}
                      </h5>
                      <Badge
                        variant="outline"
                        className="rounded-full px-2 py-0.5 text-[8px] font-black border-primary text-primary whitespace-nowrap"
                      >
                        {building.reportsCount} LOGS
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 flex-1 space-y-3 max-h-100 overflow-y-auto no-scrollbar">
                    {building.facilities.map((fac: any) => (
                      <div
                        key={fac.id}
                        className="bg-muted/30 p-4 rounded-xl border border-border/10 group cursor-default hover:border-primary/20 transition-all"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all">
                              <Layers className="w-4 h-4" />
                            </div>
                            <span className="font-black text-xs uppercase tracking-tight">
                              {fac.name}
                            </span>
                          </div>
                          <Badge className="bg-primary/10 text-primary border-none rounded-full px-2.5 text-[10px] font-black">
                            {fac.count}
                          </Badge>
                        </div>

                        <div className="space-y-2.5">
                          {fac.reports.map((report: any) => (
                            <div
                              key={report.id}
                              onClick={() => setSelectedReport(report)}
                              className="p-4 bg-muted/20 rounded-2xl flex items-center justify-between group/report cursor-pointer hover:bg-primary/5 transition-all active:scale-[0.98]"
                            >
                              <div className="flex-1 min-w-0 pr-3">
                                <div className="text-[10px] font-black text-muted-foreground uppercase opacity-70 mb-1">
                                  {report.itemId}
                                </div>
                                <div className="text-[11px] font-bold truncate leading-none mb-1">
                                  {report.description}
                                </div>
                                <div className="text-[8px] font-black text-primary uppercase opacity-50">
                                  {new Date(report.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                              <div
                                className={cn(
                                  "w-3 h-3 rounded-full shrink-0",
                                )}
                                style={{
                                  backgroundColor: (COLORS as any)[report.status],
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Report Details Modal */}
      <AnimatePresence>
        {selectedReport && (
          <ReportDetailsModal
            report={selectedReport}
            onClose={() => setSelectedReport(null)}
            onUpdateStatus={handleStatusUpdate}
            isUpdating={isUpdating}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
