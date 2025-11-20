-- Auto-generated migration: 2025-11-18 18:35:44
-- Schema alignment for new architecture

ALTER TABLE v2_reports ALTER COLUMN content TYPE TEXT USING content::TEXT;
ALTER TABLE v2_reports ALTER COLUMN registry_data TYPE JSONB USING registry_data::JSONB;
ALTER TABLE v2_reports ALTER COLUMN market_data TYPE JSONB USING market_data::JSONB;
ALTER TABLE v2_reports ALTER COLUMN risk_score TYPE JSONB USING risk_score::JSONB;
ALTER TABLE v2_reports ALTER COLUMN report_data TYPE JSONB USING report_data::JSONB;
ALTER TABLE v2_reports ALTER COLUMN case_id TYPE UUID USING case_id::UUID;
ALTER TABLE v2_reports ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
ALTER TABLE v2_cases ALTER COLUMN metadata TYPE JSONB USING metadata::JSONB;
ALTER TABLE v2_cases ALTER COLUMN property_address TYPE TEXT USING property_address::TEXT;
ALTER TABLE v2_cases ALTER COLUMN contract_type TYPE TEXT USING contract_type::TEXT;
ALTER TABLE v2_cases ALTER COLUMN current_state TYPE TEXT USING current_state::TEXT;
ALTER TABLE v2_cases ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
ALTER TABLE v2_artifacts ALTER COLUMN file_url TYPE TEXT USING file_url::TEXT;
ALTER TABLE v2_artifacts ALTER COLUMN artifact_type TYPE TEXT USING artifact_type::TEXT;
ALTER TABLE v2_artifacts ALTER COLUMN case_id TYPE UUID USING case_id::UUID;
