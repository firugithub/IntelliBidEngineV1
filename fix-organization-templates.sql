-- ====================================================
-- Fix BlobNotFound Error for Organization Templates
-- ====================================================
-- This script removes the seeded organization templates
-- that have placeholder blob URLs pointing to non-existent files
-- ====================================================

-- Delete seeded templates with placeholder URLs
DELETE FROM organization_templates WHERE created_by = 'system';

-- Verify deletion
DO $$
DECLARE
    remaining_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_count FROM organization_templates;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Fixed organization templates!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Current state:';
    RAISE NOTICE '  • Organization templates remaining: %', remaining_count;
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Next Steps:';
    RAISE NOTICE '  1. Go to Template Management page in IntelliBid';
    RAISE NOTICE '  2. Click "Upload Template" button';
    RAISE NOTICE '  3. Upload DOCX files with placeholders like {{PROJECT_NAME}}';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Example DOCX template structure:';
    RAISE NOTICE '   ---';
    RAISE NOTICE '   Nujum Air - Request for Tender';
    RAISE NOTICE '   ';
    RAISE NOTICE '   Project: {{PROJECT_NAME}}';
    RAISE NOTICE '   Budget: {{BUDGET}}';
    RAISE NOTICE '   Timeline: {{TIMELINE}}';
    RAISE NOTICE '   ';
    RAISE NOTICE '   Requirements:';
    RAISE NOTICE '   {{FUNCTIONAL_REQUIREMENTS}}';
    RAISE NOTICE '   {{NON_FUNCTIONAL_REQUIREMENTS}}';
    RAISE NOTICE '   ---';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Now you can generate drafts without BlobNotFound errors!';
END $$;
