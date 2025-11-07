-- ====================================================
-- IntelliBid Database Indexes for Azure PostgreSQL
-- ====================================================
-- Performance indexes for production deployment
-- Run this AFTER azure-database-setup.sql
-- ====================================================

-- ====================================================
-- FOREIGN KEY INDEXES (for join performance)
-- ====================================================

-- Projects
CREATE INDEX IF NOT EXISTS idx_projects_portfolio_id ON projects(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_projects_business_case_id ON projects(business_case_id);
CREATE INDEX IF NOT EXISTS idx_projects_generated_rft_id ON projects(generated_rft_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Business Cases
CREATE INDEX IF NOT EXISTS idx_business_cases_portfolio_id ON business_cases(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_business_cases_status ON business_cases(status);

-- Generated RFTs
CREATE INDEX IF NOT EXISTS idx_generated_rfts_project_id ON generated_rfts(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_rfts_business_case_id ON generated_rfts(business_case_id);
CREATE INDEX IF NOT EXISTS idx_generated_rfts_template_id ON generated_rfts(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_rfts_status ON generated_rfts(status);

-- Requirements
CREATE INDEX IF NOT EXISTS idx_requirements_project_id ON requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_requirements_standard_id ON requirements(standard_id);

-- Proposals
CREATE INDEX IF NOT EXISTS idx_proposals_project_id ON proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_proposals_vendor_name ON proposals(vendor_name);

-- Evaluations
CREATE INDEX IF NOT EXISTS idx_evaluations_project_id ON evaluations(project_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_proposal_id ON evaluations(proposal_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);
CREATE INDEX IF NOT EXISTS idx_evaluations_overall_score ON evaluations(overall_score DESC);

-- Evaluation Criteria
CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_evaluation_id ON evaluation_criteria(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_role ON evaluation_criteria(role);

-- Compliance Gaps
CREATE INDEX IF NOT EXISTS idx_compliance_gaps_project_id ON compliance_gaps(project_id);
CREATE INDEX IF NOT EXISTS idx_compliance_gaps_proposal_id ON compliance_gaps(proposal_id);
CREATE INDEX IF NOT EXISTS idx_compliance_gaps_severity ON compliance_gaps(severity);
CREATE INDEX IF NOT EXISTS idx_compliance_gaps_is_resolved ON compliance_gaps(is_resolved);

-- Follow-up Questions
CREATE INDEX IF NOT EXISTS idx_followup_questions_project_id ON followup_questions(project_id);
CREATE INDEX IF NOT EXISTS idx_followup_questions_proposal_id ON followup_questions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_followup_questions_priority ON followup_questions(priority);
CREATE INDEX IF NOT EXISTS idx_followup_questions_is_answered ON followup_questions(is_answered);

-- Comparison Snapshots
CREATE INDEX IF NOT EXISTS idx_comparison_snapshots_project_id ON comparison_snapshots(project_id);

-- Executive Briefings
CREATE INDEX IF NOT EXISTS idx_executive_briefings_project_id ON executive_briefings(project_id);
CREATE INDEX IF NOT EXISTS idx_executive_briefings_stakeholder_role ON executive_briefings(stakeholder_role);

-- ====================================================
-- RAG SYSTEM INDEXES
-- ====================================================

-- RAG Documents
CREATE INDEX IF NOT EXISTS idx_rag_documents_source_type ON rag_documents(source_type);
CREATE INDEX IF NOT EXISTS idx_rag_documents_source_id ON rag_documents(source_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON rag_documents(status);
CREATE INDEX IF NOT EXISTS idx_rag_documents_index_name ON rag_documents(index_name);

-- RAG Chunks
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id ON rag_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_chunk_index ON rag_chunks(chunk_index);

-- Standards
CREATE INDEX IF NOT EXISTS idx_standards_category ON standards(category);
CREATE INDEX IF NOT EXISTS idx_standards_is_active ON standards(is_active);

-- ====================================================
-- CHATBOT INDEXES
-- ====================================================

-- Chat Sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_id ON chat_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);

-- Chat Messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON chat_messages(role);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- ====================================================
-- SYSTEM INDEXES
-- ====================================================

-- System Config
CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);

-- MCP Connectors
CREATE INDEX IF NOT EXISTS idx_mcp_connectors_is_active ON mcp_connectors(is_active);

-- RFT Templates
CREATE INDEX IF NOT EXISTS idx_rft_templates_category ON rft_templates(category);
CREATE INDEX IF NOT EXISTS idx_rft_templates_is_active ON rft_templates(is_active);

-- ====================================================
-- COMPOSITE INDEXES (for complex queries)
-- ====================================================

-- Projects: Portfolio + Status
CREATE INDEX IF NOT EXISTS idx_projects_portfolio_status ON projects(portfolio_id, status);

-- Evaluations: Project + Status
CREATE INDEX IF NOT EXISTS idx_evaluations_project_status ON evaluations(project_id, status);

-- Proposals: Project + Vendor
CREATE INDEX IF NOT EXISTS idx_proposals_project_vendor ON proposals(project_id, vendor_name);

-- RAG Documents: Source Type + Status
CREATE INDEX IF NOT EXISTS idx_rag_documents_source_status ON rag_documents(source_type, status);

-- ====================================================
-- SUCCESS MESSAGE
-- ====================================================

DO $$
BEGIN
    RAISE NOTICE '✓ Performance indexes created successfully!';
    RAISE NOTICE '✓ Total indexes: 50+';
    RAISE NOTICE 'Index categories:';
    RAISE NOTICE '  - Foreign key indexes for joins';
    RAISE NOTICE '  - Status/filter indexes for queries';
    RAISE NOTICE '  - Composite indexes for complex queries';
    RAISE NOTICE '  - RAG system indexes for vector search';
END $$;
