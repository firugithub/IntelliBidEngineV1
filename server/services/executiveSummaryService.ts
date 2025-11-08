import type { IStorage } from "../storage";

export interface ExecutiveSummaryStats {
  totalPortfolios: number;
  totalProjects: number;
  totalRfts: number;
  totalEvaluations: number;
  totalVendors: number;
  activeProjects: number;
  completedProjects: number;
}

export interface StageDistribution {
  stageNumber: number;
  stageName: string;
  vendorCount: number;
}

export interface VendorLeader {
  vendorName: string;
  projectCount: number;
  avgScore: number;
  totalStageProgress: number;
}

export interface RecentActivity {
  type: "project_created" | "evaluation_completed" | "stage_updated";
  projectId: string;
  projectName: string;
  portfolioName: string;
  vendorName?: string;
  timestamp: string;
  description: string;
}

const STAGE_NAMES = [
  "RFI Initiated",
  "RFI Response Received",
  "RFI Evaluation Completed",
  "RFT Initiated",
  "RFT Response Received",
  "Vendor Demo Completed",
  "RFT Evaluation Completed",
  "POC Initiated",
  "SOW Submitted",
  "SOW Reviewed",
];

export class ExecutiveSummaryService {
  constructor(private storage: IStorage) {}

  async getGlobalStats(): Promise<ExecutiveSummaryStats> {
    const portfolios = await this.storage.getAllPortfolios();
    const projects = await this.storage.getAllProjects();
    const evaluations = await this.storage.getAllEvaluations();
    const vendorStages = await this.storage.getAllVendorStages();

    // Count unique vendors across all evaluations
    const uniqueVendors = new Set(evaluations.map((e: any) => e.vendorName));

    // Count active and completed projects
    const activeProjects = projects.filter(p => 
      p.status !== "completed" && p.status !== "archived"
    ).length;
    const completedProjects = projects.filter(p => 
      p.status === "completed"
    ).length;

    return {
      totalPortfolios: portfolios.length,
      totalProjects: projects.length,
      totalRfts: projects.filter(p => p.status !== "draft").length,
      totalEvaluations: evaluations.length,
      totalVendors: uniqueVendors.size,
      activeProjects,
      completedProjects,
    };
  }

  async getStageDistribution(): Promise<StageDistribution[]> {
    const vendorStages = await this.storage.getAllVendorStages();

    // Count vendors at each stage
    const stageCounts = new Map<number, number>();
    
    for (let i = 1; i <= 10; i++) {
      stageCounts.set(i, 0);
    }

    vendorStages.forEach(stage => {
      if (stage.currentStage >= 1 && stage.currentStage <= 10) {
        stageCounts.set(
          stage.currentStage, 
          (stageCounts.get(stage.currentStage) || 0) + 1
        );
      }
    });

    return Array.from(stageCounts.entries()).map(([stageNumber, vendorCount]) => ({
      stageNumber,
      stageName: STAGE_NAMES[stageNumber - 1] || `Stage ${stageNumber}`,
      vendorCount,
    }));
  }

  async getVendorLeaders(limit: number = 5): Promise<VendorLeader[]> {
    const evaluations = await this.storage.getAllEvaluations();
    const vendorStages = await this.storage.getAllVendorStages();

    // Group evaluations by vendor
    const vendorMap = new Map<string, {
      projectIds: Set<string>;
      scores: number[];
      maxStage: number;
    }>();

    evaluations.forEach((evaluation: any) => {
      if (!vendorMap.has(evaluation.vendorName)) {
        vendorMap.set(evaluation.vendorName, {
          projectIds: new Set(),
          scores: [],
          maxStage: 0,
        });
      }
      
      const vendor = vendorMap.get(evaluation.vendorName)!;
      vendor.projectIds.add(evaluation.projectId);
      vendor.scores.push(evaluation.overallScore);
    });

    // Add stage progress data
    vendorStages.forEach(stage => {
      if (vendorMap.has(stage.vendorName)) {
        const vendor = vendorMap.get(stage.vendorName)!;
        vendor.maxStage = Math.max(vendor.maxStage, stage.currentStage);
      }
    });

    // Convert to vendor leaders array
    const leaders: VendorLeader[] = Array.from(vendorMap.entries()).map(
      ([vendorName, data]) => ({
        vendorName,
        projectCount: data.projectIds.size,
        avgScore: data.scores.length > 0 
          ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
          : 0,
        totalStageProgress: data.maxStage,
      })
    );

    // Sort by project count desc, then by avg score desc
    return leaders
      .sort((a, b) => {
        if (b.projectCount !== a.projectCount) {
          return b.projectCount - a.projectCount;
        }
        return b.avgScore - a.avgScore;
      })
      .slice(0, limit);
  }

  async getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
    const projects = await this.storage.getAllProjects();
    const portfolios = await this.storage.getAllPortfolios();
    const evaluations = await this.storage.getAllEvaluations();
    const vendorStages = await this.storage.getAllVendorStages();

    const activities: RecentActivity[] = [];

    // Create portfolio lookup
    const portfolioMap = new Map(portfolios.map(p => [p.id, p.name]));

    // Add project creation events (using createdAt if available, otherwise use current time as fallback)
    projects.forEach(project => {
      activities.push({
        type: "project_created",
        projectId: project.id,
        projectName: project.name,
        portfolioName: portfolioMap.get(project.portfolioId) || "Unknown Portfolio",
        timestamp: new Date().toISOString(), // Fallback - in production would use project.createdAt
        description: `New project "${project.name}" created`,
      });
    });

    // Add evaluation completion events
    const completedEvaluations = evaluations.filter((e: any) => 
      e.status === "recommended" || e.status === "risk-flagged"
    );
    
    completedEvaluations.forEach((evaluation: any) => {
      const project = projects.find(p => p.id === evaluation.projectId);
      if (project) {
        activities.push({
          type: "evaluation_completed",
          projectId: project.id,
          projectName: project.name,
          portfolioName: portfolioMap.get(project.portfolioId) || "Unknown Portfolio",
          vendorName: evaluation.vendorName,
          timestamp: new Date().toISOString(), // Fallback - in production would use evaluation.updatedAt
          description: `Evaluation completed for ${evaluation.vendorName}`,
        });
      }
    });

    // Add recent stage updates
    vendorStages.forEach(stage => {
      const project = projects.find(p => p.id === stage.projectId);
      if (project) {
        activities.push({
          type: "stage_updated",
          projectId: project.id,
          projectName: project.name,
          portfolioName: portfolioMap.get(project.portfolioId) || "Unknown Portfolio",
          vendorName: stage.vendorName,
          timestamp: (stage.updatedAt instanceof Date ? stage.updatedAt.toISOString() : stage.updatedAt) || new Date().toISOString(),
          description: `${stage.vendorName} reached ${STAGE_NAMES[stage.currentStage - 1] || `Stage ${stage.currentStage}`}`,
        });
      }
    });

    // Sort by timestamp descending and limit
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}

export const createExecutiveSummaryService = (storage: IStorage) => {
  return new ExecutiveSummaryService(storage);
};
