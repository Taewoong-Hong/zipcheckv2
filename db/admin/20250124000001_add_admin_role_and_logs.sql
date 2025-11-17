-- Migration: Add admin role system and audit logs
-- Created: 2025-01-24
-- Description:
--   1. Add role column to users table with CHECK constraint
--   2. Create admin_logs table for audit trail
--   3. Set up RLS policies for admin-only access
--   4. Create indexes for performance

-- =============================================================================
-- 1. Add role column to users table
-- =============================================================================

-- Add role column with CHECK constraint
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Add comment
COMMENT ON COLUMN public.users.role IS 'User role: user (default) or admin (for dashboard access)';

-- Create index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- =============================================================================
-- 2. Create admin_logs table for audit trail
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE public.admin_logs IS 'Audit log for all admin actions';
COMMENT ON COLUMN public.admin_logs.user_id IS 'User who performed the action';
COMMENT ON COLUMN public.admin_logs.user_email IS 'Email of the user (denormalized for audit)';
COMMENT ON COLUMN public.admin_logs.action IS 'Action performed (e.g., VIEW_DASHBOARD, UPDATE_USER, etc.)';
COMMENT ON COLUMN public.admin_logs.resource IS 'Resource affected (e.g., user_id, document_id)';
COMMENT ON COLUMN public.admin_logs.details IS 'Additional details in JSON format';
COMMENT ON COLUMN public.admin_logs.ip_address IS 'IP address of the request';
COMMENT ON COLUMN public.admin_logs.user_agent IS 'User agent string';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_admin_logs_user_id ON public.admin_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON public.admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_user_email ON public.admin_logs(user_email);

-- =============================================================================
-- 3. Enable RLS on admin_logs
-- =============================================================================

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view all logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Admins can insert logs" ON public.admin_logs;
DROP POLICY IF EXISTS "System can insert logs" ON public.admin_logs;

-- Policy: Admins can view all logs
CREATE POLICY "Admins can view all logs"
ON public.admin_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Policy: Admins can insert logs
CREATE POLICY "Admins can insert logs"
ON public.admin_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Policy: Service role can insert logs (for server-side logging)
CREATE POLICY "System can insert logs"
ON public.admin_logs
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
);

-- =============================================================================
-- 4. Update users table RLS policies
-- =============================================================================

-- Drop existing admin policies if any
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;

-- Policy: Admins can read all users
CREATE POLICY "Admins can read all users"
ON public.users
FOR SELECT
USING (
  -- User can read their own data
  auth.uid() = id
  OR
  -- Or if user is admin
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Policy: Admins can update all users
CREATE POLICY "Admins can update all users"
ON public.users
FOR UPDATE
USING (
  -- User can update their own data
  auth.uid() = id
  OR
  -- Or if user is admin
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- =============================================================================
-- 5. Create helper functions
-- =============================================================================

-- Function: Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS 'Returns true if current user is admin';

-- Function: Log admin action
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_resource TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Insert log
  INSERT INTO public.admin_logs (
    user_id,
    user_email,
    action,
    resource,
    details
  ) VALUES (
    auth.uid(),
    v_user_email,
    p_action,
    p_resource,
    p_details
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION public.log_admin_action IS 'Log an admin action to audit trail';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, JSONB) TO authenticated;

-- =============================================================================
-- 6. Create views for admin dashboard
-- =============================================================================

-- View: Admin users list
CREATE OR REPLACE VIEW public.admin_users AS
SELECT
  id,
  email,
  created_at,
  updated_at,
  role
FROM public.users
WHERE role = 'admin';

COMMENT ON VIEW public.admin_users IS 'List of all admin users';

-- Grant select to authenticated users (RLS will handle access control)
GRANT SELECT ON public.admin_users TO authenticated;

-- View: Recent admin activities
CREATE OR REPLACE VIEW public.recent_admin_activities AS
SELECT
  al.id,
  al.user_email,
  al.action,
  al.resource,
  al.details,
  al.created_at
FROM public.admin_logs al
ORDER BY al.created_at DESC
LIMIT 100;

COMMENT ON VIEW public.recent_admin_activities IS 'Last 100 admin actions';

-- Grant select to authenticated users (RLS will handle access control)
GRANT SELECT ON public.recent_admin_activities TO authenticated;
