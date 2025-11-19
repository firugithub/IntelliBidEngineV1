-- ====================================================
-- IntelliBid Database Seed Data for Azure PostgreSQL
-- ====================================================
-- Initial data setup for production deployment
-- Run this AFTER azure-database-setup.sql
-- Updated: November 19, 2025
-- ====================================================

-- ====================================================
-- DEFAULT PORTFOLIOS
-- ====================================================
-- Aviation industry portfolios for Nujum Air

INSERT INTO portfolios (name, description) VALUES
    ('Passenger Services', 'Customer-facing services including booking, check-in, loyalty programs, and passenger experience systems'),
    ('Flight Operations', 'Core flight operations including crew management, scheduling, flight planning, and safety systems'),
    ('Aircraft Maintenance', 'Maintenance, repair, and overhaul (MRO) systems, tracking, and aircraft engineering'),
    ('Cargo & Logistics', 'Freight management, logistics, cargo tracking, and supply chain systems'),
    ('Ground Operations', 'Airport ground handling, baggage handling, gate management, and ground services'),
    ('Enterprise IT', 'Core IT infrastructure, security, cloud platforms, and enterprise applications'),
    ('Revenue Management', 'Pricing optimization, inventory control, ancillary revenue, and financial systems'),
    ('Digital Innovation', 'Mobile apps, digital transformation, AI/ML initiatives, and emerging technologies')
ON CONFLICT (name) DO NOTHING;

-- ====================================================
-- AI RFT TEMPLATES
-- ====================================================
-- Industry-standard AI-generated RFT templates

