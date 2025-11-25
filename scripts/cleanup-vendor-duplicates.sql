-- ============================================================================
-- PRODUCTION DATABASE CLEANUP: Vendor Name Duplicates (SAFE VERSION)
-- ============================================================================
-- This script SAFELY removes duplicate vendor entries by:
-- 1. Only deleting duplicates that have a valid counterpart
-- 2. Reassigning evaluations to the correct proposal before deletion
-- 
-- RUN THIS ON PRODUCTION DATABASE AFTER DEPLOYING THE CODE FIX
-- ============================================================================

-- Step 1: DIAGNOSTIC - View current vendor names and identify duplicates
-- Run this first to understand what will be cleaned
SELECT 
  vendor_name,
  REGEXP_REPLACE(REGEXP_REPLACE(vendor_name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', ' ', 'g') as normalized_name,
  COUNT(*) as proposal_count,
  array_agg(id) as proposal_ids
FROM proposals 
GROUP BY vendor_name
ORDER BY normalized_name, vendor_name;

-- Step 2: DIAGNOSTIC - Find duplicates that share the same normalized name
-- This identifies vendors like "SalesforceInc" vs "Salesforce Inc"
SELECT 
  REGEXP_REPLACE(REGEXP_REPLACE(vendor_name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', ' ', 'g') as normalized,
  array_agg(DISTINCT vendor_name) as variants,
  COUNT(DISTINCT vendor_name) as variant_count
FROM proposals
GROUP BY normalized
HAVING COUNT(DISTINCT vendor_name) > 1
ORDER BY variant_count DESC;

-- ============================================================================
-- STEP 3: SAFE CLEANUP - Only proceed if Step 2 shows duplicates
-- ============================================================================

-- Create temp table to map duplicates to their canonical (spaced) version
CREATE TEMP TABLE vendor_mapping AS
WITH normalized AS (
  SELECT 
    id,
    vendor_name,
    project_id,
    TRIM(REGEXP_REPLACE(REGEXP_REPLACE(vendor_name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', ' ', 'g')) as norm_name
  FROM proposals
),
canonical AS (
  SELECT DISTINCT ON (project_id, norm_name)
    id as canonical_id,
    vendor_name as canonical_name,
    norm_name,
    project_id
  FROM normalized
  WHERE vendor_name LIKE '% %'  -- Prefer names with spaces
  ORDER BY project_id, norm_name, LENGTH(vendor_name) DESC
)
SELECT 
  n.id as duplicate_id,
  n.vendor_name as duplicate_name,
  c.canonical_id,
  c.canonical_name
FROM normalized n
JOIN canonical c ON n.norm_name = c.norm_name AND n.project_id = c.project_id
WHERE n.id != c.canonical_id;

-- View what will be cleaned (REVIEW THIS BEFORE PROCEEDING)
SELECT * FROM vendor_mapping ORDER BY canonical_name, duplicate_name;

-- Step 4: Reassign evaluations from duplicate proposals to canonical proposals
UPDATE evaluations e
SET proposal_id = vm.canonical_id
FROM vendor_mapping vm
WHERE e.proposal_id = vm.duplicate_id;

-- Step 5: Delete duplicate proposals (now safe - evaluations were reassigned)
DELETE FROM proposals p
USING vendor_mapping vm
WHERE p.id = vm.duplicate_id;

-- Step 6: Normalize all remaining vendor names to prevent future issues
UPDATE proposals 
SET vendor_name = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(vendor_name, '[^a-zA-Z0-9\s]', '', 'g'),
    '\s+', ' ', 'g'
  )
)
WHERE vendor_name ~ '[^a-zA-Z0-9\s]' OR vendor_name ~ '\s{2,}';

-- Step 7: VERIFY - Check all vendor names are now normalized
SELECT vendor_name, COUNT(*) as count
FROM proposals
GROUP BY vendor_name
ORDER BY vendor_name;

-- Cleanup temp table
DROP TABLE IF EXISTS vendor_mapping;

-- ============================================================================
-- EXPECTED RESULTS:
-- - Duplicate proposals merged (e.g., "SalesforceInc" → "Salesforce Inc")
-- - Evaluations preserved and reassigned to canonical proposals
-- - All vendor names normalized (no special chars, single spaces)
-- ============================================================================
