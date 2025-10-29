import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const portfolios = pgTable("portfolios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const standards = pgTable("standards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"), // 'architecture', 'delivery', 'procurement', 'development', 'security', 'general'
  sections: jsonb("sections").notNull(),
  tags: text("tags").array(),
  fileName: text("file_name"),
  documentContent: text("document_content"),
  ragDocumentId: varchar("rag_document_id"), // Link to RAG system for retrieval
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mcpConnectors = pgTable("mcp_connectors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  serverUrl: text("server_url").notNull(),
  apiKey: text("api_key"),
  config: jsonb("config"),
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const systemConfig = pgTable("system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // 'azure_search', 'azure_storage', 'azure_openai', 'rag_settings'
  key: text("key").notNull().unique(),
  value: text("value"),
  isEncrypted: text("is_encrypted").notNull().default("false"),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull(),
  name: text("name").notNull(),
  initiativeName: text("initiative_name"),
  vendorList: text("vendor_list").array(),
  status: text("status").notNull().default("analyzing"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const requirements = pgTable("requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  documentType: text("document_type").notNull().default("RFT"),
  fileName: text("file_name").notNull(),
  extractedData: jsonb("extracted_data"),
  evaluationCriteria: jsonb("evaluation_criteria"),
  standardId: varchar("standard_id"),
  taggedSections: jsonb("tagged_sections"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  extractedData: jsonb("extracted_data"),
  standardId: varchar("standard_id"),
  taggedSections: jsonb("tagged_sections"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const evaluations = pgTable("evaluations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  proposalId: varchar("proposal_id").notNull(),
  overallScore: integer("overall_score").notNull(),
  technicalFit: integer("technical_fit").notNull(),
  deliveryRisk: integer("delivery_risk").notNull(),
  cost: text("cost").notNull(),
  compliance: integer("compliance").notNull(),
  status: text("status").notNull(),
  aiRationale: text("ai_rationale"),
  roleInsights: jsonb("role_insights"),
  detailedScores: jsonb("detailed_scores"),
  sectionCompliance: jsonb("section_compliance"),
  agentDiagnostics: jsonb("agent_diagnostics"), // Multiagent execution diagnostics
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const evaluationCriteria = pgTable("evaluation_criteria", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  evaluationId: varchar("evaluation_id").notNull(),
  role: text("role").notNull(), // 'product' or 'architecture'
  section: text("section").notNull(),
  question: text("question").notNull(),
  score: integer("score").notNull(), // 100, 50, 25, or 0
  scoreLabel: text("score_label").notNull(), // The dropdown label
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ragDocuments = pgTable("rag_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceType: text("source_type").notNull(), // 'standard', 'proposal', 'requirement', 'confluence', 'sharepoint'
  sourceId: varchar("source_id"), // ID of the source record (e.g., standard_id, proposal_id)
  fileName: text("file_name").notNull(),
  blobUrl: text("blob_url"), // Azure Blob Storage URL
  blobName: text("blob_name"), // Azure Blob Storage object name (for reliable deletion)
  searchDocId: text("search_doc_id"), // Azure AI Search document ID
  indexName: text("index_name").notNull().default("intellibid-rag"),
  totalChunks: integer("total_chunks").notNull().default(0),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'indexed', 'failed'
  metadata: jsonb("metadata"), // Custom metadata (tags, vendor, project, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ragChunks = pgTable("rag_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull(), // References ragDocuments.id
  chunkIndex: integer("chunk_index").notNull(), // 0-based index in the document
  content: text("content").notNull(),
  tokenCount: integer("token_count").notNull(),
  searchChunkId: text("search_chunk_id"), // Azure AI Search chunk ID
  metadata: jsonb("metadata"), // Section title, page number, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Document categories for Knowledge Base
export const documentCategories = [
  "architecture",
  "delivery",
  "procurement",
  "development",
  "security",
  "general",
] as const;

export const documentCategorySchema = z.enum(documentCategories);
export type DocumentCategory = z.infer<typeof documentCategorySchema>;

export const insertStandardSchema = createInsertSchema(standards).omit({
  id: true,
  createdAt: true,
}).extend({
  category: documentCategorySchema.default("general"),
});

export const insertPortfolioSchema = createInsertSchema(portfolios).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertRequirementSchema = createInsertSchema(requirements).omit({
  id: true,
  createdAt: true,
});

export const insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  createdAt: true,
});

export const insertEvaluationSchema = createInsertSchema(evaluations).omit({
  id: true,
  createdAt: true,
});

export const insertMcpConnectorSchema = createInsertSchema(mcpConnectors).omit({
  id: true,
  createdAt: true,
});

export const insertSystemConfigSchema = createInsertSchema(systemConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEvaluationCriteriaSchema = createInsertSchema(evaluationCriteria).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRagDocumentSchema = createInsertSchema(ragDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRagChunkSchema = createInsertSchema(ragChunks).omit({
  id: true,
  createdAt: true,
});

export type InsertStandard = z.infer<typeof insertStandardSchema>;
export type Standard = typeof standards.$inferSelect;

export type InsertMcpConnector = z.infer<typeof insertMcpConnectorSchema>;
export type McpConnector = typeof mcpConnectors.$inferSelect;

export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;
export type SystemConfig = typeof systemConfig.$inferSelect;

export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type Portfolio = typeof portfolios.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertRequirement = z.infer<typeof insertRequirementSchema>;
export type Requirement = typeof requirements.$inferSelect;

export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposals.$inferSelect;

export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;
export type Evaluation = typeof evaluations.$inferSelect;

export type InsertEvaluationCriteria = z.infer<typeof insertEvaluationCriteriaSchema>;
export type EvaluationCriteria = typeof evaluationCriteria.$inferSelect;

export type InsertRagDocument = z.infer<typeof insertRagDocumentSchema>;
export type RagDocument = typeof ragDocuments.$inferSelect;

export type InsertRagChunk = z.infer<typeof insertRagChunkSchema>;
export type RagChunk = typeof ragChunks.$inferSelect;
