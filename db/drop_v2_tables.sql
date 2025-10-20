-- ============================================
-- Drop v2 Tables and Functions
-- ============================================
-- CAUTION: This will delete all v2 data!
-- Only run this if you want to recreate the schema from scratch
-- ============================================

-- Drop tables in reverse order (due to foreign key constraints)
DROP TABLE IF EXISTS v2_reports CASCADE;
DROP TABLE IF EXISTS v2_embeddings CASCADE;
DROP TABLE IF EXISTS v2_documents CASCADE;
DROP TABLE IF EXISTS v2_contracts CASCADE;
DROP TABLE IF EXISTS v2_profiles CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS v2_update_updated_at_column() CASCADE;

-- Verify deletion
SELECT 'All v2 tables and functions have been dropped.' AS status;
