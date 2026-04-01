import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Activity,
  Target,
  Calendar,
  Filter,
  Download,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

interface ReportingTabProps {
  schoolId: string;
  reportingData: any;
}

export const ReportingTab = React.memo(({ schoolId, reportingData }: ReportingTabProps) => {
  const [activeSubTab, setActiveSubTab] = useState("overview");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 p-1 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/20">
        {[
          { id: "overview", label: "Overview", icon: BarChart3 },
          { id: "trends", label: "Trends", icon: TrendingUp },
          { id: "issues", label: "Issues", icon: AlertTriangle },
          { id: "performance", label: "Performance", icon: Activity },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeSubTab === tab.id
                ? "bg-primary text-white shadow-sm"
                : "text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/10"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Based on Active Tab */}
      {activeSubTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Key Metrics */}
          <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
              <CardTitle className="text-base font-medium flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                Total Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
                  {reportingData?.totalReports || 0}
                </div>
                <div className="flex items-center justify-center gap-4 text-sm text-slate-500 dark:text-white/60">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>+12% from last month</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
              <CardTitle className="text-base font-medium flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Critical Issues
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-red-600 dark:text-red-400 mb-2">
                  {reportingData?.criticalIssues || 0}
                </div>
                <div className="text-sm text-slate-500 dark:text-white/60">
                  Requires immediate attention
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
              <CardTitle className="text-base font-medium flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                Resolved This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                  {reportingData?.resolvedIssues || 0}
                </div>
                <div className="flex items-center justify-center gap-4 text-sm text-slate-500 dark:text-white/60">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>+24% resolution rate</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
              <CardTitle className="text-base font-medium flex items-center gap-3">
                <Activity className="w-5 h-5 text-blue-500" />
                Avg Resolution Time
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {reportingData?.avgResolutionTime || 0}
                  <span className="text-lg font-normal text-slate-500 dark:text-white/60"> days</span>
                </div>
                <div className="text-sm text-slate-500 dark:text-white/60">
                  -18% improvement
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSubTab === "trends" && (
        <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
            <CardTitle className="text-base font-medium flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              Reporting Trends
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Monthly Trends Chart Placeholder */}
              <div className="h-64 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/20 flex items-center justify-center">
                <div className="text-center text-slate-500 dark:text-white/60">
                  <BarChart3 className="w-12 h-12 mb-2" />
                  <p>Monthly reporting trends visualization</p>
                  <p className="text-sm">Integration with chart library recommended</p>
                </div>
              </div>
              
              {/* Key Insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/20">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Peak Month</h4>
                  <p className="text-2xl font-bold text-primary">March</p>
                  <p className="text-xs text-slate-500 dark:text-white/60">45 reports filed</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/20">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Resolution Rate</h4>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">87%</p>
                  <p className="text-xs text-slate-500 dark:text-white/60">Above target</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeSubTab === "issues" && (
        <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
            <CardTitle className="text-base font-medium flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Recent Issues
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Filter Options */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-white/60">
                  <Filter className="w-4 h-4" />
                  <span>Filter by:</span>
                </div>
                <div className="flex gap-2">
                  {["All", "Critical", "High", "Medium", "Low"].map((priority) => (
                    <Button
                      key={priority}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "text-xs",
                        priority === "All" && "bg-primary text-white"
                      )}
                    >
                      {priority}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Issues List Placeholder */}
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/20"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                          Issue #{i + 1001}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-white/60 mb-2">
                          Building A - Electrical malfunction in main hall
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={cn(
                            "text-xs",
                            i === 0 ? "bg-red-500/10 text-red-600 border-red-500/20" :
                            i === 1 ? "bg-orange-500/10 text-orange-600 border-orange-500/20" :
                            "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          )}>
                            {i === 0 ? "Critical" : i === 1 ? "High" : "Medium"}
                          </Badge>
                          <span className="text-xs text-slate-400 dark:text-white/60">
                            Reported 2 days ago
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/60">
                        Assigned to: Maintenance Team
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 dark:text-white/60">
                      Status: In Progress
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeSubTab === "performance" && (
        <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
            <CardTitle className="text-base font-medium flex items-center gap-3">
              <Target className="w-5 h-5 text-purple-500" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Response Time", value: "2.4 days", trend: "-15%", color: "emerald" },
                { label: "Resolution Rate", value: "87%", trend: "+8%", color: "blue" },
                { label: "Reopen Rate", value: "12%", trend: "-5%", color: "amber" },
                { label: "Customer Satisfaction", value: "4.6/5", trend: "+12%", color: "purple" },
              ].map((metric, index) => (
                <div
                  key={metric.label}
                  className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/20"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-white/80">
                      {metric.label}
                    </span>
                    <div className={cn(
                      "flex items-center gap-1 text-xs",
                      metric.trend.startsWith("+") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {metric.trend.startsWith("+") ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingUp className="w-3 h-3 rotate-180" />
                      )}
                      <span>{metric.trend}</span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {metric.value}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/60">
                    {metric.label === "Customer Satisfaction" ? "out of 5" : "target: 3 days"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs">
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh Data
          </Button>
          <Button variant="outline" size="sm" className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Export Report
          </Button>
        </div>
        <div className="text-xs text-slate-400 dark:text-white/60">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
});
