-- Seed data for ZipCheck v2 Development
-- Run this after migrations to set up initial admin users

-- =============================================================================
-- 1. Create test admin user (for development only)
-- =============================================================================

-- Note: This assumes you've already created a user via Google OAuth
-- Replace 'admin@zipcheck.kr' with your actual admin email

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Find user by email (assumes user already exists from OAuth)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'admin@zipcheck.kr';

  -- If user exists, update role to admin
  IF v_user_id IS NOT NULL THEN
    UPDATE public.users
    SET role = 'admin'
    WHERE id = v_user_id;

    RAISE NOTICE 'Admin role granted to user: admin@zipcheck.kr';
  ELSE
    RAISE NOTICE 'User admin@zipcheck.kr not found. Please create via Google OAuth first.';
  END IF;
END $$;

-- =============================================================================
-- 2. Insert sample admin logs (for testing)
-- =============================================================================

-- Note: These are sample logs for UI testing
-- Real logs will be created automatically via log_admin_action() function

DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Get admin user ID
  SELECT id INTO v_admin_id
  FROM public.users
  WHERE role = 'admin'
  LIMIT 1;

  -- Insert sample logs only if admin exists
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.admin_logs (user_id, user_email, action, resource, details) VALUES
    (v_admin_id, 'admin@zipcheck.kr', 'VIEW_DASHBOARD', NULL, '{"page": "overview"}'),
    (v_admin_id, 'admin@zipcheck.kr', 'VIEW_ANALYTICS', NULL, '{"period": "7d"}'),
    (v_admin_id, 'admin@zipcheck.kr', 'UPDATE_USER', 'user-123', '{"field": "role", "old": "user", "new": "admin"}'),
    (v_admin_id, 'admin@zipcheck.kr', 'VIEW_DASHBOARD', NULL, '{"page": "users"}'),
    (v_admin_id, 'admin@zipcheck.kr', 'LOGIN', NULL, '{"method": "google_oauth", "ip": "127.0.0.1"}');

    RAISE NOTICE 'Sample admin logs inserted successfully';
  ELSE
    RAISE NOTICE 'No admin user found. Skipping sample logs.';
  END IF;
END $$;

-- =============================================================================
-- 3. Verify setup
-- =============================================================================

-- Show admin users
SELECT
  'Admin Users' as category,
  COUNT(*) as count
FROM public.users
WHERE role = 'admin';

-- Show recent logs
SELECT
  'Recent Admin Logs' as category,
  COUNT(*) as count
FROM public.admin_logs;

-- Show functions
SELECT
  'Helper Functions' as category,
  COUNT(*) as count
FROM pg_proc
WHERE proname IN ('is_admin', 'log_admin_action');
