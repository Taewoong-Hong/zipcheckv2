-- ============================================
-- Migration: 암호화 및 프로필 자동 생성 트리거
-- ============================================

-- ============================================
-- Function: 신규 사용자 프로필 자동 생성 (암호화 포함)
-- ============================================
CREATE OR REPLACE FUNCTION v2_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- v2_profiles에 신규 사용자 프로필 자동 생성
  INSERT INTO public.v2_profiles (user_id, email, name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Trigger: auth.users에 신규 사용자 생성 시 프로필 자동 생성
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION v2_handle_new_user();

-- ============================================
-- 암호화 헬퍼 함수들 (PL/pgSQL)
-- ============================================
-- Note: 실제 암호화는 애플리케이션 레이어(Python/TypeScript)에서 수행
-- 이 함수들은 암호화 여부 확인 및 데이터 마이그레이션용

-- 암호화된 데이터 여부 확인
CREATE OR REPLACE FUNCTION v2_is_encrypted(data TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- base64 인코딩된 데이터 또는 특정 패턴 확인
  -- Python: base64 encoded (길이 > 원본, 특정 문자 포함)
  -- TypeScript: iv:authTag:encrypted 형식
  RETURN data IS NOT NULL AND (
    data ~ '^[A-Za-z0-9+/=]+$' OR  -- base64 패턴
    data ~ '^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$'  -- TypeScript 패턴
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION v2_is_encrypted IS '데이터가 암호화되었는지 확인 (패턴 기반)';

-- ============================================
-- 인덱스 추가 (성능 최적화)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_v2_profiles_email ON v2_profiles(email);
CREATE INDEX IF NOT EXISTS idx_v2_profiles_name ON v2_profiles(name);

-- ============================================
-- 완료 메시지
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 002 완료: 암호화 및 프로필 자동 생성 트리거 추가됨';
  RAISE NOTICE '⚠️  암호화는 애플리케이션 레이어에서 수행됩니다 (Python/TypeScript)';
  RAISE NOTICE '⚠️  기존 평문 데이터는 별도 마이그레이션 스크립트로 암호화하세요';
END $$;