INSERT INTO rft_templates (name, description, category, sections, metadata) VALUES
    (
        'Aviation IT Systems - Comprehensive',
        'Comprehensive template for large-scale aviation IT system procurement with full stakeholder coverage',
        'Aviation',
        '{
            "sections": [
                {
                    "id": "executive_summary",
                    "title": "Executive Summary",
                    "order": 1,
                    "category": "business",
                    "assignedTo": "Business Analyst",
                    "prompts": ["Project overview", "Strategic objectives", "Expected business value"]
                },
                {
                    "id": "background",
                    "title": "Background & Context",
                    "order": 2,
                    "category": "business",
                    "assignedTo": "Business Analyst",
                    "prompts": ["Current state analysis", "Business challenges", "Market context"]
                },
                {
                    "id": "scope",
                    "title": "Scope of Work",
                    "order": 3,
                    "category": "business",
                    "assignedTo": "Technical PM",
                    "prompts": ["In-scope deliverables", "Out-of-scope items", "Assumptions and constraints"]
                },
                {
                    "id": "functional_requirements",
                    "title": "Functional Requirements",
                    "order": 4,
                    "category": "technical",
                    "assignedTo": "Solutions Architect",
                    "prompts": ["Core functionality", "User workflows", "Integration requirements"]
                },
                {
                    "id": "technical_requirements",
                    "title": "Technical Requirements",
                    "order": 5,
                    "category": "technical",
                    "assignedTo": "Solutions Architect",
                    "prompts": ["Architecture patterns", "Technology stack", "Performance requirements"]
                },
                {
                    "id": "security_compliance",
                    "title": "Security & Compliance",
                    "order": 6,
                    "category": "security",
                    "assignedTo": "Security Architect",
                    "prompts": ["Security standards", "Data protection", "Compliance requirements"]
                },
                {
                    "id": "evaluation_criteria",
                    "title": "Evaluation Criteria",
                    "order": 7,
                    "category": "procurement",
                    "assignedTo": "Procurement Lead",
                    "prompts": ["Technical fit (35%)", "Cost (25%)", "Delivery (20%)", "Compliance (20%)"]
                },
                {
                    "id": "commercial_terms",
                    "title": "Commercial Terms",
                    "order": 8,
                    "category": "procurement",
                    "assignedTo": "Procurement Lead",
                    "prompts": ["Pricing model", "Payment terms", "SLA requirements", "Warranties"]
                },
                {
                    "id": "project_timeline",
                    "title": "Project Timeline",
                    "order": 9,
                    "category": "business",
                    "assignedTo": "Technical PM",
                    "prompts": ["Key milestones", "Delivery schedule", "Go-live date"]
                }
            ]
        }',
        '{"industry": "aviation", "complexity": "high", "tags": ["IT", "systems", "procurement", "comprehensive"], "stakeholders": ["Business Analyst", "Technical PM", "Solutions Architect", "Security Architect", "Procurement Lead"]}'
    ),
    (
        'Cloud Infrastructure - Enterprise',
        'Enterprise-grade cloud infrastructure and platform procurement template',
        'IT',
        '{
            "sections": [
                {
                    "id": "introduction",
                    "title": "Introduction & Strategy",
                    "order": 1,
                    "category": "business",
                    "assignedTo": "Business Analyst",
                    "prompts": ["Cloud strategy overview", "Business drivers", "Strategic alignment"]
                },
                {
                    "id": "current_state",
                    "title": "Current State Assessment",
                    "order": 2,
                    "category": "technical",
                    "assignedTo": "Solutions Architect",
                    "prompts": ["Existing infrastructure", "Pain points", "Migration drivers"]
                },
                {
                    "id": "technical_specs",
                    "title": "Technical Specifications",
                    "order": 3,
                    "category": "technical",
                    "assignedTo": "Solutions Architect",
                    "prompts": ["Compute requirements", "Storage needs", "Network architecture", "Scalability", "High availability"]
                },
                {
                    "id": "security",
                    "title": "Security & Compliance",
                    "order": 4,
                    "category": "security",
                    "assignedTo": "Security Architect",
                    "prompts": ["Data protection", "Access control", "Encryption", "Compliance certifications", "Audit requirements"]
                },
                {
                    "id": "migration_plan",
                    "title": "Migration Approach",
                    "order": 5,
                    "category": "technical",
                    "assignedTo": "Technical PM",
                    "prompts": ["Migration strategy", "Phased approach", "Rollback procedures", "Data migration"]
                },
                {
                    "id": "sla",
                    "title": "Service Level Agreements",
                    "order": 6,
                    "category": "procurement",
                    "assignedTo": "Procurement Lead",
                    "prompts": ["Uptime requirements (99.95%+)", "Performance metrics", "Support response times", "Penalties"]
                },
                {
                    "id": "commercial",
                    "title": "Commercial Model",
                    "order": 7,
                    "category": "procurement",
                    "assignedTo": "Procurement Lead",
                    "prompts": ["Pricing structure", "Cost optimization", "Volume discounts", "Contract terms"]
                }
            ]
        }',
        '{"industry": "IT", "complexity": "high", "tags": ["cloud", "infrastructure", "platform", "migration"], "stakeholders": ["Business Analyst", "Technical PM", "Solutions Architect", "Security Architect", "Procurement Lead"]}'
    ),
    (
        'Professional Services - Consulting',
        'Standard template for professional services and consulting engagements',
        'Professional Services',
        '{
            "sections": [
                {
                    "id": "engagement_overview",
                    "title": "Engagement Overview",
                    "order": 1,
                    "category": "business",
                    "assignedTo": "Business Analyst",
                    "prompts": ["Engagement scope", "Business challenges", "Expected outcomes", "Success criteria"]
                },
                {
                    "id": "deliverables",
                    "title": "Deliverables & Milestones",
                    "order": 2,
                    "category": "business",
                    "assignedTo": "Technical PM",
                    "prompts": ["Key deliverables", "Timeline", "Acceptance criteria", "Quality standards"]
                },
                {
                    "id": "team_requirements",
                    "title": "Team & Expertise",
                    "order": 3,
                    "category": "other",
                    "assignedTo": "Technical PM",
                    "prompts": ["Required skills", "Team composition", "Experience levels", "Certifications"]
                },
                {
                    "id": "methodology",
                    "title": "Delivery Methodology",
                    "order": 4,
                    "category": "other",
                    "assignedTo": "Technical PM",
                    "prompts": ["Project approach", "Communication plan", "Quality assurance", "Risk management"]
                },
                {
                    "id": "commercial_terms",
                    "title": "Commercial Terms",
                    "order": 5,
                    "category": "procurement",
                    "assignedTo": "Procurement Lead",
                    "prompts": ["Rate cards", "Payment milestones", "Expenses policy", "Change management"]
                }
            ]
        }',
        '{"industry": "general", "complexity": "medium", "tags": ["consulting", "services", "advisory"], "stakeholders": ["Business Analyst", "Technical PM", "Procurement Lead"]}'
    ),
    (
        'SaaS Application - Standard',
        'Template for SaaS application procurement and evaluation',
        'IT',
        '{
            "sections": [
                {
                    "id": "business_case",
                    "title": "Business Case",
                    "order": 1,
                    "category": "business",
                    "assignedTo": "Business Analyst",
                    "prompts": ["Business need", "ROI analysis", "User base", "Current pain points"]
                },
                {
                    "id": "functional_features",
                    "title": "Functional Features",
                    "order": 2,
                    "category": "technical",
                    "assignedTo": "Business Analyst",
                    "prompts": ["Core features", "User experience", "Integrations", "Customization"]
                },
                {
                    "id": "technical_architecture",
                    "title": "Technical Architecture",
                    "order": 3,
                    "category": "technical",
                    "assignedTo": "Solutions Architect",
                    "prompts": ["Platform architecture", "APIs", "Data model", "Performance", "Scalability"]
                },
                {
                    "id": "data_security",
                    "title": "Data Security & Privacy",
                    "order": 4,
                    "category": "security",
                    "assignedTo": "Security Architect",
                    "prompts": ["Data encryption", "Access controls", "GDPR compliance", "SOC 2 certification"]
                },
                {
                    "id": "pricing",
                    "title": "Pricing & Licensing",
                    "order": 5,
                    "category": "procurement",
                    "assignedTo": "Procurement Lead",
                    "prompts": ["Subscription model", "User licensing", "Add-ons", "Annual vs monthly"]
                }
            ]
        }',
        '{"industry": "IT", "complexity": "medium", "tags": ["SaaS", "application", "cloud"], "stakeholders": ["Business Analyst", "Solutions Architect", "Security Architect", "Procurement Lead"]}'
    )
