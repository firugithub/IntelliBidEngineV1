import { storage } from "../storage";

// Agent execution metrics
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
  private metrics: AgentExecutionMetric[] = [];
  
  /**
   * Track a single agent execution
   */
  trackExecution(metric: AgentExecutionMetric): void {
    this.metrics.push(metric);
    
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
      timestamp: metric.timestamp.toISOString()
    }));
  }
  
  /**
   * Estimate cost based on token usage
   * Assumes 70% input tokens, 30% output tokens (typical for evaluation tasks)
   */
  estimateCost(totalTokens: number): number {
    const inputTokens = Math.floor(totalTokens * 0.7);
    const outputTokens = Math.floor(totalTokens * 0.3);
    
    const inputCost = (inputTokens / 1_000_000) * TOKEN_COSTS.inputPerMillion;
    const outputCost = (outputTokens / 1_000_000) * TOKEN_COSTS.outputPerMillion;
    
    return parseFloat((inputCost + outputCost).toFixed(6));
  }
  
  /**
   * Get performance statistics for a specific agent role
   */
  getAgentStats(agentRole: string): AgentPerformanceStats | null {
    const agentMetrics = this.metrics.filter(m => m.agentRole === agentRole);
    
    if (agentMetrics.length === 0) {
      return null;
    }
    
    const successCount = agentMetrics.filter(m => m.success).length;
    const failureCount = agentMetrics.length - successCount;
    const totalTokens = agentMetrics.reduce((sum, m) => sum + m.tokenUsage, 0);
    const totalCost = agentMetrics.reduce((sum, m) => sum + m.estimatedCostUsd, 0);
    const totalTime = agentMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0);
    
    return {
      agentRole,
      totalExecutions: agentMetrics.length,
      successCount,
      failureCount,
      successRate: parseFloat(((successCount / agentMetrics.length) * 100).toFixed(2)),
      avgExecutionTimeMs: Math.round(totalTime / agentMetrics.length),
      totalTokensUsed: totalTokens,
      totalCostUsd: parseFloat(totalCost.toFixed(6)),
      avgTokensPerExecution: Math.round(totalTokens / agentMetrics.length),
      avgCostPerExecution: parseFloat((totalCost / agentMetrics.length).toFixed(6)),
      lastExecuted: agentMetrics[agentMetrics.length - 1]?.timestamp
    };
  }
  
  /**
   * Get stats for all agents
   */
  getAllAgentStats(): AgentPerformanceStats[] {
    const roles = Array.from(new Set(this.metrics.map(m => m.agentRole)));
    return roles.map(role => this.getAgentStats(role)).filter(Boolean) as AgentPerformanceStats[];
  }
  
  /**
   * Get evaluation-level metrics
   */
  getEvaluationMetrics(evaluationId: string): {
    totalExecutionTimeMs: number;
    totalTokensUsed: number;
    totalCostUsd: number;
    agentsSucceeded: number;
    agentsFailed: number;
    agentBreakdown: Record<string, { success: boolean; timeMs: number; tokens: number; costUsd: number }>;
  } {
    const evalMetrics = this.metrics.filter(m => m.evaluationId === evaluationId);
    
    const agentBreakdown: Record<string, any> = {};
    evalMetrics.forEach(m => {
      agentBreakdown[m.agentRole] = {
        success: m.success,
        timeMs: m.executionTimeMs,
        tokens: m.tokenUsage,
        costUsd: m.estimatedCostUsd
      };
    });
    
    return {
      totalExecutionTimeMs: evalMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0),
      totalTokensUsed: evalMetrics.reduce((sum, m) => sum + m.tokenUsage, 0),
      totalCostUsd: parseFloat(evalMetrics.reduce((sum, m) => sum + m.estimatedCostUsd, 0).toFixed(6)),
      agentsSucceeded: evalMetrics.filter(m => m.success).length,
      agentsFailed: evalMetrics.filter(m => !m.success).length,
      agentBreakdown
    };
  }
  
  /**
   * Get recent failures for debugging
   */
  getRecentFailures(limit: number = 10): AgentExecutionMetric[] {
    return this.metrics
      .filter(m => !m.success)
      .slice(-limit)
      .reverse();
  }
  
  /**
   * Get time-series data for charting (last N evaluations)
   */
  getTimeSeriesData(limit: number = 50): {
    timestamp: Date;
    totalCost: number;
    totalTokens: number;
    executionTime: number;
    successRate: number;
  }[] {
    // Group by evaluation
    const evaluationGroups = new Map<string, AgentExecutionMetric[]>();
    
    this.metrics.slice(-limit * 6).forEach(m => {
      if (!evaluationGroups.has(m.evaluationId)) {
        evaluationGroups.set(m.evaluationId, []);
      }
      evaluationGroups.get(m.evaluationId)!.push(m);
    });
    
    return Array.from(evaluationGroups.values()).map(metrics => {
      const successCount = metrics.filter(m => m.success).length;
      return {
        timestamp: metrics[0].timestamp,
        totalCost: parseFloat(metrics.reduce((sum, m) => sum + m.estimatedCostUsd, 0).toFixed(6)),
        totalTokens: metrics.reduce((sum, m) => sum + m.tokenUsage, 0),
        executionTime: Math.max(...metrics.map(m => m.executionTimeMs)),
        successRate: parseFloat(((successCount / metrics.length) * 100).toFixed(2))
      };
    }).slice(-limit);
  }
  
  /**
   * Clear old metrics (keep last N days)
   */
  clearOldMetrics(daysToKeep: number = 7): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const before = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoffDate);
    return before - this.metrics.length;
  }
  
  /**
   * Get summary statistics
   */
  getSummaryStats(): {
    totalEvaluations: number;
    totalAgentExecutions: number;
    totalTokensUsed: number;
    totalCostUsd: number;
    overallSuccessRate: number;
    avgExecutionTimeMs: number;
  } {
    const uniqueEvaluations = new Set(this.metrics.map(m => m.evaluationId));
    const successCount = this.metrics.filter(m => m.success).length;
    
    return {
      totalEvaluations: uniqueEvaluations.size,
      totalAgentExecutions: this.metrics.length,
      totalTokensUsed: this.metrics.reduce((sum, m) => sum + m.tokenUsage, 0),
      totalCostUsd: parseFloat(this.metrics.reduce((sum, m) => sum + m.estimatedCostUsd, 0).toFixed(6)),
      overallSuccessRate: this.metrics.length > 0 
        ? parseFloat(((successCount / this.metrics.length) * 100).toFixed(2))
        : 0,
      avgExecutionTimeMs: this.metrics.length > 0
        ? Math.round(this.metrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / this.metrics.length)
        : 0
    };
  }
}

// Singleton instance
export const agentMetricsService = new AgentMetricsService();
