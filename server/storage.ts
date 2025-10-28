import {
  type Portfolio,
  type InsertPortfolio,
  type Standard,
  type InsertStandard,
  type McpConnector,
  type InsertMcpConnector,
  type SystemConfig,
  type InsertSystemConfig,
  type Project,
  type InsertProject,
  type Requirement,
  type InsertRequirement,
  type Proposal,
  type InsertProposal,
  type Evaluation,
  type InsertEvaluation,
  type EvaluationCriteria,
  type InsertEvaluationCriteria,
  type RagDocument,
  type InsertRagDocument,
  type RagChunk,
  type InsertRagChunk,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Portfolios
  createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio>;
  getPortfolio(id: string): Promise<Portfolio | undefined>;
  getAllPortfolios(): Promise<Portfolio[]>;
  getPortfolioByName(name: string): Promise<Portfolio | undefined>;
  deletePortfolio(id: string): Promise<void>;

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

  // System Configuration
  upsertSystemConfig(config: InsertSystemConfig): Promise<SystemConfig>;
  getSystemConfigByKey(key: string): Promise<SystemConfig | undefined>;
  getAllSystemConfig(): Promise<SystemConfig[]>;
  getSystemConfigByCategory(category: string): Promise<SystemConfig[]>;
  deleteSystemConfig(key: string): Promise<void>;

  // Projects
  createProject(project: InsertProject): Promise<Project>;
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  getProjectsByPortfolio(portfolioId: string): Promise<Project[]>;
  updateProjectStatus(id: string, status: string): Promise<void>;
  deleteProject(id: string): Promise<void>;

  // Requirements
  createRequirement(requirement: InsertRequirement): Promise<Requirement>;
  getRequirementsByProject(projectId: string): Promise<Requirement[]>;
  deleteRequirement(id: string): Promise<void>;

  // Proposals
  createProposal(proposal: InsertProposal): Promise<Proposal>;
  getProposalsByProject(projectId: string): Promise<Proposal[]>;
  getProposal(id: string): Promise<Proposal | undefined>;
  deleteProposal(id: string): Promise<void>;

  // Evaluations
  createEvaluation(evaluation: InsertEvaluation): Promise<Evaluation>;
  getEvaluationsByProject(projectId: string): Promise<Evaluation[]>;
  getEvaluationByProposal(proposalId: string): Promise<Evaluation | undefined>;
  deleteEvaluation(id: string): Promise<void>;

  // Evaluation Criteria
  createEvaluationCriteria(criteria: InsertEvaluationCriteria): Promise<EvaluationCriteria>;
  getEvaluationCriteriaByEvaluation(evaluationId: string, role?: string): Promise<EvaluationCriteria[]>;
  updateEvaluationCriteria(id: string, updates: Partial<InsertEvaluationCriteria>): Promise<void>;
  deleteEvaluationCriteria(id: string): Promise<void>;

  // RAG Documents
  createRagDocument(document: InsertRagDocument): Promise<RagDocument>;
  getRagDocument(id: string): Promise<RagDocument | undefined>;
  getAllRagDocuments(): Promise<RagDocument[]>;
  getRagDocumentsBySourceType(sourceType: string): Promise<RagDocument[]>;
  updateRagDocument(id: string, updates: Partial<InsertRagDocument>): Promise<void>;
  updateRagDocumentStatus(id: string, status: string): Promise<void>;
  deleteRagDocument(id: string): Promise<void>;

  // RAG Chunks
  createRagChunk(chunk: InsertRagChunk): Promise<RagChunk>;
  createRagChunks(chunks: InsertRagChunk[]): Promise<RagChunk[]>;
  getRagChunk(id: string): Promise<RagChunk | undefined>;
  getRagChunksByDocumentId(documentId: string): Promise<RagChunk[]>;
  deleteRagChunk(id: string): Promise<void>;
  deleteRagChunksByDocumentId(documentId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private portfolios: Map<string, Portfolio>;
  private standards: Map<string, Standard>;
  private mcpConnectors: Map<string, McpConnector>;
  private systemConfig: Map<string, SystemConfig>;
  private projects: Map<string, Project>;
  private requirements: Map<string, Requirement>;
  private proposals: Map<string, Proposal>;
  private evaluations: Map<string, Evaluation>;
  private evaluationCriteria: Map<string, EvaluationCriteria>;
  private ragDocuments: Map<string, RagDocument>;
  private ragChunks: Map<string, RagChunk>;

  constructor() {
    this.portfolios = new Map();
    this.standards = new Map();
    this.mcpConnectors = new Map();
    this.systemConfig = new Map();
    this.projects = new Map();
    this.requirements = new Map();
    this.proposals = new Map();
    this.evaluations = new Map();
    this.evaluationCriteria = new Map();
    this.ragDocuments = new Map();
    this.ragChunks = new Map();
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

  async deletePortfolio(id: string): Promise<void> {
    this.portfolios.delete(id);
  }

  async createStandard(insertStandard: InsertStandard): Promise<Standard> {
    const id = randomUUID();
    const standard: Standard = {
      id,
      name: insertStandard.name,
      description: insertStandard.description || null,
      sections: insertStandard.sections,
      tags: insertStandard.tags || null,
      fileName: insertStandard.fileName || null,
      documentContent: insertStandard.documentContent || null,
      ragDocumentId: insertStandard.ragDocumentId || null,
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

  async upsertSystemConfig(insertConfig: InsertSystemConfig): Promise<SystemConfig> {
    const existing = this.systemConfig.get(insertConfig.key);
    const config: SystemConfig = {
      id: existing?.id || randomUUID(),
      category: insertConfig.category,
      key: insertConfig.key,
      value: insertConfig.value || null,
      isEncrypted: insertConfig.isEncrypted || "false",
      description: insertConfig.description || null,
      updatedAt: new Date(),
      createdAt: existing?.createdAt || new Date(),
    };
    this.systemConfig.set(insertConfig.key, config);
    return config;
  }

  async getSystemConfigByKey(key: string): Promise<SystemConfig | undefined> {
    return this.systemConfig.get(key);
  }

  async getAllSystemConfig(): Promise<SystemConfig[]> {
    return Array.from(this.systemConfig.values());
  }

  async getSystemConfigByCategory(category: string): Promise<SystemConfig[]> {
    return Array.from(this.systemConfig.values()).filter(c => c.category === category);
  }

  async deleteSystemConfig(key: string): Promise<void> {
    this.systemConfig.delete(key);
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

  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
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

  async deleteRequirement(id: string): Promise<void> {
    this.requirements.delete(id);
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

  async deleteProposal(id: string): Promise<void> {
    this.proposals.delete(id);
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
      agentDiagnostics: insertEvaluation.agentDiagnostics || null,
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

  async deleteEvaluation(id: string): Promise<void> {
    this.evaluations.delete(id);
  }

  async createEvaluationCriteria(insertCriteria: InsertEvaluationCriteria): Promise<EvaluationCriteria> {
    const id = randomUUID();
    const criteria: EvaluationCriteria = {
      id,
      evaluationId: insertCriteria.evaluationId,
      role: insertCriteria.role,
      section: insertCriteria.section,
      question: insertCriteria.question,
      score: insertCriteria.score,
      scoreLabel: insertCriteria.scoreLabel,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.evaluationCriteria.set(id, criteria);
    return criteria;
  }

  async getEvaluationCriteriaByEvaluation(evaluationId: string, role?: string): Promise<EvaluationCriteria[]> {
    let criteria = Array.from(this.evaluationCriteria.values()).filter(
      (crit) => crit.evaluationId === evaluationId
    );
    if (role) {
      criteria = criteria.filter((crit) => crit.role === role);
    }
    return criteria;
  }

  async updateEvaluationCriteria(id: string, updates: Partial<InsertEvaluationCriteria>): Promise<void> {
    const criteria = this.evaluationCriteria.get(id);
    if (criteria) {
      const updated: EvaluationCriteria = {
        ...criteria,
        ...updates,
        updatedAt: new Date(),
      };
      this.evaluationCriteria.set(id, updated);
    }
  }

  async deleteEvaluationCriteria(id: string): Promise<void> {
    this.evaluationCriteria.delete(id);
  }

  // RAG Documents
  async createRagDocument(insertDocument: InsertRagDocument & { id?: string }): Promise<RagDocument> {
    // Use provided id if available, otherwise generate new UUID
    const id = insertDocument.id || randomUUID();
    const document: RagDocument = {
      id,
      sourceType: insertDocument.sourceType,
      sourceId: insertDocument.sourceId || null,
      fileName: insertDocument.fileName,
      blobUrl: insertDocument.blobUrl || "",
      blobName: insertDocument.blobName || null,
      searchDocId: insertDocument.searchDocId || "",
      indexName: insertDocument.indexName || "intellibid-rag",
      totalChunks: insertDocument.totalChunks || 0,
      status: insertDocument.status || "pending",
      metadata: insertDocument.metadata || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.ragDocuments.set(id, document);
    return document;
  }

  async getRagDocument(id: string): Promise<RagDocument | undefined> {
    return this.ragDocuments.get(id);
  }

  async getAllRagDocuments(): Promise<RagDocument[]> {
    return Array.from(this.ragDocuments.values());
  }

  async getRagDocumentsBySourceType(sourceType: string): Promise<RagDocument[]> {
    return Array.from(this.ragDocuments.values()).filter(
      (doc) => doc.sourceType === sourceType
    );
  }

  async updateRagDocument(id: string, updates: Partial<InsertRagDocument>): Promise<void> {
    const document = this.ragDocuments.get(id);
    if (document) {
      const updated: RagDocument = {
        ...document,
        ...updates,
        id, // Preserve original id
        updatedAt: new Date(),
      };
      this.ragDocuments.set(id, updated);
    }
  }

  async updateRagDocumentStatus(id: string, status: string): Promise<void> {
    await this.updateRagDocument(id, { status });
  }

  async deleteRagDocument(id: string): Promise<void> {
    this.ragDocuments.delete(id);
    // Also delete associated chunks
    await this.deleteRagChunksByDocumentId(id);
  }

  // RAG Chunks
  async createRagChunk(insertChunk: InsertRagChunk): Promise<RagChunk> {
    const id = randomUUID();
    const chunk: RagChunk = {
      id,
      documentId: insertChunk.documentId,
      chunkIndex: insertChunk.chunkIndex,
      content: insertChunk.content,
      tokenCount: insertChunk.tokenCount,
      searchChunkId: insertChunk.searchChunkId || null,
      metadata: insertChunk.metadata || null,
      createdAt: new Date(),
    };
    this.ragChunks.set(id, chunk);
    return chunk;
  }

  async createRagChunks(chunks: InsertRagChunk[]): Promise<RagChunk[]> {
    const createdChunks: RagChunk[] = [];
    for (const chunk of chunks) {
      const created = await this.createRagChunk(chunk);
      createdChunks.push(created);
    }
    return createdChunks;
  }

  async getRagChunk(id: string): Promise<RagChunk | undefined> {
    return this.ragChunks.get(id);
  }

  async getRagChunksByDocumentId(documentId: string): Promise<RagChunk[]> {
    return Array.from(this.ragChunks.values()).filter(
      (chunk) => chunk.documentId === documentId
    );
  }

  async deleteRagChunk(id: string): Promise<void> {
    this.ragChunks.delete(id);
  }

  async deleteRagChunksByDocumentId(documentId: string): Promise<void> {
    const chunks = Array.from(this.ragChunks.values()).filter(
      (chunk) => chunk.documentId === documentId
    );
    for (const chunk of chunks) {
      this.ragChunks.delete(chunk.id);
    }
  }
}

export const storage = new MemStorage();
