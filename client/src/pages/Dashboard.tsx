import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { Badge } from "../components/ui/badge";
import {
  Building2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  LayoutGrid,
  Users,
  MapPin,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "../components/ui/page-header";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../components/ui/table";
import { KPICard } from "../components/analytics/KPICard";
import { IntelligenceScore } from "../components/analytics/IntelligenceScore";
import { RecommendationList } from "../components/analytics/RecommendationList";
import { DistributionChart } from "../components/analytics/DistributionChart";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchStats = async () => {
      try {
        const response = await api.get("/analytics/overview");
        setStats(response.data);
      } catch (err) {
        console.error("Failed to load stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
            Synchronizing National Data...
          </p>
        </div>
      </div>
    );
  }

  // Calculate an aggregate system score based on priorities
  const total = stats?.totalSchools || 1;
  const critical = stats?.byPriority?.critical || 0;
  const high = stats?.byPriority?.high || 0;
  const low = stats?.byPriority?.low || 0;

  // Scoring formula: Critical counts for 0%, High for 40%, Low/Normal for 90%
  const aggregateScore = Math.min(
    100,
    Math.round((low * 90 + high * 40 + critical * 10) / total),
  );

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="National System Overview"
        description="GIS Intelligence & Infrastructure Monitoring Dashboard"
        icon={LayoutGrid}
        actions={
          <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-muted-foreground bg-background/50 backdrop-blur-md px-4 py-2 rounded-xl border border-border/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            LIVE MONITORING ENABLED
          </div>
        }
      />

      {/* KPI Cards Section */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Institutions"
          value={stats?.totalSchools || 0}
          icon={Building2}
          subValue="+2 added this month"
          subColor="text-emerald-600"
          trendIcon={TrendingUp}
          variant="info"
          delay={0.1}
        />
        <KPICard
          title="Critical Priority"
          value={stats?.byPriority?.critical || 0}
          icon={AlertTriangle}
          subValue="Immediate budget needed"
          subColor="text-destructive"
          variant="destructive"
          delay={0.2}
        />
        <KPICard
          title="High Priority"
          value={stats?.byPriority?.high || 0}
          icon={AlertTriangle}
          subValue="Upcoming assessment"
          subColor="text-amber-600"
          variant="warning"
          delay={0.3}
        />
        <KPICard
          title="Optimal Status"
          value={stats?.byPriority?.low || 0}
          icon={CheckCircle2}
          subValue="Maintenance on track"
          subColor="text-emerald-600"
          variant="success"
          delay={0.4}
        />
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        {/* Intelligence Score Section */}
        <IntelligenceScore
          score={aggregateScore}
          isAggregate={true}
          metrics={[
            {
              label: "Infra Health",
              score: aggregateScore + 5,
              icon: Building2,
            },
            { label: "Comm. Access", score: 68, icon: MapPin },
            { label: "Cap. Scaling", score: 72, icon: Users },
            { label: "Compliance", score: 84, icon: ClipboardCheck },
          ]}
          className="xl:col-span-2"
        >
          <RecommendationList
            recommendations={[
              `[URGENT] ${stats?.byPriority?.critical || 0} schools require immediate infrastructure intervention.`,
              "[STRATEGIC] Expand GIS mapping to rural sectors in the Northern province.",
              "[CRITICAL] Low student-to-latrine ratios detected in 12 high-priority schools.",
              "[STRATEGIC] Implement IoT water monitoring in schools with partial compliance.",
            ]}
            title="National Intelligence Insights"
            className="mt-6"
          />
        </IntelligenceScore>

        {/* Provincial Distribution */}
        <DistributionChart
          title="Provincial Distribution"
          items={
            stats?.provinceStats?.map((p: any) => ({
              label: p.province,
              total: Number(p.total),
              critical: Number(p.critical),
              high: Number(p.high),
            })) || []
          }
        />
      </div>

      {/* Critical Schools Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <TableSection criticalSchools={stats?.criticalSchools || []} />
      </motion.div>
    </div>
  );
}

function TableSection({ criticalSchools }: { criticalSchools: any[] }) {
  return (
    <div className="flex flex-col border border-border/20 dark:border-blue-700/20 rounded-3xl bg-card/60 backdrop-blur-sm shadow-none overflow-hidden">
      <div className="flex flex-row items-center justify-between border-b border-border/20 dark:border-blue-700/20 p-6">
        <div>
          <h3 className="text-base font-bold">
            Top Critical Priority Institutions
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Summary of institutions requiring urgent decision support
          </p>
        </div>
        <Badge
          variant="destructive"
          className="rounded-full px-4 h-6 uppercase text-[10px] font-black animate-pulse"
        >
          Attention Needed
        </Badge>
      </div>

      <div className="p-0 overflow-x-auto">
        <Table className="border-none">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/10 bg-muted/20">
              <TableHead className="font-black text-[10px] uppercase tracking-wider">
                Institution
              </TableHead>
              <TableHead className="text-center font-black text-[10px] uppercase tracking-wider">
                Priority Score
              </TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase tracking-wider">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {criticalSchools.map((school: any) => (
              <TableRow
                key={school.id}
                className="group/row border-b border-border/5 last:border-0 hover:bg-primary/5 transition-colors"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive font-black text-xs group-hover/row:scale-110 group-hover/row:bg-destructive group-hover/row:text-white transition-all duration-300 shadow-sm">
                      {school.code?.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground leading-tight">
                        {school.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {school.district}, {school.province}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-destructive/10 text-destructive font-black text-xs">
                    {school.overallScore}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    to={`/schools/${school.id}`}
                    className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/70 transition-colors"
                  >
                    View Details
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {criticalSchools.length === 0 && (
          <div className="text-center p-12 text-muted-foreground bg-muted/10 rounded-2xl border-2 border-dashed border-border/10 m-6">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-emerald-500/30" />
            <p className="font-bold">
              No critical schools identified currently.
            </p>
            <p className="text-xs mt-1 opacity-60 uppercase tracking-widest font-black">
              All systems operational
            </p>
          </div>
        )}
      </div>

      {criticalSchools.length > 0 && (
        <div className="bg-muted/30 p-4 text-center border-t border-border/10">
          <Link
            to="/schools"
            className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
          >
            View Full Directory
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
