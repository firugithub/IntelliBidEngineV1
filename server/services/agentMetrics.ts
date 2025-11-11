import { db } from "../db";
import { agentMetrics } from "@shared/schema";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";

// Agent execution metrics (matches database schema)
export interface AgentExecutionMetric {
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
  timestamp: Date;
}

// Aggregated metrics for analytics
export interface AgentPerformanceStats {
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
  lastExecuted?: Date;
}

// Cost estimation (GPT-4o pricing as of Nov 2024)
const TOKEN_COSTS = {
  inputPerMillion: 2.50,   // $2.50 per 1M input tokens
  outputPerMillion: 10.00  // $10.00 per 1M output tokens
};

class AgentMetricsService {
  private readonly RETENTION_DAYS = 7;
  
  /**
   * Track a single agent execution (saves to database)
   */
  async trackExecution(metric: AgentExecutionMetric): Promise<void> {
    try {
      await db.insert(agentMetrics).values({
        evaluationId: metric.evaluationId,
        projectId: metric.projectId,
        agentRole: metric.agentRole,
        vendorName: metric.vendorName,
        executionTimeMs: metric.executionTimeMs,
        tokenUsage: metric.tokenUsage,
        estimatedCostUsd: metric.estimatedCostUsd.toString(),
        success: metric.success,
        errorType: metric.errorType || null,
        errorMessage: metric.errorMessage || null,
      });
      
      // Log structured data for monitoring
      console.log(JSON.stringify({
        level: metric.success ? 'info' : 'error',
        type: 'agent_execution',
        agentRole: metric.agentRole,
        vendorName: metric.vendorName,
        executionTimeMs: metric.executionTimeMs,
        tokenUsage: metric.tokenUsage,
        estimatedCostUsd: metric.estimatedCostUsd,
        success: metric.success,
        errorType: metric.errorType,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('[AgentMetrics] Failed to save metric:', error);
    }
  }
  
  /**
   * Estimate cost based on token usage
   * Assumes 70% input tokens, 30% output tokens (typical for evaluation tasks)
   * Uses floating-point arithmetic to maintain accuracy for low-token executions
   */
  estimateCost(totalTokens: number): number {
    const inputTokens = totalTokens * 0.7;
    const outputTokens = totalTokens * 0.3;
    
    const inputCost = (inputTokens / 1_000_000) * TOKEN_COSTS.inputPerMillion;
    const outputCost = (outputTokens / 1_000_000) * TOKEN_COSTS.outputPerMillion;
    
    return parseFloat((inputCost + outputCost).toFixed(6));
  }
  
  /**
   * Get performance statistics for a specific agent role
   */
  async getAgentStats(agentRole: string): Promise<AgentPerformanceStats | null> {
    const cutoffDate = this.getCutoffDate();
    
    const metrics = await db
      .select()
      .from(agentMetrics)
      .where(and(
        eq(agentMetrics.agentRole, agentRole),
        gte(agentMetrics.timestamp, cutoffDate)
      ))
      .orderBy(desc(agentMetrics.timestamp));
    
    if (metrics.length === 0) {
      return null;
    }
    
    const successCount = metrics.filter(m => m.success).length;
    const failureCount = metrics.length - successCount;
    const totalTokens = metrics.reduce((sum, m) => sum + m.tokenUsage, 0);
    const totalCost = metrics.reduce((sum, m) => sum + parseFloat(m.estimatedCostUsd), 0);
    const totalTime = metrics.reduce((sum, m) => sum + m.executionTimeMs, 0);
    
    return {
      agentRole,
      totalExecutions: metrics.length,
      successCount,
      failureCount,
      successRate: parseFloat(((successCount / metrics.length) * 100).toFixed(2)),
      avgExecutionTimeMs: Math.round(totalTime / metrics.length),
      totalTokensUsed: totalTokens,
      totalCostUsd: parseFloat(totalCost.toFixed(6)),
      avgTokensPerExecution: Math.round(totalTokens / metrics.length),
      avgCostPerExecution: parseFloat((totalCost / metrics.length).toFixed(6)),
      lastExecuted: metrics[0]?.timestamp
    };
  }
  
  /**
   * Get stats for all agents
   */
  async getAllAgentStats(): Promise<AgentPerformanceStats[]> {
    const cutoffDate = this.getCutoffDate();
    
    const metrics = await db
      .select()
      .from(agentMetrics)
      .where(gte(agentMetrics.timestamp, cutoffDate));
    
    const roles = Array.from(new Set(metrics.map(m => m.agentRole)));
    const stats = await Promise.all(roles.map(role => this.getAgentStats(role)));
    return stats.filter(Boolean) as AgentPerformanceStats[];
  }
  
  /**
   * Get evaluation-level metrics
   */
  async getEvaluationMetrics(evaluationId: string): Promise<{
    totalExecutionTimeMs: number;
    totalTokensUsed: number;
    totalCostUsd: number;
    agentsSucceeded: number;
    agentsFailed: number;
    agentBreakdown: Record<string, { success: boolean; timeMs: number; tokens: number; costUsd: number }>;
  }> {
    const evalMetrics = await db
      .select()
      .from(agentMetrics)
      .where(eq(agentMetrics.evaluationId, evaluationId));
    
    const agentBreakdown: Record<string, any> = {};
    evalMetrics.forEach(m => {
      agentBreakdown[m.agentRole] = {
        success: m.success,
        timeMs: m.executionTimeMs,
        tokens: m.tokenUsage,
        costUsd: parseFloat(m.estimatedCostUsd)
      };
    });
    
    return {
      totalExecutionTimeMs: evalMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0),
      totalTokensUsed: evalMetrics.reduce((sum, m) => sum + m.tokenUsage, 0),
      totalCostUsd: parseFloat(evalMetrics.reduce((sum, m) => sum + parseFloat(m.estimatedCostUsd), 0).toFixed(6)),
      agentsSucceeded: evalMetrics.filter(m => m.success).length,
      agentsFailed: evalMetrics.filter(m => !m.success).length,
      agentBreakdown
    };
  }
  
  /**
   * Get recent failures for debugging
   */
  async getRecentFailures(limit: number = 10): Promise<AgentExecutionMetric[]> {
    const failures = await db
      .select()
      .from(agentMetrics)
      .where(eq(agentMetrics.success, false))
      .orderBy(desc(agentMetrics.timestamp))
      .limit(limit);
    
    return failures.map(f => ({
      evaluationId: f.evaluationId,
      projectId: f.projectId,
      vendorName: f.vendorName,
      agentRole: f.agentRole,
      executionTimeMs: f.executionTimeMs,
      tokenUsage: f.tokenUsage,
      estimatedCostUsd: parseFloat(f.estimatedCostUsd),
      success: f.success,
      errorType: f.errorType || undefined,
      errorMessage: f.errorMessage || undefined,
      timestamp: f.timestamp
    }));
  }
  
  /**
   * Get time-series data for charting (last N evaluations)
   */
  async getTimeSeriesData(limit: number = 50): Promise<{
    timestamp: Date;
    totalCost: number;
    totalTokens: number;
    executionTime: number;
    successRate: number;
  }[]> {
    const cutoffDate = this.getCutoffDate();
    
    const metrics = await db
      .select()
      .from(agentMetrics)
      .where(gte(agentMetrics.timestamp, cutoffDate))
      .orderBy(desc(agentMetrics.timestamp));
    
    // Group by evaluation
    const evaluationGroups = new Map<string, typeof metrics>();
    
    metrics.forEach(m => {
      if (!evaluationGroups.has(m.evaluationId)) {
        evaluationGroups.set(m.evaluationId, []);
      }
      evaluationGroups.get(m.evaluationId)!.push(m);
    });
    
    return Array.from(evaluationGroups.values()).map(evalMetrics => {
      const successCount = evalMetrics.filter(m => m.success).length;
      return {
        timestamp: evalMetrics[0].timestamp,
        totalCost: parseFloat(evalMetrics.reduce((sum, m) => sum + parseFloat(m.estimatedCostUsd), 0).toFixed(6)),
        totalTokens: evalMetrics.reduce((sum, m) => sum + m.tokenUsage, 0),
        executionTime: Math.max(...evalMetrics.map(m => m.executionTimeMs)),
        successRate: parseFloat(((successCount / evalMetrics.length) * 100).toFixed(2))
      };
    }).slice(0, limit);
  }
  
  /**
   * Clear old metrics (keep last N days)
   */
  async clearOldMetrics(daysToKeep: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await db
      .delete(agentMetrics)
      .where(sql`${agentMetrics.timestamp} < ${cutoffDate}`)
      .returning({ id: agentMetrics.id });
    
    return result.length;
  }
  
  /**
   * Get summary statistics
   */
  async getSummaryStats(): Promise<{
    totalEvaluations: number;
    totalAgentExecutions: number;
    totalTokensUsed: number;
    totalCostUsd: number;
    overallSuccessRate: number;
    avgExecutionTimeMs: number;
  }> {
    const cutoffDate = this.getCutoffDate();
    
    const metrics = await db
      .select()
      .from(agentMetrics)
      .where(gte(agentMetrics.timestamp, cutoffDate));
    
    const uniqueEvaluations = new Set(metrics.map(m => m.evaluationId));
    const successCount = metrics.filter(m => m.success).length;
    
    return {
      totalEvaluations: uniqueEvaluations.size,
      totalAgentExecutions: metrics.length,
      totalTokensUsed: metrics.reduce((sum, m) => sum + m.tokenUsage, 0),
      totalCostUsd: parseFloat(metrics.reduce((sum, m) => sum + parseFloat(m.estimatedCostUsd), 0).toFixed(6)),
      overallSuccessRate: metrics.length > 0 
        ? parseFloat(((successCount / metrics.length) * 100).toFixed(2))
        : 0,
      avgExecutionTimeMs: metrics.length > 0
        ? Math.round(metrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / metrics.length)
        : 0
    };
  }
  
  /**
   * Get metrics grouped by project
   */
  async getProjectMetrics(): Promise<Array<{
    projectId: string;
    projectName: string;
    totalEvaluations: number;
    totalAgentExecutions: number;
    totalTokensUsed: number;
    totalCostUsd: number;
    successRate: number;
    avgExecutionTimeMs: number;
  }>> {
    const cutoffDate = this.getCutoffDate();
    
    // Get metrics with project information
    const metrics = await db
      .select({
        projectId: agentMetrics.projectId,
        evaluationId: agentMetrics.evaluationId,
        tokenUsage: agentMetrics.tokenUsage,
        estimatedCostUsd: agentMetrics.estimatedCostUsd,
        executionTimeMs: agentMetrics.executionTimeMs,
        success: agentMetrics.success,
      })
      .from(agentMetrics)
      .where(gte(agentMetrics.timestamp, cutoffDate));
    
    // Import projects table for project names
    const { projects } = await import("@shared/schema");
    
    // Group by project
    const projectGroups = new Map<string, typeof metrics>();
    metrics.forEach(m => {
      if (!projectGroups.has(m.projectId)) {
        projectGroups.set(m.projectId, []);
      }
      projectGroups.get(m.projectId)!.push(m);
    });
    
    // Get project details
    const projectIds = Array.from(projectGroups.keys());
    const projectDetails = await db
      .select({
        id: projects.id,
        name: projects.name,
      })
      .from(projects)
      .where(sql`${projects.id} = ANY(${projectIds})`);
    
    const projectNameMap = new Map(projectDetails.map(p => [p.id, p.name]));
    
    // Calculate stats per project
    return Array.from(projectGroups.entries()).map(([projectId, metrics]) => {
      const uniqueEvaluations = new Set(metrics.map(m => m.evaluationId));
      const successCount = metrics.filter(m => m.success).length;
      
      return {
        projectId,
        projectName: projectNameMap.get(projectId) || 'Unknown Project',
        totalEvaluations: uniqueEvaluations.size,
        totalAgentExecutions: metrics.length,
        totalTokensUsed: metrics.reduce((sum, m) => sum + m.tokenUsage, 0),
        totalCostUsd: parseFloat(metrics.reduce((sum, m) => sum + parseFloat(m.estimatedCostUsd), 0).toFixed(6)),
        successRate: metrics.length > 0 
          ? parseFloat(((successCount / metrics.length) * 100).toFixed(2))
          : 0,
        avgExecutionTimeMs: metrics.length > 0
          ? Math.round(metrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / metrics.length)
          : 0
      };
    }).sort((a, b) => b.totalAgentExecutions - a.totalAgentExecutions); // Sort by most active projects first
  }
  
  /**
   * Get cutoff date for retention policy (7 days by default)
   */
  private getCutoffDate(): Date {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);
    return cutoffDate;
  }
}

// Singleton instance
export const agentMetricsService = new AgentMetricsService();