ON CONFLICT (name) DO NOTHING;

-- ====================================================
-- SYSTEM CONFIGURATION PLACEHOLDERS
-- ====================================================
-- These will be configured through the Admin Config UI or environment variables

INSERT INTO system_config (category, key, value, description) VALUES
    ('azure_storage', 'AZURE_STORAGE_CONNECTION_STRING', NULL, 'Azure Blob Storage connection string for document storage'),
    ('azure_search', 'AZURE_SEARCH_ENDPOINT', NULL, 'Azure AI Search endpoint URL'),
    ('azure_search', 'AZURE_SEARCH_KEY', NULL, 'Azure AI Search admin key'),
    ('azure_openai', 'AZURE_OPENAI_ENDPOINT', NULL, 'Azure OpenAI endpoint URL'),
    ('azure_openai', 'AZURE_OPENAI_KEY', NULL, 'Azure OpenAI API key'),
    ('azure_openai', 'AZURE_OPENAI_DEPLOYMENT', NULL, 'Azure OpenAI GPT deployment name (e.g., gpt-4o)'),
    ('azure_openai', 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT', NULL, 'Azure OpenAI embedding deployment name (e.g., text-embedding-3-small)'),
    ('azure_openai', 'AZURE_OPENAI_API_VERSION', NULL, 'Azure OpenAI API version (e.g., 2024-08-01-preview)'),
    ('rag_settings', 'RAG_CHUNK_SIZE', '1000', 'Default chunk size for document splitting (tokens)'),
    ('rag_settings', 'RAG_CHUNK_OVERLAP', '200', 'Overlap between chunks (tokens)'),
    ('rag_settings', 'RAG_TOP_K', '5', 'Number of top results to retrieve from RAG'),
    ('ai_settings', 'OPENAI_API_KEY', NULL, 'OpenAI API key for general AI operations'),
    ('ai_settings', 'OPENAI_BASE_URL', NULL, 'Custom OpenAI base URL (optional)')
ON CONFLICT (key) DO NOTHING;

-- ====================================================
-- DEFAULT COMPLIANCE STANDARDS
-- ====================================================
-- Aviation and IT compliance standards for demo and production use

INSERT INTO standards (name, description, category, sections, tags) VALUES
    (
        'IATA Operational Safety Audit (IOSA)',
        'International Air Transport Association operational safety standards for airline operations',
        'security',
        '[
            {
                "title": "Organization and Management System",
                "requirements": [
                    "Safety management system implementation",
                    "Quality assurance program",
                    "Document and records control",
                    "Management and supervision accountability"
                ]
            },
            {
                "title": "Flight Operations",
                "requirements": [
                    "Flight crew training and qualification",
                    "Operational procedures and flight planning",
                    "Emergency procedures and equipment",
                    "Dangerous goods handling"
                ]
            },
            {
                "title": "Aircraft Engineering and Maintenance",
                "requirements": [
                    "Maintenance program management",
                    "Quality control and inspections",
                    "Continuing airworthiness monitoring",
                    "Engineering and maintenance records"
                ]
            },
            {
                "title": "Cabin Operations",
                "requirements": [
                    "Cabin crew training programs",
                    "Safety and emergency equipment",
                    "Passenger safety briefings",
                    "Security procedures"
                ]
            }
        ]',
        ARRAY['aviation', 'safety', 'IATA', 'compliance', 'IOSA']
    ),
    (
        'ISO 27001 Information Security',
        'International standard for information security management systems (ISMS)',
        'security',
        '[
            {
                "title": "Information Security Policies",
                "requirements": [
                    "Information security policy document",
                    "Review and update procedures",
                    "Management approval and communication"
                ]
            },
            {
                "title": "Access Control",
                "requirements": [
                    "User access management",
                    "Privilege management and review",
                    "Multi-factor authentication",
                    "Password management",
                    "Access removal procedures"
                ]
            },
            {
                "title": "Cryptography",
                "requirements": [
                    "Encryption standards (AES-256, TLS 1.3)",
                    "Key management procedures",
                    "Cryptographic controls for data at rest and in transit"
                ]
            },
            {
                "title": "Incident Management",
                "requirements": [
                    "Incident response procedures",
                    "Logging and monitoring",
                    "Evidence collection and preservation",
                    "Post-incident review"
                ]
            },
            {
                "title": "Business Continuity",
                "requirements": [
                    "Disaster recovery planning",
                    "Backup and restoration procedures",
                    "Redundancy and failover systems",
                    "Regular testing and drills"
                ]
            }
        ]',
        ARRAY['security', 'ISO', 'information-security', 'compliance', 'ISMS']
    ),
    (
        'GDPR Data Protection',
        'General Data Protection Regulation compliance requirements for EU data processing',
        'security',
        '[
            {
                "title": "Data Protection Principles",
                "requirements": [
                    "Lawfulness, fairness, transparency",
                    "Purpose limitation",
                    "Data minimization",
                    "Accuracy",
                    "Storage limitation",
                    "Integrity and confidentiality"
                ]
            },
            {
                "title": "Rights of Data Subjects",
                "requirements": [
                    "Right to access (Article 15)",
                    "Right to rectification (Article 16)",
                    "Right to erasure / right to be forgotten (Article 17)",
                    "Right to data portability (Article 20)",
                    "Right to object (Article 21)"
                ]
            },
            {
                "title": "Data Security Measures",
                "requirements": [
                    "Encryption of personal data",
                    "Pseudonymization techniques",
                    "Access controls and authentication",
                    "Regular security testing",
                    "Data breach procedures"
                ]
            },
            {
                "title": "Data Breach Notification",
                "requirements": [
                    "72-hour notification to supervisory authority",
                    "Documentation of breach details",
                    "Communication to affected data subjects",
                    "Breach register maintenance"
                ]
            },
            {
                "title": "Data Processing Agreements",
                "requirements": [
                    "Controller-processor agreements",
                    "Data processing impact assessments (DPIA)",
                    "Cross-border transfer mechanisms",
                    "Third-party vendor management"
                ]
            }
        ]',
        ARRAY['privacy', 'GDPR', 'data-protection', 'compliance', 'EU']
    ),
    (
        'PCI DSS Payment Card Security',
        'Payment Card Industry Data Security Standard for organizations handling card payments',
        'security',
        '[
            {
                "title": "Build and Maintain Secure Network",
                "requirements": [
                    "Install and maintain firewall configuration",
                    "Do not use vendor-supplied defaults",
                    "Network segmentation"
                ]
            },
            {
                "title": "Protect Cardholder Data",
                "requirements": [
                    "Protect stored cardholder data",
                    "Encrypt transmission of cardholder data",
                    "Strong cryptography (minimum 128-bit encryption)"
                ]
            },
            {
                "title": "Maintain Vulnerability Management",
                "requirements": [
                    "Use and regularly update anti-virus software",
                    "Develop and maintain secure systems",
                    "Regular vulnerability scans"
                ]
            },
            {
                "title": "Access Control Measures",
                "requirements": [
                    "Restrict access by business need-to-know",
                    "Assign unique ID to each person with access",
                    "Restrict physical access to cardholder data"
                ]
            }
        ]',
        ARRAY['payment', 'PCI', 'security', 'compliance', 'financial']
    )
