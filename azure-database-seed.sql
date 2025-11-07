-- ====================================================
-- IntelliBid Database Seed Data for Azure PostgreSQL
-- ====================================================
-- Initial data setup for production deployment
-- Run this AFTER azure-database-setup.sql and azure-database-indexes.sql
-- ====================================================

-- ====================================================
-- DEFAULT PORTFOLIOS
-- ====================================================
-- Aviation industry portfolios

INSERT INTO portfolios (name, description) VALUES
    ('Passenger Services', 'Customer-facing services including booking, check-in, and loyalty programs'),
    ('Flight Operations', 'Core flight operations including crew management, scheduling, and safety systems'),
    ('Aircraft Maintenance', 'Maintenance, repair, and overhaul (MRO) systems and tracking'),
    ('Cargo & Logistics', 'Freight management, logistics, and cargo tracking systems'),
    ('Ground Operations', 'Airport ground handling, baggage, and gate management'),
    ('Enterprise IT', 'Core IT infrastructure, security, and enterprise applications')
ON CONFLICT (name) DO NOTHING;

-- ====================================================
-- DEFAULT RFT TEMPLATES
-- ====================================================
-- Industry-standard RFT templates

INSERT INTO rft_templates (name, description, category, sections, metadata) VALUES
    (
        'Aviation IT Systems - Standard',
        'Standard template for aviation IT system procurement',
        'Aviation',
        '{
            "sections": [
                {
                    "id": "intro",
                    "title": "Introduction & Background",
                    "order": 1,
                    "prompts": ["Provide project context", "Define business objectives", "Explain current state"]
                },
                {
                    "id": "scope",
                    "title": "Scope of Work",
                    "order": 2,
                    "prompts": ["Define deliverables", "Specify technical requirements", "List integration points"]
                },
                {
                    "id": "evaluation",
                    "title": "Evaluation Criteria",
                    "order": 3,
                    "prompts": ["Technical fit (40%)", "Cost (25%)", "Delivery capability (20%)", "Compliance (15%)"]
                },
                {
                    "id": "commercial",
                    "title": "Commercial Terms",
                    "order": 4,
                    "prompts": ["Pricing model", "Payment terms", "SLA requirements"]
                },
                {
                    "id": "compliance",
                    "title": "Compliance & Security",
                    "order": 5,
                    "prompts": ["GDPR compliance", "ISO certifications", "Security standards"]
                }
            ]
        }',
        '{"industry": "aviation", "complexity": "medium", "tags": ["IT", "systems", "procurement"]}'
    ),
    (
        'Cloud Infrastructure - Standard',
        'Template for cloud infrastructure and platform procurement',
        'IT',
        '{
            "sections": [
                {
                    "id": "intro",
                    "title": "Introduction & Overview",
                    "order": 1,
                    "prompts": ["Define cloud strategy", "Current infrastructure state", "Migration objectives"]
                },
                {
                    "id": "technical",
                    "title": "Technical Requirements",
                    "order": 2,
                    "prompts": ["Compute requirements", "Storage needs", "Network architecture", "Scalability"]
                },
                {
                    "id": "security",
                    "title": "Security & Compliance",
                    "order": 3,
                    "prompts": ["Data protection", "Access control", "Compliance certifications", "Audit trails"]
                },
                {
                    "id": "sla",
                    "title": "Service Level Agreements",
                    "order": 4,
                    "prompts": ["Uptime requirements", "Performance metrics", "Support response times"]
                },
                {
                    "id": "commercial",
                    "title": "Commercial Model",
                    "order": 5,
                    "prompts": ["Pricing structure", "Cost optimization", "Contract terms"]
                }
            ]
        }',
        '{"industry": "IT", "complexity": "high", "tags": ["cloud", "infrastructure", "platform"]}'
    ),
    (
        'Professional Services - Standard',
        'Template for professional services and consulting engagements',
        'Professional Services',
        '{
            "sections": [
                {
                    "id": "intro",
                    "title": "Engagement Overview",
                    "order": 1,
                    "prompts": ["Define engagement scope", "Business challenges", "Expected outcomes"]
                },
                {
                    "id": "deliverables",
                    "title": "Deliverables & Timeline",
                    "order": 2,
                    "prompts": ["Key deliverables", "Project milestones", "Timeline expectations"]
                },
                {
                    "id": "team",
                    "title": "Team Requirements",
                    "order": 3,
                    "prompts": ["Required expertise", "Team composition", "Key roles"]
                },
                {
                    "id": "methodology",
                    "title": "Delivery Methodology",
                    "order": 4,
                    "prompts": ["Project approach", "Communication plan", "Quality assurance"]
                },
                {
                    "id": "commercial",
                    "title": "Commercial Terms",
                    "order": 5,
                    "prompts": ["Rate card", "Payment milestones", "Change management"]
                }
            ]
        }',
        '{"industry": "general", "complexity": "low", "tags": ["consulting", "services", "advisory"]}'
    )
