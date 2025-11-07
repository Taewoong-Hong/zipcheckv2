-- ============================================
-- Migration 010: 자동 프로필 생성 트리거
-- auth.users 생성 시 v2_profiles 자동 생성
-- ============================================

-- Function: auth.users INSERT 시 v2_profiles 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- v2_profiles에 사용자 프로필 자동 생성
  INSERT INTO public.v2_profiles (user_id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;  -- 중복 방지 (OAuth 제공자 변경 시)

  RETURN NEW;
END;
$$;

-- Trigger: auth.users INSERT 시 자동 실행
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS
'auth.users 생성 시 v2_profiles 자동 생성 (OAuth 중복 가입 방지)';

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
'신규 사용자 가입 시 프로필 자동 생성';
