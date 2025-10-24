-- 빠른 관리자 설정 스크립트
-- hourhong@zipcheck.kr 계정에 admin role 부여

-- =============================================================================
-- 1. 먼저 Google OAuth로 로그인 필요!
-- =============================================================================
-- http://localhost:3000 또는 https://zipcheck.kr 접속
-- "구글로 계속하기" 클릭
-- hourhong@zipcheck.kr 계정으로 로그인
-- → 이렇게 하면 users 테이블에 자동으로 레코드 생성됨

-- =============================================================================
-- 2. role 컬럼 추가 (아직 없다면)
-- =============================================================================
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- =============================================================================
-- 3. hourhong@zipcheck.kr에 admin role 부여
-- =============================================================================
UPDATE public.users
SET role = 'admin'
WHERE email = 'hourhong@zipcheck.kr';

-- =============================================================================
-- 4. 확인
-- =============================================================================
SELECT
  id,
  email,
  role,
  created_at,
  updated_at
FROM public.users
WHERE email = 'hourhong@zipcheck.kr';

-- 모든 관리자 확인
SELECT
  id,
  email,
  role,
  created_at
FROM public.users
WHERE role = 'admin'
ORDER BY created_at;

-- =============================================================================
-- 5. admin_logs 테이블 생성 (감사 로그)
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

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_admin_logs_user_id ON public.admin_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON public.admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);

-- RLS 활성화
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- 관리자만 조회 가능
DROP POLICY IF EXISTS "Admins can view all logs" ON public.admin_logs;
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

-- 관리자만 삽입 가능
DROP POLICY IF EXISTS "Admins can insert logs" ON public.admin_logs;
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

-- =============================================================================
-- 6. 헬퍼 함수 생성
-- =============================================================================

-- 현재 사용자가 admin인지 확인
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

-- 관리자 액션 로깅
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
  -- 사용자 이메일 가져오기
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  -- 로그 삽입
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

-- 권한 부여
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, JSONB) TO authenticated;

-- =============================================================================
-- 완료!
-- =============================================================================
SELECT '✅ 설정 완료!' as status;
SELECT '이제 http://localhost:3000/zc-ops-nx7k2 접속 가능' as next_step;
