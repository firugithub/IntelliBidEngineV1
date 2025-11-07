-- ====================================================
-- IntelliBid Database Schema for Azure PostgreSQL
-- ====================================================
-- This script creates all tables required for IntelliBid
-- Compatible with Azure PostgreSQL Flexible Server
-- ====================================================

-- Enable UUID generation extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================
-- CORE TABLES
-- ====================================================

-- Portfolios: Top-level organizational containers
CREATE TABLE IF NOT EXISTS "portfolios" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "portfolios_name_unique" UNIQUE("name")
);

-- Projects: RFT evaluation projects within portfolios
CREATE TABLE IF NOT EXISTS "projects" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "portfolio_id" varchar NOT NULL,
    "name" text NOT NULL,
    "initiative_name" text,
    "vendor_list" text[],
    "business_case_id" varchar,
    "generated_rft_id" varchar,
    "status" text DEFAULT 'analyzing' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- System Configuration: Stores Azure service credentials
CREATE TABLE IF NOT EXISTS "system_config" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "category" text NOT NULL,
    "key" text NOT NULL,
    "value" text,
    "is_encrypted" text DEFAULT 'false' NOT NULL,
    "description" text,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "system_config_key_unique" UNIQUE("key")
);

-- ====================================================
-- BUSINESS CASE & RFT GENERATION
-- ====================================================

-- Business Cases: Initial documents that trigger RFT generation
CREATE TABLE IF NOT EXISTS "business_cases" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "portfolio_id" varchar NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "file_name" text NOT NULL,
    "document_content" text,
    "extracted_data" jsonb,
    "rag_document_id" varchar,
    "status" text DEFAULT 'uploaded' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- RFT Templates: Predefined templates for RFT generation
CREATE TABLE IF NOT EXISTS "rft_templates" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "category" text NOT NULL,
    "sections" jsonb NOT NULL,
    "metadata" jsonb,
    "is_active" text DEFAULT 'true' NOT NULL,
    "created_by" text DEFAULT 'system' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "rft_templates_name_unique" UNIQUE("name")
);

-- Generated RFTs: AI-generated RFT documents with questionnaires
CREATE TABLE IF NOT EXISTS "generated_rfts" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" varchar NOT NULL,
    "business_case_id" varchar NOT NULL,
    "template_id" varchar NOT NULL,
    "name" text NOT NULL,
    "sections" jsonb NOT NULL,
    "product_questionnaire_path" text,
    "nfr_questionnaire_path" text,
    "cybersecurity_questionnaire_path" text,
    "agile_questionnaire_path" text,
    "docx_blob_url" text,
    "pdf_blob_url" text,
    "product_questionnaire_blob_url" text,
    "nfr_questionnaire_blob_url" text,
    "cybersecurity_questionnaire_blob_url" text,
    "agile_questionnaire_blob_url" text,
    "status" text DEFAULT 'draft' NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "published_at" timestamp,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ====================================================
-- VENDOR EVALUATION
-- ====================================================

-- Requirements: Extracted RFT requirements
CREATE TABLE IF NOT EXISTS "requirements" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" varchar NOT NULL,
    "document_type" text DEFAULT 'RFT' NOT NULL,
    "file_name" text NOT NULL,
    "extracted_data" jsonb,
    "evaluation_criteria" jsonb,
    "standard_id" varchar,
    "tagged_sections" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Proposals: Vendor responses to RFTs
CREATE TABLE IF NOT EXISTS "proposals" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" varchar NOT NULL,
    "vendor_name" text NOT NULL,
    "document_type" text NOT NULL,
    "file_name" text NOT NULL,
    "blob_url" text,
    "extracted_data" jsonb,
    "standard_id" varchar,
    "tagged_sections" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Evaluations: AI-generated vendor evaluations
CREATE TABLE IF NOT EXISTS "evaluations" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" varchar NOT NULL,
    "proposal_id" varchar NOT NULL,
    "overall_score" integer NOT NULL,
    "functional_fit" integer DEFAULT 0 NOT NULL,
    "technical_fit" integer NOT NULL,
    "delivery_risk" integer NOT NULL,
    "cost" text NOT NULL,
    "compliance" integer NOT NULL,
    "status" text NOT NULL,
    "ai_rationale" text,
    "role_insights" jsonb,
    "detailed_scores" jsonb,
    "section_compliance" jsonb,
    "agent_diagnostics" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Evaluation Criteria: Detailed scoring per question
