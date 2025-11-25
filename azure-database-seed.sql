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
        'Emirates Airlines Standard RFT Template',
        'Official Emirates Airlines template for Request for Tender (RFT) procurement processes',
        'RFT',
        'docx',
        'https://your-storage-account.blob.core.windows.net/organization-templates/emirates-airlines-rft-template.docx',
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
        '{"fileSize": "45KB", "originalFilename": "emirates-airlines-rft-template.docx", "uploadedVia": "seed-data"}',
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
