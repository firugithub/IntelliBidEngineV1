-- IntelliBid Database Setup for Azure PostgreSQL
-- Updated: November 25, 2025
-- Complete schema with all columns, constraints, atomic duplicate prevention, and 5th Procurement Questionnaire

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS agent_metrics CASCADE;
DROP TABLE IF EXISTS followup_questions CASCADE;
DROP TABLE IF EXISTS executive_briefings CASCADE;
DROP TABLE IF EXISTS comparison_snapshots CASCADE;
DROP TABLE IF EXISTS compliance_gaps CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS rag_chunks CASCADE;
DROP TABLE IF EXISTS rag_documents CASCADE;
DROP TABLE IF EXISTS evaluation_criteria CASCADE;
DROP TABLE IF EXISTS vendor_shortlisting_stages CASCADE;
DROP TABLE IF EXISTS evaluations CASCADE;
DROP TABLE IF EXISTS proposals CASCADE;
DROP TABLE IF EXISTS requirements CASCADE;
DROP TABLE IF EXISTS rft_generation_drafts CASCADE;
DROP TABLE IF EXISTS generated_rfts CASCADE;
DROP TABLE IF EXISTS organization_templates CASCADE;
DROP TABLE IF EXISTS rft_templates CASCADE;
DROP TABLE IF EXISTS business_cases CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;
DROP TABLE IF EXISTS mcp_connectors CASCADE;
DROP TABLE IF EXISTS standards CASCADE;
DROP TABLE IF EXISTS portfolios CASCADE;

-- ============================================
-- Core Tables
-- ============================================

