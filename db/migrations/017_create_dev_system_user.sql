-- Migration 017: Create dev system user for unauthenticated uploads
-- Created: 2025-01-27
-- Purpose: Fix FK constraint violation in v2_cases.user_id and v2_artifacts.user_id

BEGIN;

-- ============================================
-- Create dev system user in auth.users
-- ============================================
-- This user is used for development uploads without authentication
-- UUID: 00000000-0000-0000-0000-000000000001

INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    aud,
    role,
    confirmation_token,
    raw_app_meta_data,
    raw_user_meta_data
) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,  -- Default instance ID
    'dev-system@zipcheck.internal',
    crypt('dev-password-unused', gen_salt('bf')),  -- Encrypted password (not used)
    NOW(),  -- Email confirmed immediately
    NOW(),
    NOW(),
    'authenticated',
    'authenticated',
    '',  -- No confirmation token needed
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Dev System User"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Verify creation
-- ============================================
DO $$
DECLARE
    user_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
    ) INTO user_exists;

    IF user_exists THEN
        RAISE NOTICE '✅ Dev system user created successfully: 00000000-0000-0000-0000-000000000001';
    ELSE
        RAISE EXCEPTION '❌ Failed to create dev system user';
    END IF;
END $$;

COMMIT;

-- ============================================
-- Usage Notes
-- ============================================
-- This user is referenced in:
-- - apps/web/app/api/cases/upload/route.ts (line 15)
-- - Used for v2_cases.user_id (line 94)
-- - Used for v2_artifacts.user_id (line 122)
--
-- FK Constraints:
-- - v2_cases.user_id → auth.users(id) CASCADE DELETE
-- - v2_artifacts.user_id → auth.users(id) CASCADE DELETE
--
-- Security Note:
-- This user should ONLY be used in development environments.
-- Production should use actual authenticated users from Supabase Auth.
