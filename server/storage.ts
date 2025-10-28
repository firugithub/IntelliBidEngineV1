import {
  type Portfolio,
  type InsertPortfolio,
  type Standard,
  type InsertStandard,
  type McpConnector,
  type InsertMcpConnector,
  type Project,
  type InsertProject,
  type Requirement,
  type InsertRequirement,
  type Proposal,
  type InsertProposal,
  type Evaluation,
  type InsertEvaluation,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Portfolios
  createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio>;
  getPortfolio(id: string): Promise<Portfolio | undefined>;
  getAllPortfolios(): Promise<Portfolio[]>;
  getPortfolioByName(name: string): Promise<Portfolio | undefined>;

  // Standards
  createStandard(standard: InsertStandard): Promise<Standard>;
  getStandard(id: string): Promise<Standard | undefined>;
  getAllStandards(): Promise<Standard[]>;
  getActiveStandards(): Promise<Standard[]>;
  updateStandard(id: string, updates: Partial<InsertStandard>): Promise<void>;
  deactivateStandard(id: string): Promise<void>;

  // MCP Connectors
  createMcpConnector(connector: InsertMcpConnector): Promise<McpConnector>;
  getMcpConnector(id: string): Promise<McpConnector | undefined>;
  getAllMcpConnectors(): Promise<McpConnector[]>;
  getActiveMcpConnectors(): Promise<McpConnector[]>;
  updateMcpConnector(id: string, updates: Partial<InsertMcpConnector>): Promise<void>;
  deleteMcpConnector(id: string): Promise<void>;

  // Projects
  createProject(project: InsertProject): Promise<Project>;
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  getProjectsByPortfolio(portfolioId: string): Promise<Project[]>;
  updateProjectStatus(id: string, status: string): Promise<void>;

  // Requirements
  createRequirement(requirement: InsertRequirement): Promise<Requirement>;
  getRequirementsByProject(projectId: string): Promise<Requirement[]>;

  // Proposals
  createProposal(proposal: InsertProposal): Promise<Proposal>;
  getProposalsByProject(projectId: string): Promise<Proposal[]>;
  getProposal(id: string): Promise<Proposal | undefined>;

  // Evaluations
  createEvaluation(evaluation: InsertEvaluation): Promise<Evaluation>;
  getEvaluationsByProject(projectId: string): Promise<Evaluation[]>;
  getEvaluationByProposal(proposalId: string): Promise<Evaluation | undefined>;
}

export class MemStorage implements IStorage {
  private portfolios: Map<string, Portfolio>;
  private standards: Map<string, Standard>;
  private mcpConnectors: Map<string, McpConnector>;
  private projects: Map<string, Project>;
  private requirements: Map<string, Requirement>;
  private proposals: Map<string, Proposal>;
  private evaluations: Map<string, Evaluation>;

  constructor() {
    this.portfolios = new Map();
    this.standards = new Map();
    this.mcpConnectors = new Map();
    this.projects = new Map();
    this.requirements = new Map();
    this.proposals = new Map();
    this.evaluations = new Map();
  }

  async createPortfolio(insertPortfolio: InsertPortfolio): Promise<Portfolio> {
    const id = randomUUID();
    const portfolio: Portfolio = {
      id,
      name: insertPortfolio.name,
      description: insertPortfolio.description || null,
      createdAt: new Date(),
    };
    this.portfolios.set(id, portfolio);
    return portfolio;
  }

  async getPortfolio(id: string): Promise<Portfolio | undefined> {
    return this.portfolios.get(id);
  }

  async getAllPortfolios(): Promise<Portfolio[]> {
    return Array.from(this.portfolios.values());
  }

  async getPortfolioByName(name: string): Promise<Portfolio | undefined> {
    return Array.from(this.portfolios.values()).find(p => p.name === name);
  }

  async createStandard(insertStandard: InsertStandard): Promise<Standard> {
    const id = randomUUID();
    const standard: Standard = {
      id,
      name: insertStandard.name,
      description: insertStandard.description || null,
      sections: insertStandard.sections,
      isActive: insertStandard.isActive || "true",
      createdAt: new Date(),
    };
    this.standards.set(id, standard);
    return standard;
  }

  async getStandard(id: string): Promise<Standard | undefined> {
    return this.standards.get(id);
  }

  async getAllStandards(): Promise<Standard[]> {
    return Array.from(this.standards.values());
  }

  async getActiveStandards(): Promise<Standard[]> {
    return Array.from(this.standards.values()).filter(s => s.isActive === "true");
  }

  async updateStandard(id: string, updates: Partial<InsertStandard>): Promise<void> {
    const standard = this.standards.get(id);
    if (standard) {
      const updated = { ...standard, ...updates };
      this.standards.set(id, updated);
    }
  }

  async deactivateStandard(id: string): Promise<void> {
    const standard = this.standards.get(id);
    if (standard) {
      standard.isActive = "false";
      this.standards.set(id, standard);
    }
  }

