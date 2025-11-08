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
  type ChatSession,
  type InsertChatSession,
  type ChatMessage,
  type InsertChatMessage,
  type ComplianceGap,
  type InsertComplianceGap,
  type ComparisonSnapshot,
  type InsertComparisonSnapshot,
  type ExecutiveBriefing,
  type InsertExecutiveBriefing,
  type FollowupQuestion,
  type InsertFollowupQuestion,
  type BusinessCase,
  type InsertBusinessCase,
  type RftTemplate,
  type InsertRftTemplate,
  type GeneratedRft,
  type InsertGeneratedRft,
  type VendorShortlistingStage,
  type InsertVendorShortlistingStage,
  systemConfig,
  mcpConnectors,
  portfolios,
  projects,
  businessCases,
  generatedRfts,
  requirements,
  proposals,
  evaluations,
  vendorShortlistingStages,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { encryptApiKey, decryptApiKey } from "./utils/encryption";

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
  getEvaluation(id: string): Promise<Evaluation | undefined>;
  updateEvaluation(id: string, updates: Partial<InsertEvaluation>): Promise<void>;
  deleteEvaluation(id: string): Promise<void>;

  // Evaluation Criteria
  createEvaluationCriteria(criteria: InsertEvaluationCriteria): Promise<EvaluationCriteria>;
  getEvaluationCriteriaByEvaluation(evaluationId: string, role?: string): Promise<EvaluationCriteria[]>;
  getEvaluationCriterion(id: string): Promise<EvaluationCriteria | undefined>;
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

  // Chat Sessions
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(id: string): Promise<ChatSession | undefined>;
  getChatSessionsByProject(projectId: string): Promise<ChatSession[]>;
  updateChatSession(id: string, updates: Partial<InsertChatSession>): Promise<void>;
  deleteChatSession(id: string): Promise<void>;

  // Chat Messages
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessagesBySession(sessionId: string): Promise<ChatMessage[]>;
  deleteChatMessage(id: string): Promise<void>;

  // Compliance Gaps
  createComplianceGap(gap: InsertComplianceGap): Promise<ComplianceGap>;
  getComplianceGap(id: string): Promise<ComplianceGap | undefined>;
  getComplianceGapsByProject(projectId: string): Promise<ComplianceGap[]>;
  getComplianceGapsByProposal(proposalId: string): Promise<ComplianceGap[]>;
  updateComplianceGap(id: string, updates: Partial<InsertComplianceGap>): Promise<void>;
  deleteComplianceGap(id: string): Promise<void>;

  // Comparison Snapshots
  createComparisonSnapshot(snapshot: InsertComparisonSnapshot): Promise<ComparisonSnapshot>;
  getComparisonSnapshot(id: string): Promise<ComparisonSnapshot | undefined>;
  getComparisonSnapshotsByProject(projectId: string): Promise<ComparisonSnapshot[]>;
  deleteComparisonSnapshot(id: string): Promise<void>;

  // Executive Briefings
  createExecutiveBriefing(briefing: InsertExecutiveBriefing): Promise<ExecutiveBriefing>;
  getExecutiveBriefing(id: string): Promise<ExecutiveBriefing | undefined>;
  getExecutiveBriefingsByProject(projectId: string): Promise<ExecutiveBriefing[]>;
  getExecutiveBriefingsByRole(projectId: string, stakeholderRole: string): Promise<ExecutiveBriefing[]>;
  deleteExecutiveBriefing(id: string): Promise<void>;

  // Followup Questions
  createFollowupQuestion(question: InsertFollowupQuestion): Promise<FollowupQuestion>;
  getFollowupQuestion(id: string): Promise<FollowupQuestion | undefined>;
  getFollowupQuestionsByProject(projectId: string): Promise<FollowupQuestion[]>;
  getFollowupQuestionsByProposal(proposalId: string): Promise<FollowupQuestion[]>;
  updateFollowupQuestion(id: string, updates: Partial<InsertFollowupQuestion>): Promise<void>;
  deleteFollowupQuestion(id: string): Promise<void>;

  // Business Cases
  createBusinessCase(businessCase: InsertBusinessCase): Promise<BusinessCase>;
  getBusinessCase(id: string): Promise<BusinessCase | undefined>;
  getAllBusinessCases(): Promise<BusinessCase[]>;
  getBusinessCasesByPortfolio(portfolioId: string): Promise<BusinessCase[]>;
  updateBusinessCase(id: string, updates: Partial<InsertBusinessCase>): Promise<void>;
  deleteBusinessCase(id: string): Promise<void>;

  // RFT Templates
  createRftTemplate(template: InsertRftTemplate): Promise<RftTemplate>;
  getRftTemplate(id: string): Promise<RftTemplate | undefined>;
  getAllRftTemplates(): Promise<RftTemplate[]>;
  getActiveRftTemplates(): Promise<RftTemplate[]>;
  getRftTemplatesByCategory(category: string): Promise<RftTemplate[]>;
  updateRftTemplate(id: string, updates: Partial<InsertRftTemplate>): Promise<void>;
  deleteRftTemplate(id: string): Promise<void>;

  // Generated RFTs
  createGeneratedRft(rft: InsertGeneratedRft): Promise<GeneratedRft>;
  getGeneratedRft(id: string): Promise<GeneratedRft | undefined>;
  getAllGeneratedRfts(): Promise<GeneratedRft[]>;
  getGeneratedRftsByProject(projectId: string): Promise<GeneratedRft[]>;
  getGeneratedRftsByBusinessCase(businessCaseId: string): Promise<GeneratedRft[]>;
  updateGeneratedRft(id: string, updates: Partial<InsertGeneratedRft>): Promise<void>;
  deleteGeneratedRft(id: string): Promise<void>;

  // Vendor Shortlisting Stages
  createVendorStage(stage: InsertVendorShortlistingStage): Promise<VendorShortlistingStage>;
  getVendorStagesByProject(projectId: string): Promise<VendorShortlistingStage[]>;
  getVendorStageByProjectAndVendor(projectId: string, vendorName: string): Promise<VendorShortlistingStage | undefined>;
  updateVendorStage(id: string, updates: Partial<InsertVendorShortlistingStage>): Promise<void>;
  deleteVendorStage(id: string): Promise<void>;
  getAllVendorStages(): Promise<VendorShortlistingStage[]>;
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
  private chatSessions: Map<string, ChatSession>;
  private chatMessages: Map<string, ChatMessage>;
  private complianceGaps: Map<string, ComplianceGap>;
  private comparisonSnapshots: Map<string, ComparisonSnapshot>;
  private executiveBriefings: Map<string, ExecutiveBriefing>;
  private followupQuestions: Map<string, FollowupQuestion>;
  private businessCases: Map<string, BusinessCase>;
  private rftTemplates: Map<string, RftTemplate>;
  private generatedRfts: Map<string, GeneratedRft>;

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
    this.chatSessions = new Map();
    this.chatMessages = new Map();
    this.complianceGaps = new Map();
    this.comparisonSnapshots = new Map();
    this.executiveBriefings = new Map();
    this.followupQuestions = new Map();
    this.businessCases = new Map();
    this.rftTemplates = new Map();
    this.generatedRfts = new Map();
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
      category: insertStandard.category || "general",
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
      connectorType: insertConnector.connectorType || "rest",
      authType: insertConnector.authType || "bearer",
      roleMapping: insertConnector.roleMapping || null,
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
      functionalFit: insertEvaluation.functionalFit ?? 0,
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

  async getEvaluation(id: string): Promise<Evaluation | undefined> {
    return this.evaluations.get(id);
  }

  async updateEvaluation(id: string, updates: Partial<InsertEvaluation>): Promise<void> {
    const evaluation = this.evaluations.get(id);
    if (evaluation) {
      console.log(`[Storage] Updating evaluation ${id} with:`, updates);
      const updated: Evaluation = {
        ...evaluation,
        ...updates,
      };
      console.log(`[Storage] Updated evaluation status: ${updated.status}, score: ${updated.overallScore}`);
      this.evaluations.set(id, updated);
    }
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

  async getEvaluationCriterion(id: string): Promise<EvaluationCriteria | undefined> {
    return this.evaluationCriteria.get(id);
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

  // Chat Sessions
  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const id = randomUUID();
    const session: ChatSession = {
      id,
      projectId: insertSession.projectId,
      title: insertSession.title || null,
      metadata: insertSession.metadata || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.chatSessions.set(id, session);
    return session;
  }

  async getChatSession(id: string): Promise<ChatSession | undefined> {
    return this.chatSessions.get(id);
  }

  async getChatSessionsByProject(projectId: string): Promise<ChatSession[]> {
    return Array.from(this.chatSessions.values()).filter(
      (session) => session.projectId === projectId
    );
  }

  async updateChatSession(id: string, updates: Partial<InsertChatSession>): Promise<void> {
    const session = this.chatSessions.get(id);
    if (session) {
      const updated: ChatSession = {
        ...session,
        ...updates,
        updatedAt: new Date(),
      };
      this.chatSessions.set(id, updated);
    }
  }

  async deleteChatSession(id: string): Promise<void> {
    this.chatSessions.delete(id);
  }

  // Chat Messages
  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = {
      id,
      sessionId: insertMessage.sessionId,
      role: insertMessage.role,
      content: insertMessage.content,
      sourceReferences: insertMessage.sourceReferences || null,
      metadata: insertMessage.metadata || null,
      createdAt: new Date(),
    };
    this.chatMessages.set(id, message);
    return message;
  }

  async getChatMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter((message) => message.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async deleteChatMessage(id: string): Promise<void> {
    this.chatMessages.delete(id);
  }

  // Compliance Gaps
  async createComplianceGap(insertGap: InsertComplianceGap): Promise<ComplianceGap> {
    const id = randomUUID();
    const gap: ComplianceGap = {
      id,
      projectId: insertGap.projectId,
      proposalId: insertGap.proposalId,
      gapType: insertGap.gapType,
      severity: insertGap.severity,
      requirementId: insertGap.requirementId || null,
      section: insertGap.section || null,
      description: insertGap.description,
      aiRationale: insertGap.aiRationale || null,
      suggestedAction: insertGap.suggestedAction || null,
      isResolved: insertGap.isResolved || "false",
      createdAt: new Date(),
    };
    this.complianceGaps.set(id, gap);
    return gap;
  }

  async getComplianceGap(id: string): Promise<ComplianceGap | undefined> {
    return this.complianceGaps.get(id);
  }

  async getComplianceGapsByProject(projectId: string): Promise<ComplianceGap[]> {
    return Array.from(this.complianceGaps.values()).filter(
      (gap) => gap.projectId === projectId
    );
  }

  async getComplianceGapsByProposal(proposalId: string): Promise<ComplianceGap[]> {
    return Array.from(this.complianceGaps.values()).filter(
      (gap) => gap.proposalId === proposalId
    );
  }

  async updateComplianceGap(id: string, updates: Partial<InsertComplianceGap>): Promise<void> {
    const gap = this.complianceGaps.get(id);
    if (gap) {
      const updated: ComplianceGap = {
        ...gap,
        ...updates,
      };
      this.complianceGaps.set(id, updated);
    }
  }

  async deleteComplianceGap(id: string): Promise<void> {
    this.complianceGaps.delete(id);
  }

  // Comparison Snapshots
  async createComparisonSnapshot(insertSnapshot: InsertComparisonSnapshot): Promise<ComparisonSnapshot> {
    const id = randomUUID();
    const snapshot: ComparisonSnapshot = {
      id,
      projectId: insertSnapshot.projectId,
      title: insertSnapshot.title,
      comparisonType: insertSnapshot.comparisonType,
      vendorIds: insertSnapshot.vendorIds,
      comparisonData: insertSnapshot.comparisonData,
      highlights: insertSnapshot.highlights || null,
      metadata: insertSnapshot.metadata || null,
      createdAt: new Date(),
    };
    this.comparisonSnapshots.set(id, snapshot);
    return snapshot;
  }

  async getComparisonSnapshot(id: string): Promise<ComparisonSnapshot | undefined> {
    return this.comparisonSnapshots.get(id);
  }

  async getComparisonSnapshotsByProject(projectId: string): Promise<ComparisonSnapshot[]> {
    return Array.from(this.comparisonSnapshots.values()).filter(
      (snapshot) => snapshot.projectId === projectId
    );
  }

  async deleteComparisonSnapshot(id: string): Promise<void> {
    this.comparisonSnapshots.delete(id);
  }

  // Executive Briefings
  async createExecutiveBriefing(insertBriefing: InsertExecutiveBriefing): Promise<ExecutiveBriefing> {
    const id = randomUUID();
    const briefing: ExecutiveBriefing = {
      id,
      projectId: insertBriefing.projectId,
      stakeholderRole: insertBriefing.stakeholderRole,
      briefingType: insertBriefing.briefingType,
      title: insertBriefing.title,
      content: insertBriefing.content,
      keyFindings: insertBriefing.keyFindings || null,
      recommendations: insertBriefing.recommendations || null,
      metadata: insertBriefing.metadata || null,
      createdAt: new Date(),
    };
    this.executiveBriefings.set(id, briefing);
    return briefing;
  }

  async getExecutiveBriefing(id: string): Promise<ExecutiveBriefing | undefined> {
    return this.executiveBriefings.get(id);
  }

  async getExecutiveBriefingsByProject(projectId: string): Promise<ExecutiveBriefing[]> {
    return Array.from(this.executiveBriefings.values()).filter(
      (briefing) => briefing.projectId === projectId
    );
  }

  async getExecutiveBriefingsByRole(projectId: string, stakeholderRole: string): Promise<ExecutiveBriefing[]> {
    return Array.from(this.executiveBriefings.values()).filter(
      (briefing) => briefing.projectId === projectId && briefing.stakeholderRole === stakeholderRole
    );
  }

  async deleteExecutiveBriefing(id: string): Promise<void> {
    this.executiveBriefings.delete(id);
  }

  // Followup Questions
  async createFollowupQuestion(insertQuestion: InsertFollowupQuestion): Promise<FollowupQuestion> {
    const id = randomUUID();
    const question: FollowupQuestion = {
      id,
      projectId: insertQuestion.projectId,
      proposalId: insertQuestion.proposalId,
      category: insertQuestion.category,
      priority: insertQuestion.priority,
      question: insertQuestion.question,
      context: insertQuestion.context || null,
      relatedSection: insertQuestion.relatedSection || null,
      aiRationale: insertQuestion.aiRationale || null,
      isAnswered: insertQuestion.isAnswered || "false",
      answer: insertQuestion.answer || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.followupQuestions.set(id, question);
    return question;
  }

  async getFollowupQuestion(id: string): Promise<FollowupQuestion | undefined> {
    return this.followupQuestions.get(id);
  }

  async getFollowupQuestionsByProject(projectId: string): Promise<FollowupQuestion[]> {
    return Array.from(this.followupQuestions.values()).filter(
      (question) => question.projectId === projectId
    );
  }

  async getFollowupQuestionsByProposal(proposalId: string): Promise<FollowupQuestion[]> {
    return Array.from(this.followupQuestions.values()).filter(
      (question) => question.proposalId === proposalId
    );
  }

  async updateFollowupQuestion(id: string, updates: Partial<InsertFollowupQuestion>): Promise<void> {
    const question = this.followupQuestions.get(id);
    if (question) {
      const updated: FollowupQuestion = {
        ...question,
        ...updates,
        updatedAt: new Date(),
      };
      this.followupQuestions.set(id, updated);
    }
  }

  async deleteFollowupQuestion(id: string): Promise<void> {
    this.followupQuestions.delete(id);
  }

  // Business Cases
  async createBusinessCase(insertBusinessCase: InsertBusinessCase): Promise<BusinessCase> {
    const id = randomUUID();
    const businessCase: BusinessCase = {
      id,
      ...insertBusinessCase,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.businessCases.set(id, businessCase);
    return businessCase;
  }

  async getBusinessCase(id: string): Promise<BusinessCase | undefined> {
    return this.businessCases.get(id);
  }

  async getAllBusinessCases(): Promise<BusinessCase[]> {
    return Array.from(this.businessCases.values());
  }

  async getBusinessCasesByPortfolio(portfolioId: string): Promise<BusinessCase[]> {
    return Array.from(this.businessCases.values()).filter(
      (bc) => bc.portfolioId === portfolioId
    );
  }

  async updateBusinessCase(id: string, updates: Partial<InsertBusinessCase>): Promise<void> {
    const businessCase = this.businessCases.get(id);
    if (businessCase) {
      const updated: BusinessCase = {
        ...businessCase,
        ...updates,
        updatedAt: new Date(),
      };
      this.businessCases.set(id, updated);
    }
  }

  async deleteBusinessCase(id: string): Promise<void> {
    this.businessCases.delete(id);
  }

  // RFT Templates
  async createRftTemplate(insertTemplate: InsertRftTemplate): Promise<RftTemplate> {
    const id = randomUUID();
    const template: RftTemplate = {
      id,
      ...insertTemplate,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.rftTemplates.set(id, template);
    return template;
  }

  async getRftTemplate(id: string): Promise<RftTemplate | undefined> {
    return this.rftTemplates.get(id);
  }

  async getAllRftTemplates(): Promise<RftTemplate[]> {
    return Array.from(this.rftTemplates.values());
  }

  async getActiveRftTemplates(): Promise<RftTemplate[]> {
    return Array.from(this.rftTemplates.values()).filter(
      (template) => template.isActive === "true"
    );
  }

  async getRftTemplatesByCategory(category: string): Promise<RftTemplate[]> {
    return Array.from(this.rftTemplates.values()).filter(
      (template) => template.category === category
    );
  }

  async updateRftTemplate(id: string, updates: Partial<InsertRftTemplate>): Promise<void> {
    const template = this.rftTemplates.get(id);
    if (template) {
      const updated: RftTemplate = {
        ...template,
        ...updates,
        updatedAt: new Date(),
      };
      this.rftTemplates.set(id, updated);
    }
  }

  async deleteRftTemplate(id: string): Promise<void> {
    this.rftTemplates.delete(id);
  }

  // Generated RFTs
  async createGeneratedRft(insertRft: InsertGeneratedRft): Promise<GeneratedRft> {
    const id = randomUUID();
    const rft: GeneratedRft = {
      id,
      publishedAt: null,
      ...insertRft,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.generatedRfts.set(id, rft);
    return rft;
  }

  async getGeneratedRft(id: string): Promise<GeneratedRft | undefined> {
    return this.generatedRfts.get(id);
  }

  async getAllGeneratedRfts(): Promise<GeneratedRft[]> {
    return Array.from(this.generatedRfts.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getGeneratedRftsByProject(projectId: string): Promise<GeneratedRft[]> {
    return Array.from(this.generatedRfts.values()).filter(
      (rft) => rft.projectId === projectId
    );
  }

  async getGeneratedRftsByBusinessCase(businessCaseId: string): Promise<GeneratedRft[]> {
    return Array.from(this.generatedRfts.values()).filter(
      (rft) => rft.businessCaseId === businessCaseId
    );
  }

  async updateGeneratedRft(id: string, updates: Partial<InsertGeneratedRft>): Promise<void> {
    const rft = this.generatedRfts.get(id);
    if (rft) {
      const updated: GeneratedRft = {
        ...rft,
        ...updates,
        updatedAt: new Date(),
      };
      this.generatedRfts.set(id, updated);
    }
  }

  async deleteGeneratedRft(id: string): Promise<void> {
    this.generatedRfts.delete(id);
  }

  async getGeneratedRftsByPortfolio(portfolioId: string): Promise<GeneratedRft[]> {
    // Get all projects in this portfolio
    const portfolioProjects = Array.from(this.projects.values()).filter(
      (p) => p.portfolioId === portfolioId
    );
    const projectIds = new Set(portfolioProjects.map((p) => p.id));
    
    // Get all RFTs for those projects
    return Array.from(this.generatedRfts.values())
      .filter((rft) => projectIds.has(rft.projectId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getPortfolioRftStats(portfolioId: string): Promise<{
    totalRfts: number;
    active: number;
    evaluationInProgress: number;
  }> {
    // Get all projects in this portfolio
    const portfolioProjects = Array.from(this.projects.values()).filter(
      (p) => p.portfolioId === portfolioId
    );
    const projectIds = new Set(portfolioProjects.map((p) => p.id));
    
    // Get all RFTs for those projects
    const portfolioRfts = Array.from(this.generatedRfts.values()).filter(
      (rft) => projectIds.has(rft.projectId)
    );

    // Count unique PROJECTS with evaluations in progress (not total evaluations)
    const projectsWithEvaluationsInProgress = new Set(
      Array.from(this.evaluations.values())
        .filter((evaluation) => 
          projectIds.has(evaluation.projectId) && 
          (evaluation.status === "under-review" || evaluation.status === "analyzing")
        )
        .map((evaluation) => evaluation.projectId)
    ).size;

    return {
      totalRfts: portfolioRfts.length,
      active: portfolioRfts.filter((rft) => rft.status === "published").length,
      evaluationInProgress: projectsWithEvaluationsInProgress,
    };
  }

  async createVendorStage(stage: InsertVendorShortlistingStage): Promise<VendorShortlistingStage> {
    throw new Error("createVendorStage not implemented in MemStorage - PostgreSQL override required");
  }

  async getVendorStagesByProject(projectId: string): Promise<VendorShortlistingStage[]> {
    throw new Error("getVendorStagesByProject not implemented in MemStorage - PostgreSQL override required");
  }

  async getVendorStageByProjectAndVendor(projectId: string, vendorName: string): Promise<VendorShortlistingStage | undefined> {
    throw new Error("getVendorStageByProjectAndVendor not implemented in MemStorage - PostgreSQL override required");
  }

  async updateVendorStage(id: string, updates: Partial<InsertVendorShortlistingStage>): Promise<void> {
    throw new Error("updateVendorStage not implemented in MemStorage - PostgreSQL override required");
  }

  async deleteVendorStage(id: string): Promise<void> {
    throw new Error("deleteVendorStage not implemented in MemStorage - PostgreSQL override required");
  }

  async getAllVendorStages(): Promise<VendorShortlistingStage[]> {
    throw new Error("getAllVendorStages not implemented in MemStorage - PostgreSQL override required");
  }
}

import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export const storage = new MemStorage();

// Override system config methods to use PostgreSQL
const originalUpsertSystemConfig = storage.upsertSystemConfig.bind(storage);
storage.upsertSystemConfig = async function(insertConfig: InsertSystemConfig): Promise<SystemConfig> {
  const existing = await db.select().from(systemConfig).where(eq(systemConfig.key, insertConfig.key)).limit(1);
  
  if (existing.length > 0) {
    const updated = await db.update(systemConfig)
      .set({
        category: insertConfig.category,
        value: insertConfig.value || null,
        isEncrypted: insertConfig.isEncrypted || "false",
        description: insertConfig.description || null,
        updatedAt: new Date(),
      })
      .where(eq(systemConfig.key, insertConfig.key))
      .returning();
    return updated[0]!;
  } else {
    const created = await db.insert(systemConfig)
      .values({
        category: insertConfig.category,
        key: insertConfig.key,
        value: insertConfig.value || null,
        isEncrypted: insertConfig.isEncrypted || "false",
        description: insertConfig.description || null,
      })
      .returning();
    return created[0]!;
  }
};

storage.getAllSystemConfig = async function(): Promise<SystemConfig[]> {
  return await db.select().from(systemConfig);
};

storage.getSystemConfigByKey = async function(key: string): Promise<SystemConfig | undefined> {
  const results = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
  return results[0];
};

storage.getSystemConfigByCategory = async function(category: string): Promise<SystemConfig[]> {
  return await db.select().from(systemConfig).where(eq(systemConfig.category, category));
};

storage.deleteSystemConfig = async function(key: string): Promise<void> {
  await db.delete(systemConfig).where(eq(systemConfig.key, key));
};

// Override MCP connector methods to use PostgreSQL
storage.createMcpConnector = async function(insertConnector: InsertMcpConnector): Promise<McpConnector> {
  const created = await db.insert(mcpConnectors)
    .values({
      name: insertConnector.name,
      description: insertConnector.description || null,
      serverUrl: insertConnector.serverUrl,
      apiKey: encryptApiKey(insertConnector.apiKey),
      connectorType: insertConnector.connectorType || "rest",
      authType: insertConnector.authType || "bearer",
      roleMapping: insertConnector.roleMapping || null,
      config: insertConnector.config || null,
      isActive: insertConnector.isActive || "true",
    })
    .returning();
  
  const result = created[0]!;
  return {
    ...result,
    apiKey: decryptApiKey(result.apiKey),
  };
};

storage.getMcpConnector = async function(id: string): Promise<McpConnector | undefined> {
  const results = await db.select().from(mcpConnectors).where(eq(mcpConnectors.id, id)).limit(1);
  const connector = results[0];
  if (!connector) return undefined;
  return {
    ...connector,
    apiKey: decryptApiKey(connector.apiKey),
  };
};

storage.getAllMcpConnectors = async function(): Promise<McpConnector[]> {
  const connectors = await db.select().from(mcpConnectors);
  return connectors.map(c => ({
    ...c,
    apiKey: decryptApiKey(c.apiKey),
  }));
};

storage.getActiveMcpConnectors = async function(): Promise<McpConnector[]> {
  const connectors = await db.select().from(mcpConnectors).where(eq(mcpConnectors.isActive, "true"));
  return connectors.map(c => ({
    ...c,
    apiKey: decryptApiKey(c.apiKey),
  }));
};

storage.updateMcpConnector = async function(id: string, updates: Partial<InsertMcpConnector>): Promise<void> {
  const updateData = { ...updates };
  if (updateData.apiKey !== undefined) {
    updateData.apiKey = encryptApiKey(updateData.apiKey);
  }
  
  await db.update(mcpConnectors)
    .set(updateData)
    .where(eq(mcpConnectors.id, id));
};

storage.deleteMcpConnector = async function(id: string): Promise<void> {
  await db.delete(mcpConnectors).where(eq(mcpConnectors.id, id));
};

// Override portfolio methods to use PostgreSQL
storage.createPortfolio = async function(insertPortfolio: InsertPortfolio): Promise<Portfolio> {
  const created = await db.insert(portfolios)
    .values({
      name: insertPortfolio.name,
      description: insertPortfolio.description || null,
    })
    .returning();
  return created[0]!;
};

storage.getPortfolio = async function(id: string): Promise<Portfolio | undefined> {
  const results = await db.select().from(portfolios).where(eq(portfolios.id, id)).limit(1);
  return results[0];
};

storage.getAllPortfolios = async function(): Promise<Portfolio[]> {
  return await db.select().from(portfolios);
};

storage.getPortfolioByName = async function(name: string): Promise<Portfolio | undefined> {
  const results = await db.select().from(portfolios).where(eq(portfolios.name, name)).limit(1);
  return results[0];
};

storage.deletePortfolio = async function(id: string): Promise<void> {
  await db.delete(portfolios).where(eq(portfolios.id, id));
};

// Override project methods to use PostgreSQL
storage.createProject = async function(insertProject: InsertProject): Promise<Project> {
  const created = await db.insert(projects)
    .values({
      portfolioId: insertProject.portfolioId,
      name: insertProject.name,
      initiativeName: insertProject.initiativeName || null,
      vendorList: insertProject.vendorList || null,
      businessCaseId: insertProject.businessCaseId || null,
      generatedRftId: insertProject.generatedRftId || null,
      status: insertProject.status || "analyzing",
    })
    .returning();
  return created[0]!;
};

storage.getProject = async function(id: string): Promise<Project | undefined> {
  const results = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return results[0];
};

storage.getAllProjects = async function(): Promise<Project[]> {
  return await db.select().from(projects);
};

storage.getProjectsByPortfolio = async function(portfolioId: string): Promise<Project[]> {
  return await db.select().from(projects).where(eq(projects.portfolioId, portfolioId));
};

storage.updateProjectStatus = async function(id: string, status: string): Promise<void> {
  await db.update(projects)
    .set({ status })
    .where(eq(projects.id, id));
};

storage.deleteProject = async function(id: string): Promise<void> {
  await db.delete(projects).where(eq(projects.id, id));
};

// Override business case methods to use PostgreSQL
storage.createBusinessCase = async function(insertBusinessCase: InsertBusinessCase): Promise<BusinessCase> {
  const created = await db.insert(businessCases)
    .values({
      portfolioId: insertBusinessCase.portfolioId,
      name: insertBusinessCase.name,
      description: insertBusinessCase.description || null,
      fileName: insertBusinessCase.fileName || null,
      documentContent: insertBusinessCase.documentContent || null,
      extractedData: insertBusinessCase.extractedData || null,
      ragDocumentId: insertBusinessCase.ragDocumentId || null,
      status: insertBusinessCase.status || "pending",
    })
    .returning();
  return created[0]!;
};

storage.getBusinessCase = async function(id: string): Promise<BusinessCase | undefined> {
  const results = await db.select().from(businessCases).where(eq(businessCases.id, id)).limit(1);
  return results[0];
};

storage.getAllBusinessCases = async function(): Promise<BusinessCase[]> {
  return await db.select().from(businessCases);
};

storage.getBusinessCasesByPortfolio = async function(portfolioId: string): Promise<BusinessCase[]> {
  return await db.select().from(businessCases).where(eq(businessCases.portfolioId, portfolioId));
};

storage.updateBusinessCase = async function(id: string, updates: Partial<InsertBusinessCase>): Promise<void> {
  await db.update(businessCases)
    .set(updates)
    .where(eq(businessCases.id, id));
};

storage.deleteBusinessCase = async function(id: string): Promise<void> {
  await db.delete(businessCases).where(eq(businessCases.id, id));
};

// Override generated RFT methods to use PostgreSQL
storage.createGeneratedRft = async function(insertRft: InsertGeneratedRft): Promise<GeneratedRft> {
  // Insert ALL fields from insertRft - this was causing data loss!
  // Previously only saved 6 fields, missing questionnaire paths, version, and metadata
  const created = await db.insert(generatedRfts)
    .values(insertRft)
    .returning();
  return created[0]!;
};

storage.getGeneratedRft = async function(id: string): Promise<GeneratedRft | undefined> {
  const results = await db.select().from(generatedRfts).where(eq(generatedRfts.id, id)).limit(1);
  return results[0];
};

storage.getAllGeneratedRfts = async function(): Promise<GeneratedRft[]> {
  return await db.select().from(generatedRfts);
};

storage.getGeneratedRftsByProject = async function(projectId: string): Promise<GeneratedRft[]> {
  return await db.select().from(generatedRfts).where(eq(generatedRfts.projectId, projectId));
};

storage.getGeneratedRftsByBusinessCase = async function(businessCaseId: string): Promise<GeneratedRft[]> {
  return await db.select().from(generatedRfts).where(eq(generatedRfts.businessCaseId, businessCaseId));
};

storage.updateGeneratedRft = async function(id: string, updates: Partial<InsertGeneratedRft>): Promise<void> {
  await db.update(generatedRfts)
    .set(updates)
    .where(eq(generatedRfts.id, id));
};

storage.deleteGeneratedRft = async function(id: string): Promise<void> {
  await db.delete(generatedRfts).where(eq(generatedRfts.id, id));
};

storage.getGeneratedRftsByPortfolio = async function(portfolioId: string): Promise<GeneratedRft[]> {
  // Get all projects in this portfolio
  const portfolioProjects = await db.select().from(projects).where(eq(projects.portfolioId, portfolioId));
  const projectIds = portfolioProjects.map((p) => p.id);
  
  if (projectIds.length === 0) {
    return [];
  }
  
  // Get all RFTs for those projects
  const allRfts = await db.select().from(generatedRfts);
  const filteredRfts = allRfts.filter((rft) => projectIds.includes(rft.projectId));
  
  // Sort by created date (newest first)
  return filteredRfts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

// Override requirement methods to use PostgreSQL
storage.createRequirement = async function(insertRequirement: InsertRequirement): Promise<Requirement> {
  const created = await db.insert(requirements)
    .values({
      projectId: insertRequirement.projectId,
      documentType: insertRequirement.documentType || "RFT",
      fileName: insertRequirement.fileName,
      extractedData: insertRequirement.extractedData || null,
      evaluationCriteria: insertRequirement.evaluationCriteria || null,
      standardId: insertRequirement.standardId || null,
      taggedSections: insertRequirement.taggedSections || null,
    })
    .returning();
  return created[0]!;
};

storage.getRequirementsByProject = async function(projectId: string): Promise<Requirement[]> {
  return await db.select().from(requirements).where(eq(requirements.projectId, projectId));
};

storage.deleteRequirement = async function(id: string): Promise<void> {
  await db.delete(requirements).where(eq(requirements.id, id));
};

// Override proposal methods to use PostgreSQL
storage.createProposal = async function(insertProposal: InsertProposal): Promise<Proposal> {
  const created = await db.insert(proposals)
    .values({
      projectId: insertProposal.projectId,
      vendorName: insertProposal.vendorName,
      documentType: insertProposal.documentType || "proposal",
      fileName: insertProposal.fileName,
      blobUrl: insertProposal.blobUrl || null,
      extractedData: insertProposal.extractedData || null,
      standardId: insertProposal.standardId || null,
      taggedSections: insertProposal.taggedSections || null,
    })
    .returning();
  return created[0]!;
};

storage.getProposalsByProject = async function(projectId: string): Promise<Proposal[]> {
  return await db.select().from(proposals).where(eq(proposals.projectId, projectId));
};

storage.getProposal = async function(id: string): Promise<Proposal | undefined> {
  const results = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  return results[0];
};

storage.deleteProposal = async function(id: string): Promise<void> {
  await db.delete(proposals).where(eq(proposals.id, id));
};

// Override evaluation methods to use PostgreSQL
storage.createEvaluation = async function(insertEvaluation: InsertEvaluation): Promise<Evaluation> {
  const created = await db.insert(evaluations)
    .values({
      projectId: insertEvaluation.projectId!,
      proposalId: insertEvaluation.proposalId,
      overallScore: insertEvaluation.overallScore!,
      functionalFit: insertEvaluation.functionalFit!,
      technicalFit: insertEvaluation.technicalFit!,
      deliveryRisk: insertEvaluation.deliveryRisk!,
      cost: insertEvaluation.cost!,
      compliance: insertEvaluation.compliance!,
      status: insertEvaluation.status || "analyzing",
      aiRationale: insertEvaluation.aiRationale || null,
      roleInsights: insertEvaluation.roleInsights || null,
      detailedScores: insertEvaluation.detailedScores || null,
      sectionCompliance: insertEvaluation.sectionCompliance || null,
      agentDiagnostics: insertEvaluation.agentDiagnostics || null,
    })
    .returning();
  return created[0]!;
};

storage.getEvaluationsByProject = async function(projectId: string): Promise<Evaluation[]> {
  return await db.select().from(evaluations).where(eq(evaluations.projectId, projectId));
};

storage.getEvaluationByProposal = async function(proposalId: string): Promise<Evaluation | undefined> {
  const results = await db.select().from(evaluations).where(eq(evaluations.proposalId, proposalId)).limit(1);
  return results[0];
};

storage.getEvaluation = async function(id: string): Promise<Evaluation | undefined> {
  const results = await db.select().from(evaluations).where(eq(evaluations.id, id)).limit(1);
  return results[0];
};

storage.updateEvaluation = async function(id: string, updates: Partial<InsertEvaluation>): Promise<void> {
  await db.update(evaluations)
    .set(updates)
    .where(eq(evaluations.id, id));
};

storage.deleteEvaluation = async function(id: string): Promise<void> {
  await db.delete(evaluations).where(eq(evaluations.id, id));
};

// Override getPortfolioRftStats to use PostgreSQL
storage.getPortfolioRftStats = async function(portfolioId: string): Promise<{
  totalRfts: number;
  active: number;
  evaluationInProgress: number;
}> {
  // Get all projects in this portfolio
  const portfolioProjects = await db.select().from(projects).where(eq(projects.portfolioId, portfolioId));
  const projectIds = portfolioProjects.map(p => p.id);
  
  if (projectIds.length === 0) {
    return {
      totalRfts: 0,
      active: 0,
      evaluationInProgress: 0,
    };
  }
  
  // Get all RFTs for those projects
  const portfolioRfts = await db.select().from(generatedRfts);
  const filteredRfts = portfolioRfts.filter(rft => projectIds.includes(rft.projectId));

  // Count unique PROJECTS with evaluations in progress (not total evaluations)
  const allEvaluations = await db.select().from(evaluations);
  const projectsWithEvaluationsInProgress = new Set(
    allEvaluations
      .filter((evaluation) => 
        evaluation.projectId && 
        projectIds.includes(evaluation.projectId) && 
        (evaluation.status === "under-review" || evaluation.status === "analyzing")
      )
      .map((evaluation) => evaluation.projectId)
  ).size;

  return {
    totalRfts: filteredRfts.length,
    active: filteredRfts.filter((rft) => rft.status === "published").length,
    evaluationInProgress: projectsWithEvaluationsInProgress,
  };
};

// Override vendor shortlisting stage methods to use PostgreSQL
storage.createVendorStage = async function(insertStage: InsertVendorShortlistingStage): Promise<VendorShortlistingStage> {
  const created = await db.insert(vendorShortlistingStages)
    .values(insertStage)
    .returning();
  return created[0]!;
};

storage.getVendorStagesByProject = async function(projectId: string): Promise<VendorShortlistingStage[]> {
  return await db.select().from(vendorShortlistingStages).where(eq(vendorShortlistingStages.projectId, projectId));
};

storage.getVendorStageByProjectAndVendor = async function(projectId: string, vendorName: string): Promise<VendorShortlistingStage | undefined> {
  const results = await db.select()
    .from(vendorShortlistingStages)
    .where(
      and(
        eq(vendorShortlistingStages.projectId, projectId),
        eq(vendorShortlistingStages.vendorName, vendorName)
      )
    )
    .limit(1);
  return results[0];
};

storage.updateVendorStage = async function(id: string, updates: Partial<InsertVendorShortlistingStage>): Promise<void> {
  await db.update(vendorShortlistingStages)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(vendorShortlistingStages.id, id));
};

storage.deleteVendorStage = async function(id: string): Promise<void> {
  await db.delete(vendorShortlistingStages).where(eq(vendorShortlistingStages.id, id));
};

storage.getAllVendorStages = async function(): Promise<VendorShortlistingStage[]> {
  return await db.select().from(vendorShortlistingStages);
};