ON CONFLICT DO NOTHING;

-- ====================================================
-- ORGANIZATION TEMPLATES (Sample - Optional)
-- ====================================================
-- IMPORTANT: These templates are DISABLED by default because they require
-- actual DOCX files in Azure Blob Storage. 
-- 
-- TO ENABLE: 
--   1. Upload DOCX files to Azure Blob Storage
--   2. Update the blob_url values below with actual URLs
--   3. Uncomment the INSERT statement
--
-- RECOMMENDED: Upload templates via Template Management UI instead
-- This ensures files are properly uploaded to blob storage automatically

/*
INSERT INTO organization_templates (
    name,
    description,
    category,
    template_type,
    blob_url,
    placeholders,
    section_mappings,
    is_active,
    is_default,
    metadata,
    created_by
) VALUES
    (
        'Nujum Air Standard RFT Template',
        'Official Nujum Air template for Request for Tender (RFT) procurement processes',
        'RFT',
        'docx',
        'https://your-storage-account.blob.core.windows.net/organization-templates/nujum-air-rft-template.docx',
        '[
            {"name": "PROJECT_NAME", "type": "simple", "description": "Name of the project"},
            {"name": "AIRLINE_NAME", "type": "simple", "description": "Name of the airline"},
            {"name": "DESCRIPTION", "type": "simple", "description": "Project description and business objective"},
            {"name": "BUDGET", "type": "simple", "description": "Project budget"},
            {"name": "TIMELINE", "type": "simple", "description": "Expected project timeline"},
            {"name": "FUNCTIONAL_REQUIREMENTS", "type": "simple", "description": "Functional requirements"},
            {"name": "NON_FUNCTIONAL_REQUIREMENTS", "type": "simple", "description": "Non-functional requirements"},
            {"name": "REQUIREMENTS", "type": "simple", "description": "Combined requirements"},
            {"name": "DEADLINE", "type": "simple", "description": "Submission deadline"}
        ]',
        '[
            {
                "sectionId": "executive-summary",
                "sectionTitle": "Executive Summary",
                "order": 1,
                "category": "business",
                "assignedTo": "Business Analyst",
                "content": ""
            },
            {
                "sectionId": "background",
                "sectionTitle": "Background & Context",
                "order": 2,
                "category": "business",
                "assignedTo": "Business Analyst",
                "content": ""
            },
            {
                "sectionId": "scope",
                "sectionTitle": "Scope of Work",
                "order": 3,
                "category": "business",
                "assignedTo": "Technical PM",
                "content": ""
            },
            {
                "sectionId": "requirements",
                "sectionTitle": "Requirements",
                "order": 4,
                "category": "technical",
                "assignedTo": "Solutions Architect",
                "content": ""
            },
            {
                "sectionId": "evaluation",
                "sectionTitle": "Evaluation Criteria",
                "order": 5,
                "category": "procurement",
                "assignedTo": "Procurement Lead",
                "content": ""
            },
            {
                "sectionId": "terms",
                "sectionTitle": "Commercial Terms",
                "order": 6,
                "category": "procurement",
                "assignedTo": "Procurement Lead",
                "content": ""
            }
        ]',
        'true',
        'true',
        '{"fileSize": "45KB", "originalFilename": "nujum-air-rft-template.docx", "uploadedVia": "seed-data"}',
        'system'
    ),
    (
        'IT Systems RFT Template',
        'Template for IT systems and infrastructure procurement',
        'RFT',
        'docx',
        'https://your-storage-account.blob.core.windows.net/organization-templates/it-systems-rft-template.docx',
        '[
            {"name": "PROJECT_NAME", "type": "simple", "description": "Project name"},
            {"name": "DESCRIPTION", "type": "simple", "description": "System description"},
            {"name": "BUDGET", "type": "simple", "description": "Budget allocation"},
            {"name": "TIMELINE", "type": "simple", "description": "Implementation timeline"},
            {"name": "FUNCTIONAL_REQUIREMENTS", "type": "simple", "description": "Functional requirements"},
            {"name": "NON_FUNCTIONAL_REQUIREMENTS", "type": "simple", "description": "NFRs including performance, security, scalability"}
        ]',
        '[
            {
                "sectionId": "introduction",
                "sectionTitle": "Introduction",
                "order": 1,
                "category": "business",
                "assignedTo": "Technical PM",
                "content": ""
            },
            {
                "sectionId": "technical-requirements",
                "sectionTitle": "Technical Requirements",
                "order": 2,
                "category": "technical",
                "assignedTo": "Solutions Architect",
                "content": ""
            },
            {
                "sectionId": "security",
                "sectionTitle": "Security Requirements",
                "order": 3,
                "category": "security",
                "assignedTo": "Security Architect",
                "content": ""
            }
        ]',
        'true',
        'false',
        '{"fileSize": "38KB", "originalFilename": "it-systems-rft.docx", "uploadedVia": "seed-data"}',
        'system'
    ),
    (
        'Professional Services RFI Template',
        'Request for Information template for professional services procurement',
        'RFI',
        'docx',
        'https://your-storage-account.blob.core.windows.net/organization-templates/professional-services-rfi.docx',
        '[
            {"name": "PROJECT_NAME", "type": "simple", "description": "Initiative name"},
            {"name": "DESCRIPTION", "type": "simple", "description": "Service description"},
            {"name": "TIMELINE", "type": "simple", "description": "Expected timeline"},
            {"name": "REQUIREMENTS", "type": "simple", "description": "Service requirements"}
        ]',
        '[
            {
                "sectionId": "overview",
                "sectionTitle": "Overview",
                "order": 1,
                "category": "business",
                "assignedTo": "Business Analyst",
                "content": ""
            },
            {
                "sectionId": "vendor-capabilities",
                "sectionTitle": "Vendor Capabilities",
                "order": 2,
                "category": "procurement",
                "assignedTo": "Procurement Lead",
                "content": ""
            }
        ]',
        'true',
        'false',
        '{"fileSize": "32KB", "originalFilename": "services-rfi.docx", "uploadedVia": "seed-data"}',
        'system'
    )
ON CONFLICT (name) DO NOTHING;
*/