CREATE TABLE IF NOT EXISTS "evaluation_criteria" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "evaluation_id" varchar NOT NULL,
    "role" text NOT NULL,
    "section" text NOT NULL,
    "question" text NOT NULL,
    "score" integer NOT NULL,
    "score_label" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ====================================================
-- ADVANCED AI FEATURES
-- ====================================================

-- Compliance Gaps: AI-identified gaps in vendor responses
CREATE TABLE IF NOT EXISTS "compliance_gaps" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" varchar NOT NULL,
    "proposal_id" varchar NOT NULL,
    "gap_type" text NOT NULL,
    "severity" text NOT NULL,
    "requirement_id" varchar,
    "section" text,
    "description" text NOT NULL,
    "ai_rationale" text,
    "suggested_action" text,
    "is_resolved" text DEFAULT 'false' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Follow-up Questions: AI-generated clarification questions
CREATE TABLE IF NOT EXISTS "followup_questions" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" varchar NOT NULL,
    "proposal_id" varchar NOT NULL,
    "category" text NOT NULL,
    "priority" text NOT NULL,
    "question" text NOT NULL,
    "context" text,
    "related_section" text,
    "ai_rationale" text,
    "is_answered" text DEFAULT 'false' NOT NULL,
    "answer" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Comparison Snapshots: Vendor comparison matrices
CREATE TABLE IF NOT EXISTS "comparison_snapshots" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" varchar NOT NULL,
    "title" text NOT NULL,
    "comparison_type" text NOT NULL,
    "vendor_ids" text[] NOT NULL,
    "comparison_data" jsonb NOT NULL,
    "highlights" jsonb,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Executive Briefings: Stakeholder-specific summaries
CREATE TABLE IF NOT EXISTS "executive_briefings" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" varchar NOT NULL,
    "stakeholder_role" text NOT NULL,
    "briefing_type" text NOT NULL,
    "title" text NOT NULL,
    "content" text NOT NULL,
    "key_findings" jsonb,
    "recommendations" jsonb,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- ====================================================
-- KNOWLEDGE BASE & RAG SYSTEM
-- ====================================================

-- Standards: Organizational guidelines and compliance documents
CREATE TABLE IF NOT EXISTS "standards" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "category" text DEFAULT 'general' NOT NULL,
    "sections" jsonb NOT NULL,
    "tags" text[],
    "file_name" text,
    "document_content" text,
    "rag_document_id" varchar,
    "is_active" text DEFAULT 'true' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- RAG Documents: Documents indexed in Azure AI Search
CREATE TABLE IF NOT EXISTS "rag_documents" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "source_type" text NOT NULL,
    "source_id" varchar,
    "file_name" text NOT NULL,
    "blob_url" text,
    "blob_name" text,
    "search_doc_id" text,
    "index_name" text DEFAULT 'intellibid-rag' NOT NULL,
    "total_chunks" integer DEFAULT 0 NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- RAG Chunks: Text chunks for vector search
CREATE TABLE IF NOT EXISTS "rag_chunks" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "document_id" varchar NOT NULL,
    "chunk_index" integer NOT NULL,
    "content" text NOT NULL,
    "token_count" integer NOT NULL,
    "search_chunk_id" text,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- ====================================================
-- CHATBOT & INTEGRATIONS
-- ====================================================

-- Chat Sessions: Conversational AI sessions
CREATE TABLE IF NOT EXISTS "chat_sessions" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" varchar NOT NULL,
    "title" text,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Chat Messages: Individual messages in chat sessions
CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "session_id" varchar NOT NULL,
    "role" text NOT NULL,
    "content" text NOT NULL,
    "source_references" jsonb,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- MCP Connectors: External data source integrations
CREATE TABLE IF NOT EXISTS "mcp_connectors" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "server_url" text NOT NULL,
    "api_key" text,
    "connector_type" text DEFAULT 'rest' NOT NULL,
    "auth_type" text DEFAULT 'bearer' NOT NULL,
    "role_mapping" text[],
    "config" jsonb,
    "is_active" text DEFAULT 'true' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- ====================================================
-- SUCCESS MESSAGE
-- ====================================================

DO $$
BEGIN
    RAISE NOTICE '✓ IntelliBid database schema created successfully!';
    RAISE NOTICE '✓ 20 tables created';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Run azure-database-indexes.sql to create performance indexes';
    RAISE NOTICE '  2. Run azure-database-seed.sql to insert initial data';
    RAISE NOTICE '  3. Configure Azure service credentials in Admin Config page';
END $$;
