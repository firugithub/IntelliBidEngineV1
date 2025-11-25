-- IntelliBid Database Migration: Add Procurement Questionnaire Columns
-- Date: November 25, 2025
-- Purpose: Add 5th questionnaire type (Procurement) to generated_rfts table
-- Usage: Run this script on existing Azure PostgreSQL database to add new columns

-- ============================================
-- Migration: Add Procurement Questionnaire Columns
-- ============================================

-- Add local path column (deprecated but included for consistency)
ALTER TABLE generated_rfts 
ADD COLUMN IF NOT EXISTS procurement_questionnaire_path TEXT;

-- Add Azure Blob URL column (deprecated - use blob_name)
ALTER TABLE generated_rfts 
ADD COLUMN IF NOT EXISTS procurement_questionnaire_blob_url TEXT;

-- Add Azure Blob Storage path column (current/recommended)
ALTER TABLE generated_rfts 
ADD COLUMN IF NOT EXISTS procurement_questionnaire_blob_name TEXT;

-- ============================================
-- Verification Query
-- ============================================
-- Run this to verify columns were added:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'generated_rfts' 
-- AND column_name LIKE '%procurement%';

-- ============================================
-- Rollback (if needed)
-- ============================================
-- ALTER TABLE generated_rfts DROP COLUMN IF EXISTS procurement_questionnaire_path;
-- ALTER TABLE generated_rfts DROP COLUMN IF EXISTS procurement_questionnaire_blob_url;
-- ALTER TABLE generated_rfts DROP COLUMN IF EXISTS procurement_questionnaire_blob_name;
