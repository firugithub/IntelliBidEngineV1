import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp, Clock, DollarSign, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AgentMetricsSummary {
  totalEvaluations: number;
  totalAgentExecutions: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  overallSuccessRate: number;
  avgExecutionTimeMs: number;
}

interface AgentStats {
  agentRole: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgExecutionTimeMs: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  avgTokensPerExecution: number;
  avgCostPerExecution: number;
  lastExecuted?: string;
}

interface AgentFailure {
  evaluationId: string;
  projectId: string;
  vendorName: string;
  agentRole: string;
  executionTimeMs: number;
  tokenUsage: number;
  estimatedCostUsd: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  timestamp: string;
}

interface ProjectMetrics {
  projectId: string;
  projectName: string;
  totalEvaluations: number;
  totalAgentExecutions: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  successRate: number;
  avgExecutionTimeMs: number;
}

export default function AgentMetricsPage() {
  const { data: summary, isLoading: summaryLoading } = useQuery<AgentMetricsSummary>({
    queryKey: ["/api/agent-metrics/summary"],
  });

  const { data: agentStats, isLoading: agentsLoading } = useQuery<AgentStats[]>({
    queryKey: ["/api/agent-metrics/agents"],
  });

  const { data: failures, isLoading: failuresLoading } = useQuery<AgentFailure[]>({
    queryKey: ["/api/agent-metrics/failures"],
  });

  const { data: projectMetrics, isLoading: projectsLoading } = useQuery<ProjectMetrics[]>({
    queryKey: ["/api/agent-metrics/projects"],
  });

  if (summaryLoading || agentsLoading || failuresLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading agent metrics...</p>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatCost = (usd: number) => {
    return `$${usd.toFixed(4)}`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Agent Metrics</h1>
        <p className="text-muted-foreground">
          Real-time performance analytics for the 6-agent evaluation pipeline
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-executions">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalAgentExecutions || 0}</div>
            <p className="text-xs text-muted-foreground">{summary?.totalEvaluations || 0} evaluations</p>
          </CardContent>
        </Card>

        <Card data-testid="card-success-rate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.overallSuccessRate ? `${summary.overallSuccessRate.toFixed(1)}%` : "0%"}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all agents
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-execution-time">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Execution Time</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.avgExecutionTimeMs ? formatDuration(summary.avgExecutionTimeMs) : "0ms"}
            </div>
            <p className="text-xs text-muted-foreground">Per agent</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-cost">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.totalCostUsd ? formatCost(summary.totalCostUsd) : "$0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.totalTokensUsed?.toLocaleString() || 0} tokens
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Agent Statistics */}
      <Card data-testid="card-agent-performance">
        <CardHeader>
          <CardTitle>Agent Performance Statistics</CardTitle>
          <CardDescription>Individual metrics for each of the 6 specialized agents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {agentStats && agentStats.length > 0 ? (
              agentStats.map((stats) => (
                <div key={stats.agentRole} className="border-b pb-4 last:border-0" data-testid={`agent-stats-${stats.agentRole}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold capitalize">{stats.agentRole} Agent</h3>
                    <div className="flex items-center gap-2">
                      {stats.successRate === 100 ? (
                        <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
                      ) : stats.successRate > 0 ? (
                        <AlertCircle className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {stats.successRate.toFixed(1)}% success
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Executions</p>
                      <p className="font-medium">{stats.totalExecutions}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Time</p>
                      <p className="font-medium">{formatDuration(stats.avgExecutionTimeMs)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tokens</p>
                      <p className="font-medium">{stats.totalTokensUsed.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cost</p>
                      <p className="font-medium">{formatCost(stats.totalCostUsd)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No agent executions recorded yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Project-Level Metrics */}
      <Card data-testid="card-project-metrics">
        <CardHeader>
          <CardTitle>Performance by Project</CardTitle>
          <CardDescription>Agent execution statistics grouped by evaluation project</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projectMetrics && projectMetrics.length > 0 ? (
              projectMetrics.map((project) => (
                <div key={project.projectId} className="border-b pb-4 last:border-0" data-testid={`project-metrics-${project.projectId}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{project.projectId}</h3>
                      <p className="text-sm text-muted-foreground">{project.projectName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {project.successRate === 100 ? (
                        <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
                      ) : project.successRate > 0 ? (
                        <AlertCircle className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {project.successRate.toFixed(1)}% success
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Evaluations</p>
                      <p className="font-medium">{project.totalEvaluations}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Agent Runs</p>
                      <p className="font-medium">{project.totalAgentExecutions}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Time</p>
                      <p className="font-medium">{formatDuration(project.avgExecutionTimeMs)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tokens</p>
                      <p className="font-medium">{project.totalTokensUsed.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cost</p>
                      <p className="font-medium">{formatCost(project.totalCostUsd)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Cost/Eval</p>
                      <p className="font-medium">{formatCost(project.totalCostUsd / project.totalEvaluations)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No project metrics available yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Failures */}
      {failures && failures.length > 0 && (
        <Card data-testid="card-recent-failures">
          <CardHeader>
            <CardTitle>Recent Failures</CardTitle>
            <CardDescription>Last {failures.length} failed agent executions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {failures.map((failure: any, index: number) => (
                <div key={index} className="border rounded-md p-3" data-testid={`failure-${index}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                        <span className="font-semibold capitalize">{failure.agentRole}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(failure.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Project: {failure.projectId}
                      </p>
                      <p className="text-sm text-muted-foreground mb-1">
                        Vendor: {failure.vendorName}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
                          {failure.errorType}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDuration(failure.executionTimeMs)}
                        </span>
                      </div>
                      {failure.errorMessage && (
                        <p className="text-xs text-muted-foreground mt-2 font-mono">
                          {failure.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(!failures || failures.length === 0) && (
        <Alert data-testid="alert-no-failures">
          <CheckCircle className="w-4 h-4" />
          <AlertDescription>
            No agent failures recorded. All executions completed successfully!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
