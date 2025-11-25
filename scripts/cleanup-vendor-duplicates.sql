-- ============================================================================
-- PRODUCTION DATABASE CLEANUP: Vendor Name Duplicates
-- ============================================================================
-- This script removes duplicate vendor entries caused by inconsistent 
-- vendor name formatting (e.g., "Salesforce, Inc." vs "SalesforceInc")
-- 
-- RUN THIS ON PRODUCTION DATABASE AFTER DEPLOYING THE CODE FIX
-- ============================================================================

-- Step 1: View current duplicates (for verification - run first)
-- SELECT vendor_name, COUNT(*) as proposal_count 
-- FROM proposals 
-- GROUP BY vendor_name 
-- ORDER BY vendor_name;

-- Step 2: Delete evaluations that reference duplicate proposals
-- (Proposals with no space in names like "SalesforceInc", "ServiceNowInc", etc.)
DELETE FROM evaluations WHERE proposal_id IN (
  SELECT id FROM proposals 
  WHERE vendor_name ~ '^[A-Za-z0-9]+$' 
    AND vendor_name LIKE '%Inc'
    AND vendor_name NOT LIKE '% Inc'
);

-- Step 3: Delete the duplicate proposals (no-space versions)
DELETE FROM proposals 
WHERE vendor_name ~ '^[A-Za-z0-9]+$' 
  AND vendor_name LIKE '%Inc'
  AND vendor_name NOT LIKE '% Inc';

-- Also handle Corp, LLC variations
DELETE FROM evaluations WHERE proposal_id IN (
  SELECT id FROM proposals 
  WHERE vendor_name ~ '^[A-Za-z0-9]+$' 
    AND (vendor_name LIKE '%Corp' OR vendor_name LIKE '%LLC')
    AND vendor_name NOT LIKE '% Corp'
    AND vendor_name NOT LIKE '% LLC'
);

DELETE FROM proposals 
WHERE vendor_name ~ '^[A-Za-z0-9]+$' 
  AND (vendor_name LIKE '%Corp' OR vendor_name LIKE '%LLC')
  AND vendor_name NOT LIKE '% Corp'
  AND vendor_name NOT LIKE '% LLC';

-- Step 4: Normalize ALL vendor names to remove special characters
-- This ensures future consistency even if some names have commas/periods
UPDATE proposals 
SET vendor_name = REGEXP_REPLACE(
  REGEXP_REPLACE(
    REGEXP_REPLACE(vendor_name, '[^a-zA-Z0-9\s]', '', 'g'),  -- Remove special chars
    '\s+', ' ', 'g'                                           -- Collapse spaces
  ),
  '^\s+|\s+$', '', 'g'                                        -- Trim
)
WHERE vendor_name ~ '[^a-zA-Z0-9\s]';

-- Step 5: Verify cleanup (run after to confirm)
-- SELECT vendor_name, COUNT(*) as proposal_count 
-- FROM proposals 
-- GROUP BY vendor_name 
-- ORDER BY vendor_name;

-- ============================================================================
-- EXPECTED RESULTS:
-- - "SalesforceInc" deleted, keeping "Salesforce Inc"
-- - "ServiceNowInc" deleted, keeping "ServiceNow Inc"  
-- - "IBMCorp" deleted, keeping "IBM Corp"
-- - All vendor names now have spaces and no special characters
-- ============================================================================