  async createMcpConnector(insertConnector: InsertMcpConnector): Promise<McpConnector> {
    const id = randomUUID();
    const connector: McpConnector = {
      id,
      name: insertConnector.name,
      description: insertConnector.description || null,
      serverUrl: insertConnector.serverUrl,
      apiKey: insertConnector.apiKey || null,
      config: insertConnector.config || null,
      isActive: insertConnector.isActive || "true",
      createdAt: new Date(),
    };
    this.mcpConnectors.set(id, connector);
    return connector;
  }

  async getMcpConnector(id: string): Promise<McpConnector | undefined> {
    return this.mcpConnectors.get(id);
  }

  async getAllMcpConnectors(): Promise<McpConnector[]> {
    return Array.from(this.mcpConnectors.values());
  }

  async getActiveMcpConnectors(): Promise<McpConnector[]> {
    return Array.from(this.mcpConnectors.values()).filter(c => c.isActive === "true");
  }

  async updateMcpConnector(id: string, updates: Partial<InsertMcpConnector>): Promise<void> {
    const connector = this.mcpConnectors.get(id);
    if (connector) {
      const updated = { ...connector, ...updates };
      this.mcpConnectors.set(id, updated);
    }
  }

  async deleteMcpConnector(id: string): Promise<void> {
    this.mcpConnectors.delete(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = {
      id,
      portfolioId: insertProject.portfolioId,
      name: insertProject.name,
      initiativeName: insertProject.initiativeName || null,
      vendorList: insertProject.vendorList || null,
      status: insertProject.status || "analyzing",
      createdAt: new Date(),
    };
    this.projects.set(id, project);
    return project;
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async getProjectsByPortfolio(portfolioId: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(
      (project) => project.portfolioId === portfolioId
    );
  }

  async updateProjectStatus(id: string, status: string): Promise<void> {
    const project = this.projects.get(id);
    if (project) {
      project.status = status;
      this.projects.set(id, project);
    }
  }

  async createRequirement(insertRequirement: InsertRequirement): Promise<Requirement> {
    const id = randomUUID();
    const requirement: Requirement = {
      id,
      projectId: insertRequirement.projectId,
      documentType: insertRequirement.documentType || "RFT",
      fileName: insertRequirement.fileName,
      extractedData: insertRequirement.extractedData || null,
      evaluationCriteria: insertRequirement.evaluationCriteria || null,
      standardId: insertRequirement.standardId || null,
      taggedSections: insertRequirement.taggedSections || null,
      createdAt: new Date(),
    };
    this.requirements.set(id, requirement);
    return requirement;
  }

  async getRequirementsByProject(projectId: string): Promise<Requirement[]> {
    return Array.from(this.requirements.values()).filter(
      (req) => req.projectId === projectId
    );
  }

  async createProposal(insertProposal: InsertProposal): Promise<Proposal> {
    const id = randomUUID();
    const proposal: Proposal = {
      id,
      projectId: insertProposal.projectId,
      vendorName: insertProposal.vendorName,
      documentType: insertProposal.documentType,
      fileName: insertProposal.fileName,
      extractedData: insertProposal.extractedData || null,
      standardId: insertProposal.standardId || null,
      taggedSections: insertProposal.taggedSections || null,
      createdAt: new Date(),
    };
    this.proposals.set(id, proposal);
    return proposal;
  }

  async getProposalsByProject(projectId: string): Promise<Proposal[]> {
    return Array.from(this.proposals.values()).filter(
      (prop) => prop.projectId === projectId
    );
  }

  async getProposal(id: string): Promise<Proposal | undefined> {
    return this.proposals.get(id);
  }

  async createEvaluation(insertEvaluation: InsertEvaluation): Promise<Evaluation> {
    const id = randomUUID();
    const evaluation: Evaluation = {
      id,
      projectId: insertEvaluation.projectId,
      proposalId: insertEvaluation.proposalId,
      overallScore: insertEvaluation.overallScore,
      technicalFit: insertEvaluation.technicalFit,
      deliveryRisk: insertEvaluation.deliveryRisk,
      cost: insertEvaluation.cost,
      compliance: insertEvaluation.compliance,
      status: insertEvaluation.status,
      aiRationale: insertEvaluation.aiRationale || null,
      roleInsights: insertEvaluation.roleInsights || null,
      detailedScores: insertEvaluation.detailedScores || null,
      sectionCompliance: insertEvaluation.sectionCompliance || null,
      createdAt: new Date(),
    };
    this.evaluations.set(id, evaluation);
    return evaluation;
  }

  async getEvaluationsByProject(projectId: string): Promise<Evaluation[]> {
    return Array.from(this.evaluations.values()).filter(
      (evaluation) => evaluation.projectId === projectId
    );
  }

  async getEvaluationByProposal(proposalId: string): Promise<Evaluation | undefined> {
    return Array.from(this.evaluations.values()).find(
      (evaluation) => evaluation.proposalId === proposalId
    );
  }
}

export const storage = new MemStorage();
