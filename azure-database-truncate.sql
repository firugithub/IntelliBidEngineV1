-- ====================================================
-- IntelliBid Database Truncate Script for Azure PostgreSQL
-- ====================================================
-- WARNING: This script will DELETE ALL DATA from all tables
-- Use this for development/testing only, NOT in production
-- The database schema (tables, columns) will remain intact
-- Updated: November 13, 2025
-- ====================================================

-- Disable foreign key checks temporarily (PostgreSQL doesn't support this directly)
-- Instead, we use TRUNCATE with CASCADE which handles dependencies

BEGIN;

-- Show warning
DO $$
BEGIN
    RAISE NOTICE '⚠️  WARNING: About to truncate ALL tables in IntelliBid database';
    RAISE NOTICE '⚠️  All data will be permanently deleted!';
    RAISE NOTICE '⚠️  Database schema will remain intact';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables to be truncated:';
    RAISE NOTICE '  • Core: portfolios, projects, system_config';
    RAISE NOTICE '  • RFT Generation: business_cases, rft_templates, organization_templates';
    RAISE NOTICE '  •                 rft_generation_drafts, generated_rfts';
    RAISE NOTICE '  • Evaluation: requirements, proposals, evaluations, evaluation_criteria';
    RAISE NOTICE '  •             vendor_shortlisting_stages, agent_metrics';
    RAISE NOTICE '  • AI Features: compliance_gaps, followup_questions, comparison_snapshots';
    RAISE NOTICE '  •              executive_briefings';
    RAISE NOTICE '  • Knowledge Base: standards, rag_documents, rag_chunks';
    RAISE NOTICE '  • Chat: chat_sessions, chat_messages';
    RAISE NOTICE '  • Integration: mcp_connectors';
    RAISE NOTICE '';
END $$;

-- ====================================================
-- TRUNCATE ALL TABLES
-- ====================================================
-- Using CASCADE to automatically handle foreign key dependencies
-- Tables are listed in logical order for clarity

-- Core tables
TRUNCATE TABLE portfolios CASCADE;
TRUNCATE TABLE projects CASCADE;
TRUNCATE TABLE system_config CASCADE;

-- Business case & RFT generation tables
TRUNCATE TABLE business_cases CASCADE;
TRUNCATE TABLE rft_templates CASCADE;
TRUNCATE TABLE organization_templates CASCADE;
TRUNCATE TABLE rft_generation_drafts CASCADE;
TRUNCATE TABLE generated_rfts CASCADE;

-- Vendor evaluation tables
TRUNCATE TABLE requirements CASCADE;
TRUNCATE TABLE proposals CASCADE;
TRUNCATE TABLE evaluations CASCADE;
TRUNCATE TABLE evaluation_criteria CASCADE;
TRUNCATE TABLE vendor_shortlisting_stages CASCADE;
TRUNCATE TABLE agent_metrics CASCADE;

-- Advanced AI features
TRUNCATE TABLE compliance_gaps CASCADE;
TRUNCATE TABLE followup_questions CASCADE;
TRUNCATE TABLE comparison_snapshots CASCADE;
TRUNCATE TABLE executive_briefings CASCADE;

-- Knowledge base & RAG
TRUNCATE TABLE standards CASCADE;
TRUNCATE TABLE rag_documents CASCADE;
TRUNCATE TABLE rag_chunks CASCADE;

-- Chatbot & integrations
TRUNCATE TABLE chat_sessions CASCADE;
TRUNCATE TABLE chat_messages CASCADE;
TRUNCATE TABLE mcp_connectors CASCADE;

-- ====================================================
-- RESET SEQUENCES (for tables using SERIAL/IDENTITY)
-- ====================================================
-- Note: IntelliBid uses VARCHAR UUID primary keys, not SERIAL
-- This section is here for reference if you add SERIAL columns in future

-- Example for future use:
-- ALTER SEQUENCE table_name_id_seq RESTART WITH 1;

-- ====================================================
-- SUCCESS MESSAGE
-- ====================================================

DO $$
DECLARE
    total_tables INTEGER := 24;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ All tables truncated successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Summary:';
    RAISE NOTICE '  • Tables truncated: %', total_tables;
    RAISE NOTICE '  • All data deleted';
    RAISE NOTICE '  • Schema intact (tables, columns, indexes preserved)';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Next Steps:';
    RAISE NOTICE '  1. Optionally run azure-database-seed.sql to restore default data';
    RAISE NOTICE '  2. Or start fresh with empty database';
    RAISE NOTICE '  3. Restart your application to verify clean state';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Database ready for fresh data!';
END $$;

COMMIT;
