import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Download, Info, RefreshCw, Layers } from "lucide-react";
import { format } from "date-fns";
import { PageHeader } from "../components/ui/page-header";

export default function AnalyticsDecisions() {
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchDecisions();
  }, []);

  const fetchDecisions = async () => {
    setLoading(true);
    try {
      const response = await api.get("/analytics/decisions");
      setDecisions(response.data);
    } catch (err) {
      console.error("Failed to load decisions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await api.post("/analytics/recalculate");
      await fetchDecisions();
    } catch (err) {
      console.error("Failed to recalculate", err);
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decision Engineering"
        description="Automated infrastructure scoring and recommendations"
        icon={Layers}
        actions={
          <>
            <Button
              variant="outline"
              className="gap-2 h-10 rounded-xl font-black uppercase text-[10px] tracking-wider px-6 shadow-none flex-1 md:flex-none border-border/20 bg-background/50 hover:bg-primary/5 transition-colors"
              onClick={handleRecalculate}
              disabled={recalculating}
            >
              <RefreshCw
                className={`w-4 h-4 ${recalculating ? "animate-spin" : ""}`}
              />
              {recalculating ? "Processing..." : "Recalculate All"}
            </Button>
            <Button className="gap-2 h-10 rounded-xl font-black uppercase text-[10px] tracking-wider px-6 flex-1 md:flex-none bg-linear-to-r from-primary to-primary/80 hover:bg-primary transition-colors">
              <Download className="w-4 h-4" /> Export Report
            </Button>
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1 h-fit border border-border/20 bg-card/60 backdrop-blur-xl rounded-3xl shadow-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Scoring Weights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Infrastructure State</span>
                <span className="text-muted-foreground">40%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full w-[40%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Building Age Matrix</span>
                <span className="text-muted-foreground">30%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-primary/80 h-2 rounded-full w-[30%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Population Pressure</span>
                <span className="text-muted-foreground">15%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-primary/60 h-2 rounded-full w-[15%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Accessibility Index</span>
                <span className="text-muted-foreground">15%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-primary/40 h-2 rounded-full w-[15%]"></div>
              </div>
            </div>

            <div className="pt-4 border-t mt-4 flex items-start gap-3 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg text-sm text-blue-800 dark:text-blue-300">
              <Info className="w-5 h-5 shrink-0" />
              <p>
                Algorithms process drone KMZ 3D models against ArcGIS
                demographic data to output objective renovation priorities.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 border border-border/20 bg-card/60 backdrop-blur-xl rounded-3xl shadow-none overflow-hidden">
          <CardHeader>
            <CardTitle>AI Intervention Recommendations</CardTitle>
            <CardDescription>
              Ranked by urgency and overall score
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                  Loading AI insights...
                </div>
              ) : decisions.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  No assessments found. Run recalculation.
                </div>
              ) : (
                decisions.map((d: any) => (
                  <div
                    key={d.id}
                    className="p-6 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-lg">
                            {d.school?.name}
                          </h3>
                          <Badge
                            variant={
                              d.priorityLevel === "critical"
                                ? "destructive"
                                : d.priorityLevel === "high"
                                  ? "warning"
                                  : "outline"
                            }
                            className="capitalize"
                          >
                            {d.priorityLevel}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {d.school?.district}, {d.school?.province} • Assessed{" "}
                          {format(new Date(d.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-center bg-slate-100 dark:bg-slate-800 rounded-lg p-2 min-w-[80px]">
                          <div className="text-2xl font-bold font-mono text-primary">
                            {d.overallScore}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Total Score
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                      <div className="p-3 border rounded-md">
                        <div className="text-muted-foreground mb-1">
                          Infrastructure
                        </div>
                        <div className="font-semibold">
                          {d.infrastructureScore}/100
                        </div>
                      </div>
                      <div className="p-3 border rounded-md">
                        <div className="text-muted-foreground mb-1">
                          Age Penalty
                        </div>
                        <div className="font-semibold">
                          {d.buildingAgeScore}/100
                        </div>
                      </div>
                      <div className="p-3 border rounded-md">
                        <div className="text-muted-foreground mb-1">
                          Population
                        </div>
                        <div className="font-semibold">
                          {d.populationPressureScore}/100
                        </div>
                      </div>
                      <div className="p-3 border rounded-md">
                        <div className="text-muted-foreground mb-1">Access</div>
                        <div className="font-semibold">
                          {d.accessibilityScore}/100
                        </div>
                      </div>
                    </div>

                    {d.recommendations && d.recommendations.length > 0 && (
                      <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg p-4">
                        <h4 className="text-sm font-semibold mb-2 text-amber-800 dark:text-amber-400">
                          System Recommendations
                        </h4>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                          {d.recommendations.map((rec: string, i: number) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