ON CONFLICT (name) DO NOTHING;

-- ====================================================
-- SYSTEM CONFIGURATION PLACEHOLDERS
-- ====================================================
-- These will be configured through the Admin Config UI

INSERT INTO system_config (category, key, value, description) VALUES
    ('azure_storage', 'AZURE_STORAGE_CONNECTION_STRING', NULL, 'Azure Blob Storage connection string for document storage'),
    ('azure_search', 'AZURE_SEARCH_ENDPOINT', NULL, 'Azure AI Search endpoint URL'),
    ('azure_search', 'AZURE_SEARCH_KEY', NULL, 'Azure AI Search admin key'),
    ('azure_openai', 'AZURE_OPENAI_ENDPOINT', NULL, 'Azure OpenAI endpoint URL'),
    ('azure_openai', 'AZURE_OPENAI_KEY', NULL, 'Azure OpenAI API key'),
    ('azure_openai', 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT', NULL, 'Azure OpenAI embedding deployment name (e.g., text-embedding-3-small)'),
    ('rag_settings', 'RAG_CHUNK_SIZE', '1000', 'Default chunk size for document splitting (tokens)'),
    ('rag_settings', 'RAG_CHUNK_OVERLAP', '200', 'Overlap between chunks (tokens)'),
    ('rag_settings', 'RAG_TOP_K', '5', 'Number of top results to retrieve from RAG')
ON CONFLICT (key) DO NOTHING;

-- ====================================================
-- DEFAULT COMPLIANCE STANDARDS (Optional)
-- ====================================================
-- Example standards for demo purposes

INSERT INTO standards (name, description, category, sections, tags) VALUES
    (
        'IATA Operational Safety Audit (IOSA)',
        'International Air Transport Association operational safety standards',
        'security',
        '[
            {"title": "Organization and Management System", "requirements": ["Safety management", "Quality assurance", "Document control"]},
            {"title": "Flight Operations", "requirements": ["Flight crew training", "Operational procedures", "Emergency procedures"]},
            {"title": "Aircraft Engineering and Maintenance", "requirements": ["Maintenance program", "Quality control", "Continuing airworthiness"]}
        ]',
        ARRAY['aviation', 'safety', 'IATA', 'compliance']
    ),
    (
        'ISO 27001 Information Security',
        'Information security management system standard',
        'security',
        '[
            {"title": "Information Security Policies", "requirements": ["Security policy document", "Review process"]},
            {"title": "Access Control", "requirements": ["User access management", "Privilege management", "Authentication"]},
            {"title": "Cryptography", "requirements": ["Encryption standards", "Key management"]},
            {"title": "Incident Management", "requirements": ["Incident response", "Logging", "Monitoring"]}
        ]',
        ARRAY['security', 'ISO', 'information-security', 'compliance']
    ),
    (
        'GDPR Data Protection',
        'General Data Protection Regulation compliance requirements',
        'security',
        '[
            {"title": "Data Protection Principles", "requirements": ["Lawfulness", "Purpose limitation", "Data minimization"]},
            {"title": "Rights of Data Subjects", "requirements": ["Right to access", "Right to erasure", "Right to portability"]},
            {"title": "Data Security", "requirements": ["Encryption", "Pseudonymization", "Access controls"]},
            {"title": "Data Breach Notification", "requirements": ["72-hour notification", "Documentation", "Communication"]}
        ]',
        ARRAY['privacy', 'GDPR', 'data-protection', 'compliance']
    )
ON CONFLICT DO NOTHING;

-- ====================================================
-- SUCCESS MESSAGE
-- ====================================================

DO $$
DECLARE
    portfolio_count INTEGER;
    template_count INTEGER;
    config_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO portfolio_count FROM portfolios;
    SELECT COUNT(*) INTO template_count FROM rft_templates;
    SELECT COUNT(*) INTO config_count FROM system_config;
    
    RAISE NOTICE '✓ Seed data inserted successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  - Portfolios: % (Aviation industry defaults)', portfolio_count;
    RAISE NOTICE '  - RFT Templates: % (Standard templates)', template_count;
    RAISE NOTICE '  - System Config: % entries (awaiting Azure credentials)', config_count;
    RAISE NOTICE '  - Compliance Standards: 3 (IOSA, ISO 27001, GDPR)';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Configure Azure credentials in Admin Config page';
    RAISE NOTICE '  2. Test database connection from application';
    RAISE NOTICE '  3. Upload additional compliance standards if needed';
END $$;
