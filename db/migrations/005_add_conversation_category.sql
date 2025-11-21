-- Migration: 채팅 2분류 시스템 (최근 대화 / 분석 리포트)
-- Created: 2025-01-21
-- Description: conversations 테이블에 카테고리 및 케이스 연동 필드 추가

BEGIN;

-- 1. conversation_category 컬럼 추가 (기본값: 'general')
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS conversation_category TEXT DEFAULT 'general' NOT NULL
CHECK (conversation_category IN ('general', 'analysis'));

-- 2. case_id 컬럼 추가 (분석 대화 전용, NULL 허용)
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES v2_cases(id) ON DELETE CASCADE;

-- 3. 기존 대화 데이터 마이그레이션
-- 분석 상태가 'completed' 또는 'analysis'인 대화는 'analysis'로 설정
UPDATE conversations
SET conversation_category = 'analysis'
WHERE analysis_status IN ('completed', 'analysis', 'pending', 'analyzing')
  OR property_address IS NOT NULL
  OR contract_type IS NOT NULL;

-- 4. 인덱스 추가 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_conversations_category_user
ON conversations(user_id, conversation_category, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_case_id
ON conversations(case_id) WHERE case_id IS NOT NULL;

-- 5. recent_conversations 뷰 업데이트 (카테고리 포함)
DROP VIEW IF EXISTS recent_conversations;

CREATE VIEW recent_conversations
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.user_id,
  c.title,
  c.property_address,
  c.contract_type,
  c.analysis_status,
  c.conversation_category,  -- ✅ 추가
  c.case_id,                 -- ✅ 추가
  c.meta,
  c.created_at,
  c.updated_at,
  (
    SELECT content
    FROM messages
    WHERE messages.conversation_id = c.id AND messages.role = 'user'
    ORDER BY messages.created_at DESC
    LIMIT 1
  ) AS last_user_message,
  (
    SELECT COUNT(*)::INTEGER
    FROM messages
    WHERE messages.conversation_id = c.id
  ) AS message_count
FROM conversations c
WHERE c.user_id = auth.uid()
ORDER BY c.updated_at DESC;

-- 6. RLS 정책 확인 (기존 정책 유지)
-- conversations 테이블의 RLS는 user_id 기반이므로 별도 수정 불필요

-- 7. 권한 부여
GRANT SELECT ON recent_conversations TO authenticated;

COMMIT;

-- 롤백 스크립트 (필요 시 실행)
-- BEGIN;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS conversation_category;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS case_id;
-- DROP INDEX IF EXISTS idx_conversations_category_user;
-- DROP INDEX IF EXISTS idx_conversations_case_id;
-- DROP VIEW IF EXISTS recent_conversations;
-- -- 기존 뷰 재생성 (생략)
-- COMMIT;