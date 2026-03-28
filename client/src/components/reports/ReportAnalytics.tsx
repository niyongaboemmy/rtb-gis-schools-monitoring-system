import { useState, useMemo } from 'react';
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
  Area
} from 'recharts';
import { 
  BarChart3, 
  PieChart as PieIcon, 
  TrendingUp, 
  LayoutGrid, 
  Building2, 
  Layers, 
  AlertCircle,
  Camera,
  XCircle,
  History
} from 'lucide-react';
import { format, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { PeriodFilter } from '../ui/period-filter';
import type { PeriodRange } from '../ui/period-filter';
import { cn } from '../../lib/utils';
import { ImigongoPattern } from '../ui/ImigongoPattern';
import { motion, AnimatePresence } from 'framer-motion';


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
  PENDING: '#f59e0b',
  SOLVED: '#10b981',
  NEED_INTERVENTION: '#ef4444',
  FAILED: '#64748b',
};

export function ReportAnalytics({ 
  reports, 
  buildings, 
  facilities, 
  loading,
  range,
  onRangeChange,
  onUpdateStatus
}: ReportAnalyticsProps) {
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusUpdate = async (status: string) => {
    if (!selectedReport || !onUpdateStatus) return;
    setIsUpdating(true);
    try {
        await onUpdateStatus(selectedReport.id, status);
        setSelectedReport(null);
    } catch (err) {
        console.error('Failed to update status', err);
    } finally {
        setIsUpdating(false);
    }
  }

  // Fetching is now handled by the parent component

  // Data transformations
  const stats = useMemo(() => {
    const counts = {
      TOTAL: reports.length,
      PENDING: reports.filter(r => r.status === 'PENDING').length,
      SOLVED: reports.filter(r => r.status === 'SOLVED').length,
      NEED_INTERVENTION: reports.filter(r => r.status === 'NEED_INTERVENTION').length,
      FAILED: reports.filter(r => r.status === 'FAILED').length,
    };
    return counts;
  }, [reports]);

  const pieData = useMemo(() => [
    { name: 'Pending', value: stats.PENDING, color: COLORS.PENDING },
    { name: 'Solved', value: stats.SOLVED, color: COLORS.SOLVED },
    { name: 'Needs Intervention', value: stats.NEED_INTERVENTION, color: COLORS.NEED_INTERVENTION },
    { name: 'Failed', value: stats.FAILED, color: COLORS.FAILED },
  ].filter(d => d.value > 0), [stats]);

  const facilityData = useMemo(() => {
    const map: Record<string, number> = {};
    reports.forEach(r => {
      const fac = facilities.find(f => f.facilityId === r.facilityId);
      const name = fac?.title || r.facilityId;
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [reports, facilities]);

  const trendData = useMemo(() => {
    if (!range.startDate || !range.endDate) return [];
    
    const days = eachDayOfInterval({
      start: range.startDate,
      end: range.endDate
    });

    return days.map(day => {
      const count = reports.filter(r => isSameDay(parseISO(r.createdAt), day)).length;
      return {
        date: format(day, 'MMM dd'),
        count
      };
    });
  }, [reports, range]);

  const buildingHierarchy = useMemo(() => {
    return buildings.map(b => {
      const bReports = reports.filter(r => r.buildingId === b.id);
      const facMap: Record<string, any[]> = {};
      bReports.forEach(r => {
        if (!facMap[r.facilityId]) facMap[r.facilityId] = [];
        facMap[r.facilityId].push(r);
      });

      return {
        ...b,
        reportsCount: bReports.length,
        facilities: Object.entries(facMap).map(([fid, freports]) => {
          const facDef = facilities.find(f => f.facilityId === fid);
          return {
            id: fid,
            name: facDef?.title || fid,
            count: freports.length,
            reports: freports
          };
        })
      };
    }).filter(b => b.reportsCount > 0);
  }, [buildings, reports, facilities]);

  if (loading && reports.length === 0) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Calculating Analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black uppercase tracking-tighter leading-none mb-2">School Intelligence</h3>
          <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Cumulative Report Analytics</p>
        </div>
        <PeriodFilter onRangeChange={onRangeChange} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Reports', value: stats.TOTAL, icon: BarChart3, color: 'text-primary' },
          { label: 'Pending', value: stats.PENDING, icon: AlertCircle, color: 'text-amber-500' },
          { label: 'Solved', value: stats.SOLVED, icon: TrendingUp, color: 'text-emerald-500' },
          { label: 'Critical', value: stats.NEED_INTERVENTION, icon: AlertCircle, color: 'text-rose-500' },
          { label: 'Failed', value: stats.FAILED, icon: AlertCircle, color: 'text-slate-500' },
        ].map((s, idx) => (
          <Card key={idx} className="p-4 rounded-2xl border border-border/10 bg-card/40 backdrop-blur-md flex flex-col gap-1 relative overflow-hidden group hover:border-primary/30 transition-all">
            <div className={cn("w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center transition-colors group-hover:bg-primary/10", s.color)}>
              <s.icon className="w-4 h-4" />
            </div>
            <div className="text-xl font-black tracking-tighter mt-1">{s.value}</div>
            <div className="text-[8px] font-black uppercase text-muted-foreground tracking-widest leading-tight">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trend Chart */}
        <Card className="lg:col-span-12 p-6 rounded-3xl border border-border/10 bg-card/40">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <History className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black uppercase tracking-tight">Velocity</h4>
                        <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Daily Volume</p>
                    </div>
                </div>
            </div>
            <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
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
                                borderRadius: '20px', 
                                border: 'none', 
                                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                                fontSize: '10px',
                                fontWeight: '900',
                                textTransform: 'uppercase'
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
        <Card className="lg:col-span-5 p-6 rounded-3xl border border-border/10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <PieIcon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-tight">Mix</h4>
            </div>
          </div>
          
          <div className="h-[200px] w-full">
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
                    borderRadius: '20px', 
                    border: 'none', 
                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                    fontSize: '10px',
                    fontWeight: '900',
                    textTransform: 'uppercase'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{d.name}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Facilities */}
        <Card className="lg:col-span-7 p-6 rounded-3xl border border-border/10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-tight">Hotspots</h4>
            </div>
          </div>

          <div className="h-[200px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={facilityData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)" />
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
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{ borderRadius: '15px', border: 'none' }}
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
            <h4 className="text-xl font-black uppercase tracking-tighter">Facility Structure</h4>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Organization by Building & Area</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buildingHierarchy.map((building) => (
            <Card key={building.id} className="rounded-[35px] border-2 border-border/10 overflow-hidden bg-card/30 flex flex-col">
               <div className="p-5 border-b border-border/10 bg-primary/5">
                <div className="flex items-center justify-between mb-1">
                  <h5 className="font-black text-sm uppercase tracking-tight truncate pr-2">{building.name}</h5>
                  <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[7px] font-black border-primary text-primary">{building.reportsCount} ISSUES</Badge>
                </div>
              </div>

              <div className="p-3 flex-1 space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                {building.facilities.map((fac: any) => (
                  <div key={fac.id} className="bg-background/40 backdrop-blur-sm p-4 rounded-2xl border border-border/10 group cursor-default">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-all">
                          <Layers className="w-4 h-4" />
                        </div>
                        <span className="font-black text-xs uppercase tracking-tight">{fac.name}</span>
                      </div>
                      <Badge className="bg-primary/10 text-primary border-none rounded-full px-2 text-[9px] font-black">{fac.count}</Badge>
                    </div>
                    
                    <div className="space-y-2">
                      {fac.reports.map((report: any) => (
                        <div 
                          key={report.id} 
                          onClick={() => setSelectedReport(report)}
                          className="p-3 bg-muted/20 rounded-xl flex items-center justify-between group/report cursor-pointer hover:bg-primary/5 transition-all"
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="text-[9px] font-black text-muted-foreground uppercase opacity-70 mb-0.5">{report.itemId}</div>
                            <div className="text-[10px] font-bold truncate">{report.description}</div>
                          </div>
                          <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 shadow-sm shadow-current")} style={{ backgroundColor: (COLORS as any)[report.status] }} />
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

      {/* Report Details Modal */}
      <AnimatePresence>
        {selectedReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedReport(null)}
                    className="absolute inset-0 bg-background/80 backdrop-blur-xl"
                />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative bg-card p-0 rounded-[45px] border border-border/20 shadow-2xl max-w-2xl w-full z-10 overflow-hidden"
                >
                    <ImigongoPattern className="absolute top-0 right-0 w-64 h-64 text-primary pointer-events-none rotate-12" opacity={0.03} />
                    
                    <div className="p-8 md:p-12">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <Badge className={cn("rounded-full font-black text-[10px] px-3 py-1 mb-4 border-2", 
                                    selectedReport.status === 'PENDING' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                    selectedReport.status === 'SOLVED' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                    "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                )}>
                                    {selectedReport.status}
                                </Badge>
                                <h3 className="text-3xl font-black uppercase tracking-tighter leading-none mb-2">Issue Profile</h3>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{selectedReport.facilityId} • {selectedReport.itemId}</p>
                            </div>
                            <Button variant="outline" size="icon" onClick={() => setSelectedReport(null)} className="rounded-full h-12 w-12 border-2">
                                <XCircle className="w-6 h-6" />
                            </Button>
                        </div>

                        <div className="space-y-8">
                            <div className="bg-muted/30 p-8 rounded-[30px] border border-border/10">
                                <label className="text-[10px] font-black uppercase text-primary tracking-widest block mb-3">Incident Description</label>
                                <p className="text-sm font-medium leading-relaxed">{selectedReport.description}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 bg-muted/20 rounded-[25px]">
                                    <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-1">Building</label>
                                    <div className="text-xs font-bold uppercase">{selectedReport.building?.name || 'Main Campus'}</div>
                                </div>
                                <div className="p-6 bg-muted/20 rounded-[25px]">
                                    <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-1">Categorized As</label>
                                    <div className="text-xs font-bold uppercase">{selectedReport.issueCategory || 'Uncategorized'}</div>
                                </div>
                            </div>

                            {selectedReport.attachments && selectedReport.attachments.length > 0 && (
                                <div>
                                    <label className="text-[10px] font-black uppercase text-primary tracking-widest mb-4 flex items-center gap-2">
                                        <Camera className="w-4 h-4" /> Visual Evidence
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {selectedReport.attachments.slice(0, 4).map((img: string, i: number) => (
                                            <div key={i} className="aspect-video rounded-2xl overflow-hidden border border-border/10">
                                                <img 
                                                    src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}${img}`} 
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => (e.currentTarget.src = 'https://images.unsplash.com/photo-1544216717-3bbf52512659?w=400')}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-8 bg-muted/50 border-t border-border/10">
                        <div className="flex items-center justify-between mb-6">
                            <div className="text-[10px] font-black text-muted-foreground uppercase">Recorded {new Date(selectedReport.createdAt).toLocaleDateString()}</div>
                            <div className="text-[10px] font-black text-primary uppercase tracking-widest">Update Request Status</div>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                                { id: 'PENDING', label: 'Reset', color: 'bg-amber-500' },
                                { id: 'SOLVED', label: 'Solve', color: 'bg-emerald-500' },
                                { id: 'NEED_INTERVENTION', label: 'Critical', color: 'bg-rose-500' },
                                { id: 'FAILED', label: 'Fail', color: 'bg-slate-500' }
                            ].map(btn => (
                                <Button 
                                    key={btn.id}
                                    onClick={() => handleStatusUpdate(btn.id)}
                                    disabled={isUpdating || selectedReport.status === btn.id}
                                    className={cn(
                                        "h-10 rounded-xl text-[10px] font-black uppercase tracking-tight border-b-4 active:border-b-0 transition-all",
                                        btn.color,
                                        "text-white shadow-lg",
                                        selectedReport.status === btn.id ? "opacity-30 border-none" : "hover:brightness-110 active:translate-y-1"
                                    )}
                                >
                                    {btn.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}
