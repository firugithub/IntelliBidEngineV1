import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreCard } from "@/components/ScoreCard";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  FileText, 
  Users, 
  TrendingUp, 
  Activity,
  ChevronRight,
  Loader2,
  AlertCircle,
  Trophy,
  Medal,
  Award
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface GlobalStats {
  totalPortfolios: number;
  totalProjects: number;
  totalRfts: number;
  totalEvaluations: number;
  totalVendors: number;
  activeProjects: number;
  completedProjects: number;
}

interface StageDistribution {
  stageNumber: number;
  stageName: string;
  vendorCount: number;
}

interface VendorLeader {
  vendorName: string;
  projectCount: number;
  avgScore: number;
  totalStageProgress: number;
}

interface RecentActivity {
  type: "project_created" | "evaluation_completed" | "stage_updated";
  projectId: string;
  projectName: string;
  portfolioName: string;
  vendorName?: string;
  timestamp: string;
  description: string;
}

export default function ExecutiveSummaryPage() {
  const [, setLocation] = useLocation();

  const { data: stats, isLoading: statsLoading } = useQuery<GlobalStats>({
    queryKey: ["/api/executive-summary/stats"],
  });

  const { data: stageDistribution, isLoading: distributionLoading } = useQuery<StageDistribution[]>({
    queryKey: ["/api/executive-summary/stage-distribution"],
  });

  const { data: vendorLeaders, isLoading: leadersLoading } = useQuery<VendorLeader[]>({
    queryKey: ["/api/executive-summary/vendor-leaders"],
  });

  const { data: recentActivity, isLoading: activityLoading } = useQuery<RecentActivity[]>({
    queryKey: ["/api/executive-summary/recent-activity"],
  });

  const isLoading = statsLoading || distributionLoading || leadersLoading || activityLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading executive summary...</p>
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "project_created":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "evaluation_completed":
        return <Activity className="h-4 w-4 text-green-500" />;
      case "stage_updated":
        return <TrendingUp className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Executive Summary</h1>
              <p className="text-muted-foreground">
                Global visibility across all portfolios and projects
              </p>
            </div>
            <Button
              onClick={() => setLocation("/")}
              variant="outline"
              className="gap-2"
              data-testid="button-view-portfolios"
            >
              <Building2 className="h-4 w-4" />
              View Portfolios
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Global Metrics */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Global Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <ScoreCard
                title="Total Portfolios"
                value={stats?.totalPortfolios.toString() || "0"}
                subtitle="Active business units"
                icon={Building2}
                trend="neutral"
                data-testid="card-total-portfolios"
              />
              <ScoreCard
                title="Total Projects"
                value={stats?.totalProjects.toString() || "0"}
                subtitle={`${stats?.activeProjects || 0} active, ${stats?.completedProjects || 0} completed`}
                icon={FileText}
                trend={stats?.activeProjects ? "up" : "neutral"}
                data-testid="card-total-projects"
              />
              <ScoreCard
                title="RFTs Generated"
                value={stats?.totalRfts.toString() || "0"}
                subtitle="Across all projects"
                icon={FileText}
                trend="neutral"
                data-testid="card-total-rfts"
              />
              <ScoreCard
                title="Vendors Evaluated"
                value={stats?.totalVendors.toString() || "0"}
                subtitle={`${stats?.totalEvaluations || 0} total evaluations`}
                icon={Users}
                trend="neutral"
                data-testid="card-total-vendors"
              />
            </div>
          </div>

          {/* Stage Distribution Chart */}
          <Card data-testid="card-stage-distribution">
            <CardHeader>
              <CardTitle>Procurement Stage Distribution</CardTitle>
              <CardDescription>
                Vendor count at each stage of the 10-stage procurement workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stageDistribution && stageDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={stageDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="stageNumber" 
                      label={{ value: "Stage", position: "insideBottom", offset: -5 }}
                    />
                    <YAxis 
                      label={{ value: "Vendor Count", angle: -90, position: "insideLeft" }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-card border rounded-md p-3 shadow-lg">
                              <p className="font-semibold">{payload[0].payload.stageName}</p>
                              <p className="text-sm text-muted-foreground">
                                {payload[0].value} vendor{payload[0].value !== 1 ? 's' : ''}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Bar dataKey="vendorCount" fill="hsl(var(--primary))" name="Vendors" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No vendor stage data available
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Vendor Leaders */}
            <Card data-testid="card-vendor-leaders">
              <CardHeader>
                <CardTitle>Top Vendors</CardTitle>
                <CardDescription>
                  Leading vendors by project count and evaluation scores
                </CardDescription>
              </CardHeader>
              <CardContent>
                {vendorLeaders && vendorLeaders.length > 0 ? (
                  <div className="space-y-3">
                    {vendorLeaders.map((vendor, index) => {
                      const getRankColor = (rank: number) => {
                        switch (rank) {
                          case 0: return "bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30";
                          case 1: return "bg-gradient-to-r from-slate-400/10 to-slate-500/10 border-slate-400/30";
                          case 2: return "bg-gradient-to-r from-orange-600/10 to-orange-700/10 border-orange-600/30";
                          default: return "bg-card border";
                        }
                      };

                      const getRankBadge = (rank: number) => {
                        switch (rank) {
                          case 0: return { icon: Trophy, color: "text-yellow-600 dark:text-yellow-500" };
                          case 1: return { icon: Medal, color: "text-slate-500 dark:text-slate-400" };
                          case 2: return { icon: Award, color: "text-orange-600 dark:text-orange-500" };
                          default: return { icon: null, text: `#${rank + 1}`, color: "text-muted-foreground" };
                        }
                      };

                      const getScoreColor = (score: number) => {
                        if (score >= 80) return "text-green-600 dark:text-green-500";
                        if (score >= 60) return "text-blue-600 dark:text-blue-500";
                        if (score >= 40) return "text-yellow-600 dark:text-yellow-500";
                        return "text-orange-600 dark:text-orange-500";
                      };

                      const rankBadge = getRankBadge(index);

                      return (
                        <div
                          key={vendor.vendorName}
                          className={`flex items-center gap-4 p-4 rounded-md hover-elevate border ${getRankColor(index)}`}
                          data-testid={`vendor-leader-${index}`}
                        >
                          <div className={`flex items-center justify-center ${rankBadge.color} min-w-[50px]`}>
                            {rankBadge.icon ? (
                              <rankBadge.icon className="h-8 w-8" strokeWidth={2.5} />
                            ) : (
                              <span className="text-3xl font-bold">{rankBadge.text}</span>
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-base">{vendor.vendorName}</p>
                              <span className={`text-2xl font-bold font-mono ${getScoreColor(vendor.avgScore)}`}>
                                {vendor.avgScore}%
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 text-sm">
                                <div className="h-2 w-2 rounded-full bg-primary"></div>
                                <span className="text-muted-foreground">
                                  {vendor.projectCount} project{vendor.projectCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                <span className="text-muted-foreground">
                                  Stage {vendor.totalStageProgress}/10
                                </span>
                              </div>
                            </div>
                            <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  vendor.avgScore >= 80 
                                    ? "bg-gradient-to-r from-green-500 to-emerald-600" 
                                    : vendor.avgScore >= 60 
                                    ? "bg-gradient-to-r from-blue-500 to-cyan-600"
                                    : vendor.avgScore >= 40
                                    ? "bg-gradient-to-r from-yellow-500 to-amber-600"
                                    : "bg-gradient-to-r from-orange-500 to-red-600"
                                }`}
                                style={{ width: `${vendor.avgScore}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No vendor data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity Feed */}
            <Card data-testid="card-recent-activity">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest updates across all portfolios and projects
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity && recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {recentActivity.map((activity, index) => (
                      <button
                        key={`${activity.projectId}-${activity.timestamp}-${index}`}
                        onClick={() => setLocation(`/project/${activity.projectId}`)}
                        className="w-full flex items-start gap-3 p-3 rounded-md hover-elevate active-elevate-2 text-left border"
                        data-testid={`activity-${index}`}
                      >
                        <div className="mt-0.5">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-medium truncate">
                            {activity.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{activity.portfolioName}</span>
                            <ChevronRight className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{activity.projectName}</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTimestamp(activity.timestamp)}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No recent activity
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
