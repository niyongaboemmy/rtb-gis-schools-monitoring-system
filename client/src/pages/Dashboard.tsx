import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Building2, AlertTriangle, CheckCircle2, TrendingUp, LayoutGrid } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '../components/ui/page-header';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../components/ui/table";
import { cn } from '../lib/utils';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchStats = async () => {
      try {
        const response = await api.get('/analytics/overview');
        setStats(response.data);
      } catch (err) {
        console.error('Failed to load stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="System Overview"
        description="National GIS Intelligence & Infrastructure Status"
        icon={LayoutGrid}
        actions={
          <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-muted-foreground bg-background/50 backdrop-blur-md px-4 py-2 rounded-xl border border-border/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            AUTO-REFRESHING
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Tracked Schools", value: stats?.totalSchools || 0, icon: Building2, sub: "+2 this month", subColor: "text-emerald-600", trend: TrendingUp },
          { title: "Critical Priority", value: stats?.byPriority?.critical || 0, icon: AlertTriangle, sub: "Require immediate budget", subColor: "text-destructive", destructive: true },
          { title: "High Priority", value: stats?.byPriority?.high || 0, icon: AlertTriangle, sub: "Need assessment in 6 months", subColor: "text-amber-600", warning: true },
          { title: "Low Priority", value: stats?.byPriority?.low || 0, icon: CheckCircle2, sub: "Status optimal", subColor: "text-emerald-600", success: true },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="transition-all duration-300 border border-border/20 bg-card/60 rounded-3xl backdrop-blur-sm shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{kpi.title}</CardTitle>
                <kpi.icon className={cn("h-4 w-4", kpi.destructive ? "text-destructive" : kpi.warning ? "text-amber-500" : kpi.success ? "text-emerald-500" : "text-muted-foreground")} />
              </CardHeader>
              <CardContent>
                <div className={cn("text-3xl font-black tabular-nums", kpi.destructive ? "text-destructive" : kpi.warning ? "text-amber-600" : kpi.success ? "text-emerald-600" : "")}>{kpi.value}</div>
                <p className={cn("text-[10px] font-bold mt-1 flex items-center", kpi.subColor)}>
                  {kpi.trend && <kpi.trend className="h-3 w-3 mr-1" />} {kpi.sub}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Priority Schools List */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-4"
        >
          <Card className="h-full flex flex-col border border-border/20 rounded-3xl bg-card/60 backdrop-blur-sm shadow-none">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/20 pb-4">
              <CardTitle className="text-base font-bold">Top Critical Priority Schools</CardTitle>
              <Badge variant="destructive" className="rounded-full px-4 h-6 uppercase text-[10px] font-black">Attention Needed</Badge>
            </CardHeader>
            <CardContent className="p-0 flex flex-col flex-1">
              <Table wrapperClassName="flex-1 border-none rounded-none bg-transparent backdrop-blur-none">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead>Institution</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.criticalSchools?.map((school: any) => (
                    <TableRow key={school.id} className="group/row">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive font-black text-[10px] group-hover/row:scale-110 transition-transform">
                            {school.code?.substring(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground leading-tight group-hover/row:text-primary transition-colors">
                              {school.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                              {school.district}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-destructive/10 text-destructive font-black text-[10px]">
                          {school.overallScore}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive" className="rounded-full text-[8px] font-black uppercase tracking-tighter px-2">Critical</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {(!stats?.criticalSchools || stats.criticalSchools.length === 0) && (
                <div className="text-center p-12 text-muted-foreground bg-muted/20 rounded-2xl border-2 border-dashed border-border/20 m-6">
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-emerald-500/30" />
                  <p className="font-bold">No critical schools identified currently.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Provincial Distribution */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-3"
        >
          <Card className="h-full border border-border/20 bg-card/60 backdrop-blur-sm">
            <CardHeader className="border-b border-border/20 pb-4">
              <CardTitle className="text-base font-bold">Provincial Distribution</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {stats?.provinceStats?.map((p: any) => (
                  <div key={p.province} className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-foreground/80">{p.province}</span>
                      <span className="text-[10px] font-black uppercase text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{p.total} schools</span>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-3 overflow-hidden flex">
                      {Number(p.critical) > 0 && (
                        <div 
                          className="bg-destructive h-full transition-all duration-1000" 
                          style={{ width: `${(Number(p.critical) / Number(p.total)) * 100}%` }}
                          title={`Critical: ${p.critical}`}
                        />
                      )}
                      {Number(p.high) > 0 && (
                        <div 
                          className="bg-amber-500 h-full transition-all duration-1000" 
                          style={{ width: `${(Number(p.high) / Number(p.total)) * 100}%` }}
                          title={`High: ${p.high}`}
                        />
                      )}
                      {(Number(p.total) - Number(p.critical) - Number(p.high)) > 0 && (
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-1000" 
                          style={{ width: `${((Number(p.total) - Number(p.critical) - Number(p.high)) / Number(p.total)) * 100}%` }}
                          title={`Optimal: ${Number(p.total) - Number(p.critical) - Number(p.high)}`}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
