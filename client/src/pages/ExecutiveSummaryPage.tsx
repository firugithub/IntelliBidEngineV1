import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Award,
  BarChart3,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles
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
        return <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "evaluation_completed":
        return <Activity className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case "stage_updated":
        return <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Professional Hero Section */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="absolute inset-0 bg-grid-slate-900/[0.04] dark:bg-grid-slate-400/[0.05]" />
        <div className="container relative mx-auto px-6 py-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5 px-3 py-1">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Executive Dashboard
                </Badge>
              </div>
              <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">
                Portfolio Intelligence
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                Comprehensive oversight of vendor evaluations, procurement workflows, 
                and strategic initiatives across all business units.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setLocation("/")}
                variant="outline"
                className="gap-2"
                data-testid="button-view-portfolios"
              >
                <Building2 className="h-4 w-4" />
                View Portfolios
              </Button>
              <Button
                onClick={() => setLocation("/generate-mock-data")}
                className="gap-2"
                data-testid="button-generate-data"
              >
                <TrendingUp className="h-4 w-4" />
                Generate Data
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-10">
        <div className="space-y-10">
          {/* Enhanced Global Metrics */}
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Key Performance Indicators</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Real-time metrics across your enterprise portfolio
                </p>
              </div>
              <Badge variant="secondary" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Live
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="hover-elevate transition-all duration-300" data-testid="card-total-portfolios">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Portfolios</CardTitle>
                  <div className="p-2 rounded-lg bg-blue-500/10 dark:bg-blue-400/10">
                    <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats?.totalPortfolios || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active business units
                  </p>
                  <div className="mt-3 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                    <TrendingUp className="h-3 w-3" />
                    <span className="font-medium">Portfolio growth</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate transition-all duration-300" data-testid="card-total-projects">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Projects</CardTitle>
                  <div className="p-2 rounded-lg bg-green-500/10 dark:bg-green-400/10">
                    <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats?.totalProjects || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.activeProjects || 0} active • {stats?.completedProjects || 0} completed
                  </p>
                  <div className="mt-3 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <ArrowUpRight className="h-3 w-3" />
                    <span className="font-medium">Active pipeline</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate transition-all duration-300" data-testid="card-total-rfts">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">RFTs Generated</CardTitle>
                  <div className="p-2 rounded-lg bg-purple-500/10 dark:bg-purple-400/10">
                    <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats?.totalRfts || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across all portfolios
                  </p>
                  <div className="mt-3 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                    <Sparkles className="h-3 w-3" />
                    <span className="font-medium">AI-powered creation</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate transition-all duration-300" data-testid="card-total-vendors">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Vendors</CardTitle>
                  <div className="p-2 rounded-lg bg-orange-500/10 dark:bg-orange-400/10">
                    <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats?.totalVendors || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.totalEvaluations || 0} total evaluations
                  </p>
                  <div className="mt-3 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                    <ArrowUpRight className="h-3 w-3" />
                    <span className="font-medium">Growing network</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Enhanced Stage Distribution Chart */}
          <Card className="hover-elevate transition-all duration-300" data-testid="card-stage-distribution">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">Procurement Workflow Distribution</CardTitle>
                  <CardDescription className="mt-1.5">
                    Vendor progress across the 10-stage enterprise procurement lifecycle
                  </CardDescription>
                </div>
                <Badge variant="secondary">10 Stages</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {stageDistribution && stageDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={450}>
                  <BarChart data={stageDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                    <defs>
                      <linearGradient id="colorVendors" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.6}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="stageNumber" 
                      label={{ value: "Procurement Stage", position: "insideBottom", offset: -10, style: { fontSize: 14, fill: 'hsl(var(--muted-foreground))' } }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      label={{ value: "Active Vendors", angle: -90, position: "insideLeft", style: { fontSize: 14, fill: 'hsl(var(--muted-foreground))' } }}
                      allowDecimals={false}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-card border rounded-lg p-4 shadow-xl">
                              <p className="font-bold text-base mb-1">{payload[0].payload.stageName}</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <Users className="h-3.5 w-3.5" />
                                {payload[0].value} vendor{payload[0].value !== 1 ? 's' : ''} active
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                    />
                    <Bar 
                      dataKey="vendorCount" 
                      fill="url(#colorVendors)" 
                      name="Active Vendors"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-20 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No vendor stage data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Enhanced Vendor Leaders */}
            <Card className="hover-elevate transition-all duration-300" data-testid="card-vendor-leaders">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                      Top Performing Vendors
                    </CardTitle>
                    <CardDescription className="mt-1.5">
                      Ranked by evaluation quality scores and project engagement
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Top 5
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {vendorLeaders && vendorLeaders.length > 0 ? (
                  <div className="space-y-4">
                    {vendorLeaders.map((vendor, index) => {
                      const getRankColor = (rank: number) => {
                        switch (rank) {
                          case 0: return "bg-gradient-to-br from-yellow-500/10 to-amber-500/5 dark:from-yellow-400/10 dark:to-amber-400/5 border-yellow-500/40 dark:border-yellow-400/40";
                          case 1: return "bg-gradient-to-br from-slate-400/10 to-slate-500/5 dark:from-slate-300/10 dark:to-slate-400/5 border-slate-400/40 dark:border-slate-300/40";
                          case 2: return "bg-gradient-to-br from-orange-600/10 to-orange-700/5 dark:from-orange-500/10 dark:to-orange-600/5 border-orange-600/40 dark:border-orange-500/40";
                          default: return "bg-card border-border/50";
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
                          className={`group relative flex items-center gap-4 p-5 rounded-lg hover-elevate active-elevate-2 border-2 transition-all duration-300 ${getRankColor(index)}`}
                          data-testid={`vendor-leader-${index}`}
                        >
                          <div className={`flex items-center justify-center ${rankBadge.color} min-w-[60px]`}>
                            {rankBadge.icon ? (
                              <rankBadge.icon className="h-10 w-10" strokeWidth={2.5} />
                            ) : (
                              <span className="text-4xl font-bold">{rankBadge.text}</span>
                            )}
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between gap-4">
                              <p className="font-bold text-lg leading-tight">{vendor.vendorName}</p>
                              <div className="flex items-baseline gap-1">
                                <span className={`text-3xl font-bold font-mono ${getScoreColor(vendor.avgScore)}`}>
                                  {vendor.avgScore}
                                </span>
                                <span className={`text-sm font-medium ${getScoreColor(vendor.avgScore)}`}>%</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary" />
                                <span className="font-medium text-foreground">
                                  {vendor.projectCount} {vendor.projectCount === 1 ? 'Project' : 'Projects'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                <span className="font-medium text-foreground">
                                  Stage {vendor.totalStageProgress}/10
                                </span>
                              </div>
                            </div>
                            <div className="relative w-full bg-muted/40 rounded-full h-2.5 overflow-hidden">
                              <div
                                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                                  vendor.avgScore >= 80 
                                    ? "bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-400 dark:to-emerald-500" 
                                    : vendor.avgScore >= 60 
                                    ? "bg-gradient-to-r from-blue-500 to-cyan-600 dark:from-blue-400 dark:to-cyan-500"
                                    : vendor.avgScore >= 40
                                    ? "bg-gradient-to-r from-yellow-500 to-amber-600 dark:from-yellow-400 dark:to-amber-500"
                                    : "bg-gradient-to-r from-orange-500 to-red-600 dark:from-orange-400 dark:to-red-500"
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
                  <div className="text-center py-20 text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No vendor performance data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enhanced Recent Activity Feed */}
            <Card className="hover-elevate transition-all duration-300" data-testid="card-recent-activity">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Activity Stream
                    </CardTitle>
                    <CardDescription className="mt-1.5">
                      Real-time updates from across your portfolio ecosystem
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Live
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {recentActivity && recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {recentActivity.map((activity, index) => (
                      <button
                        key={`${activity.projectId}-${activity.timestamp}-${index}`}
                        onClick={() => setLocation(`/project/${activity.projectId}`)}
                        className="w-full flex items-start gap-4 p-4 rounded-lg hover-elevate active-elevate-2 text-left border border-border/50 bg-muted/20 transition-all duration-300 group"
                        data-testid={`activity-${index}`}
                      >
                        <div className="flex items-center justify-center h-9 w-9 rounded-full bg-background border shadow-sm group-hover:shadow-md transition-shadow">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <p className="text-sm font-semibold leading-tight">
                            {activity.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate font-medium">{activity.portfolioName}</span>
                            <ChevronRight className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{activity.projectName}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                            {formatTimestamp(activity.timestamp)}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No recent activity to display</p>
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
