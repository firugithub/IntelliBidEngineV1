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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  extractedData: jsonb("extracted_data"),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
