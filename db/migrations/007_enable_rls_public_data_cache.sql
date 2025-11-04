-- ============================================
-- RLS 활성화: v2_public_data_cache
-- ============================================
-- 작성일: 2025-11-03
-- 설명: 공공 데이터 캐시 테이블 보안 강화
-- ============================================

-- RLS 활성화
ALTER TABLE v2_public_data_cache ENABLE ROW LEVEL SECURITY;

-- 정책 1: 모든 인증된 사용자가 캐시 조회 가능 (공용 캐시)
CREATE POLICY "Authenticated users can read public data cache"
    ON v2_public_data_cache FOR SELECT
    TO authenticated
    USING (true);

-- 정책 2: 서비스 역할만 캐시 삽입 가능 (백엔드 전용)
CREATE POLICY "Service role can insert public data cache"
    ON v2_public_data_cache FOR INSERT
    TO service_role
    WITH CHECK (true);

-- 정책 3: 서비스 역할만 캐시 업데이트 가능 (hit_count, last_accessed_at)
CREATE POLICY "Service role can update public data cache"
    ON v2_public_data_cache FOR UPDATE
    TO service_role
    USING (true);

-- 정책 4: 서비스 역할만 캐시 삭제 가능 (만료된 캐시 정리)
CREATE POLICY "Service role can delete expired cache"
    ON v2_public_data_cache FOR DELETE
    TO service_role
    USING (expires_at < NOW());

-- ============================================
-- 완료!
-- ============================================
-- 실행 방법:
-- 1. Supabase SQL Editor에서 실행
-- 2. 또는 Python으로 실행:
--    python db/apply_migration.py 007_enable_rls_public_data_cache.sql
-- ============================================