-- ====================================================
-- SUCCESS MESSAGE
-- ====================================================

DO $$
DECLARE
    portfolio_count INTEGER;
    ai_template_count INTEGER;
    org_template_count INTEGER;
    config_count INTEGER;
    standards_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO portfolio_count FROM portfolios;
    SELECT COUNT(*) INTO ai_template_count FROM rft_templates;
    SELECT COUNT(*) INTO org_template_count FROM organization_templates;
    SELECT COUNT(*) INTO config_count FROM system_config;
    SELECT COUNT(*) INTO standards_count FROM standards;
    
    RAISE NOTICE '✓ Seed data inserted successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Summary:';
    RAISE NOTICE '  • Portfolios: % (Aviation industry defaults)', portfolio_count;
    RAISE NOTICE '  • AI RFT Templates: % (Multi-stakeholder templates)', ai_template_count;
    RAISE NOTICE '  • Organization Templates: % (commented out - upload via UI)', org_template_count;
    RAISE NOTICE '  • System Config: % entries (Azure & AI credentials)', config_count;
    RAISE NOTICE '  • Compliance Standards: % (IOSA, ISO 27001, GDPR, PCI DSS)', standards_count;
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Organization templates are DISABLED in seed data';
    RAISE NOTICE '   They require actual DOCX files in Azure Blob Storage';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Next Steps:';
    RAISE NOTICE '  1. Configure Azure credentials in Admin Config page or via environment variables';
    RAISE NOTICE '  2. Test database connection from IntelliBid application';
    RAISE NOTICE '  3. Verify server/prompts/ directory contains all 6 AI agent prompt files:';
    RAISE NOTICE '     - delivery-agent.md, product-agent.md, architecture-agent.md';
    RAISE NOTICE '     - engineering-agent.md, procurement-agent.md, security-agent.md';
    RAISE NOTICE '  4. Upload Organization Templates:';
    RAISE NOTICE '     → Go to Template Management page in the app';
    RAISE NOTICE '     → Click "Upload Template" button';
    RAISE NOTICE '     → Upload DOCX files with placeholders like {{PROJECT_NAME}}';
    RAISE NOTICE '  5. Import additional compliance standards if needed';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Database ready for production deployment!';
END $$;