-- Portfolios: Top-level project grouping
CREATE TABLE portfolios (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Standards: Organizational standards and compliance documents
CREATE TABLE standards (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'shared', -- 'delivery', 'product', 'architecture', 'engineering', 'procurement', 'security', 'shared'
  sections JSONB NOT NULL,
  tags TEXT[],
  file_name TEXT,
  document_content TEXT,
  rag_document_id VARCHAR, -- Link to RAG system
  is_active TEXT NOT NULL DEFAULT 'true',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- MCP Connectors: External API integrations for AI agents
CREATE TABLE mcp_connectors (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  server_url TEXT NOT NULL,
  api_key TEXT,
  connector_type TEXT NOT NULL DEFAULT 'rest', -- 'rest', 'graphql', 'websocket'
  auth_type TEXT NOT NULL DEFAULT 'bearer', -- 'bearer', 'basic', 'apikey', 'oauth2'
  role_mapping TEXT[], -- Which agent roles can use this connector
  config JSONB,
  is_active TEXT NOT NULL DEFAULT 'true',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- System Configuration: Application settings
CREATE TABLE system_config (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- 'azure_search', 'azure_storage', 'azure_openai', 'rag_settings'
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  is_encrypted TEXT NOT NULL DEFAULT 'false',
  description TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Projects: Individual RFT evaluation projects
CREATE TABLE projects (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id VARCHAR NOT NULL,
  name TEXT NOT NULL,
  initiative_name TEXT,
  vendor_list TEXT[],
  business_case_id VARCHAR, -- Link to business case document
  generated_rft_id VARCHAR, -- Link to generated RFT
  status TEXT NOT NULL DEFAULT 'analyzing',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Requirements: RFT/RFI requirement documents
CREATE TABLE requirements (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'RFT',
  file_name TEXT NOT NULL,
  extracted_data JSONB,
  evaluation_criteria JSONB,
  standard_id VARCHAR,
  tagged_sections JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Proposals: Vendor proposal documents
-- ATOMIC DUPLICATE PREVENTION: Unique constraint on (project_id, vendor_name, document_type)
CREATE TABLE proposals (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL,
  vendor_name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  blob_url TEXT, -- DEPRECATED - use blob_name
  blob_name TEXT, -- Azure Blob Storage object path
  extracted_data JSONB,
  standard_id VARCHAR,
  tagged_sections JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, vendor_name, document_type) -- Prevent duplicate proposals per vendor
);

-- Evaluations: Multi-agent vendor proposal evaluations
-- ATOMIC DUPLICATE PREVENTION: Unique constraint on proposal_id (1:1 mapping)
CREATE TABLE evaluations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL,
  proposal_id VARCHAR NOT NULL UNIQUE, -- Prevent duplicate evaluations per proposal
  overall_score INTEGER NOT NULL,
  functional_fit INTEGER NOT NULL DEFAULT 0,
  technical_fit INTEGER NOT NULL,
  delivery_risk INTEGER NOT NULL,
  cost TEXT NOT NULL,
  compliance INTEGER NOT NULL,
  status TEXT NOT NULL,
  ai_rationale TEXT,
  role_insights JSONB,
  detailed_scores JSONB,
  section_compliance JSONB,
  agent_diagnostics JSONB, -- Multi-agent execution diagnostics
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Vendor Shortlisting Stages: 10-stage procurement workflow tracking
CREATE TABLE vendor_shortlisting_stages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL,
  vendor_name TEXT NOT NULL,
  current_stage INTEGER NOT NULL DEFAULT 1, -- 1-10
  stage_statuses JSONB NOT NULL, -- {1: {status: 'completed', date: '2024-01-15'}, 2: {status: 'in_progress', date: null}, ...}
  rfi_initiated_date TIMESTAMP,
  rfi_response_received_date TIMESTAMP,
  rfi_evaluation_completed_date TIMESTAMP,
  rft_initiated_date TIMESTAMP,
  rft_response_received_date TIMESTAMP,
  vendor_demo_completed_date TIMESTAMP,
  rft_evaluation_completed_date TIMESTAMP,
  poc_initiated_date TIMESTAMP,
  sow_submitted_date TIMESTAMP,
  sow_reviewed_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Agent Metrics: Performance tracking for AI agents
CREATE TABLE agent_metrics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id VARCHAR NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  agent_role TEXT NOT NULL, -- 'delivery', 'product', 'architecture', 'engineering', 'procurement', 'security'
  vendor_name TEXT NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  token_usage INTEGER NOT NULL,
  estimated_cost_usd NUMERIC(10, 6) NOT NULL, -- Up to $9,999.999999
  success BOOLEAN NOT NULL,
  error_type TEXT, -- 'timeout', 'execution_error', null if success
  error_message TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Evaluation Criteria: Detailed scoring criteria
CREATE TABLE evaluation_criteria (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id VARCHAR NOT NULL,
  role TEXT NOT NULL, -- 'product', 'architecture', etc.
  section TEXT NOT NULL,
  question TEXT NOT NULL,
  score INTEGER NOT NULL, -- 100, 50, 25, or 0
  score_label TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- RAG & Knowledge Base
-- ============================================

-- RAG Documents: Document registry for knowledge base
CREATE TABLE rag_documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL, -- 'standard', 'proposal', 'requirement', 'confluence', 'sharepoint'
  source_id VARCHAR, -- ID of source record
  category TEXT NOT NULL DEFAULT 'shared', -- 'delivery', 'product', 'architecture', 'engineering', 'procurement', 'security', 'shared'
  file_name TEXT NOT NULL,
  blob_url TEXT, -- Azure Blob Storage URL
  blob_name TEXT, -- Azure Blob Storage object name
  search_doc_id TEXT, -- Azure AI Search document ID
  index_name TEXT NOT NULL DEFAULT 'intellibid-rag',
  total_chunks INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'indexed', 'failed'
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RAG Chunks: Semantic chunks for retrieval
CREATE TABLE rag_chunks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR NOT NULL, -- References rag_documents.id
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  search_chunk_id TEXT, -- Azure AI Search chunk ID
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Conversational AI
-- ============================================

-- Chat Sessions: User chat sessions with AI assistant
CREATE TABLE chat_sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL,
  title TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Chat Messages: Individual messages in chat sessions
CREATE TABLE chat_messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR NOT NULL,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  source_references JSONB,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Advanced AI Features
-- ============================================

-- Compliance Gaps: AI-detected compliance issues
CREATE TABLE compliance_gaps (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL,
  proposal_id VARCHAR NOT NULL,
  gap_type TEXT NOT NULL, -- 'missing_requirement', 'vague_answer', 'incomplete_information'
  severity TEXT NOT NULL, -- 'critical', 'high', 'medium', 'low'
  requirement_id VARCHAR,
  section TEXT,
  description TEXT NOT NULL,
  ai_rationale TEXT,
  suggested_action TEXT,
  is_resolved TEXT NOT NULL DEFAULT 'false',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Comparison Snapshots: Vendor comparison matrices
CREATE TABLE comparison_snapshots (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL,
  title TEXT NOT NULL,
  comparison_type TEXT NOT NULL, -- 'full', 'technical', 'cost', 'security', 'custom'
  vendor_ids TEXT[] NOT NULL,
  comparison_data JSONB NOT NULL,
  highlights JSONB,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Executive Briefings: AI-generated executive summaries
CREATE TABLE executive_briefings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL,
  stakeholder_role TEXT NOT NULL, -- 'CEO', 'CTO', 'CFO', 'CISO', 'COO'
  briefing_type TEXT NOT NULL, -- 'summary', 'recommendation', 'risk_analysis'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  key_findings JSONB,
  recommendations JSONB,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Follow-up Questions: AI-generated vendor questions
CREATE TABLE followup_questions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL,
  proposal_id VARCHAR NOT NULL,
  category TEXT NOT NULL, -- 'technical', 'delivery', 'cost', 'compliance', 'clarification'
  priority TEXT NOT NULL, -- 'critical', 'high', 'medium', 'low'
  question TEXT NOT NULL,
  context TEXT,
  related_section TEXT,
  ai_rationale TEXT,
  is_answered TEXT NOT NULL DEFAULT 'false',
  answer TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- RFT Generation & Templates
-- ============================================

-- Business Cases: Project business case documents
CREATE TABLE business_cases (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id VARCHAR NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  document_content TEXT,
  extracted_data JSONB,
  rag_document_id VARCHAR,
  status TEXT NOT NULL DEFAULT 'uploaded', -- 'uploaded', 'analyzed', 'processed'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RFT Templates: System-provided RFT templates
CREATE TABLE rft_templates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL, -- 'IT', 'Aviation', 'Infrastructure', 'Professional Services', 'Custom'
  sections JSONB NOT NULL,
  metadata JSONB,
  is_active TEXT NOT NULL DEFAULT 'true',
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Organization Templates: User-uploaded organization templates
CREATE TABLE organization_templates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL, -- 'RFT', 'RFI', 'RFP', 'Custom'
  template_type TEXT NOT NULL DEFAULT 'docx', -- 'docx', 'xlsx'
  blob_url TEXT NOT NULL, -- DEPRECATED - use blob_name
  blob_name TEXT, -- Azure Blob Storage object path
  placeholders JSONB NOT NULL, -- Detected placeholders
  section_mappings JSONB, -- Stakeholder section assignments
  is_active TEXT NOT NULL DEFAULT 'true',
  is_default TEXT NOT NULL DEFAULT 'false',
  metadata JSONB,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Generated RFTs: AI-generated RFT documents with questionnaires
CREATE TABLE generated_rfts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL,
  business_case_id VARCHAR NOT NULL,
  template_id VARCHAR NOT NULL,
  name TEXT NOT NULL,
  sections JSONB NOT NULL,
  -- Local paths (DEPRECATED)
  product_questionnaire_path TEXT,
  nfr_questionnaire_path TEXT,
  cybersecurity_questionnaire_path TEXT,
  agile_questionnaire_path TEXT,
  procurement_questionnaire_path TEXT,
  -- Azure Blob URLs (DEPRECATED - use blob_name fields)
  docx_blob_url TEXT,
  pdf_blob_url TEXT,
  product_questionnaire_blob_url TEXT,
  nfr_questionnaire_blob_url TEXT,
  cybersecurity_questionnaire_blob_url TEXT,
  agile_questionnaire_blob_url TEXT,
  procurement_questionnaire_blob_url TEXT,
  -- Azure Blob Storage paths (CURRENT)
  docx_blob_name TEXT,
  pdf_blob_name TEXT,
  product_questionnaire_blob_name TEXT,
  nfr_questionnaire_blob_name TEXT,
  cybersecurity_questionnaire_blob_name TEXT,
  agile_questionnaire_blob_name TEXT,
  procurement_questionnaire_blob_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'review', 'published', 'archived'
  version INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RFT Generation Drafts: Collaborative RFT editing with stakeholder approvals
CREATE TABLE rft_generation_drafts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL,
  business_case_id VARCHAR NOT NULL,
  template_id VARCHAR,
  generation_mode TEXT NOT NULL, -- 'ai_generation' or 'template_merge'
  generated_sections JSONB NOT NULL, -- Sections with stakeholder assignments and approval status
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'in_review', 'approved', 'finalized'
  approval_progress JSONB, -- {totalSections: 10, approvedSections: 3, pendingSections: 7}
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes (defined in azure-database-indexes.sql)
-- See azure-database-indexes.sql for index creation statements

COMMENT ON TABLE portfolios IS 'Top-level project grouping';
COMMENT ON TABLE standards IS 'Organizational standards and compliance documents';
COMMENT ON TABLE projects IS 'Individual RFT evaluation projects';
COMMENT ON TABLE proposals IS 'Vendor proposal documents with atomic duplicate prevention';
COMMENT ON TABLE evaluations IS 'Multi-agent vendor proposal evaluations with 1:1 proposal mapping';
COMMENT ON TABLE agent_metrics IS 'Performance tracking for AI agents';
COMMENT ON TABLE rag_documents IS 'Document registry for knowledge base';
COMMENT ON TABLE business_cases IS 'Project business case documents';
COMMENT ON TABLE generated_rfts IS 'AI-generated RFT documents with questionnaires';
COMMENT ON TABLE rft_generation_drafts IS 'Collaborative RFT editing with stakeholder approvals';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✓ IntelliBid database schema created successfully!';
    RAISE NOTICE '✓ 24 tables created with complete schema';
    RAISE NOTICE '';
    RAISE NOTICE 'Key Features:';
    RAISE NOTICE '  • Atomic duplicate prevention (proposals, evaluations)';
    RAISE NOTICE '  • Complete column set for all tables';
    RAISE NOTICE '  • Category-based RAG organization';
    RAISE NOTICE '  • New blob_name fields for Azure Blob Storage';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Run azure-database-indexes.sql for performance indexes';
    RAISE NOTICE '  2. Run azure-database-seed.sql to insert sample data';
    RAISE NOTICE '  3. Configure Azure credentials via Admin Config page';
END $$;
