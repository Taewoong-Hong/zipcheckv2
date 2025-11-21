-- Migration: 채팅 2분류 시스템 (최근 대화 / 분석 리포트)
-- Created: 2024-11-21
-- Description: conversations 테이블에 다중 카테고리 태깅 시스템 추가
-- Note: 하나의 대화가 "최근 대화"이면서 동시에 "분석 리포트"일 수 있음 (중복 허용)

BEGIN;

-- 1. is_recent_conversation 컬럼 추가 (모든 대화는 기본적으로 최근 대화)
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS is_recent_conversation BOOLEAN DEFAULT TRUE NOT NULL;

-- 2. is_analysis_report 컬럼 추가 (분석 리포트인 경우에만 TRUE)
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS is_analysis_report BOOLEAN DEFAULT FALSE NOT NULL;

-- 3. case_id 컬럼 추가 (분석 리포트 연동용, NULL 허용)
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES v2_cases(id) ON DELETE CASCADE;

-- 4. 기존 대화 데이터 마이그레이션
-- 분석 상태가 있거나 주소/계약 정보가 있는 대화는 분석 리포트로 태깅
UPDATE conversations
SET is_analysis_report = TRUE
WHERE analysis_status IN ('completed', 'analysis', 'pending', 'analyzing')
  OR property_address IS NOT NULL
  OR contract_type IS NOT NULL;

-- 5. 인덱스 추가 (조회 성능 최적화)
-- 최근 대화 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_conversations_recent
ON conversations(user_id, is_recent_conversation, updated_at DESC)
WHERE is_recent_conversation = TRUE;

-- 분석 리포트 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_conversations_analysis
ON conversations(user_id, is_analysis_report, updated_at DESC)
WHERE is_analysis_report = TRUE;

-- case_id 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_conversations_case_id
ON conversations(case_id) WHERE case_id IS NOT NULL;

-- 6. recent_conversations 뷰 업데이트 (새 필드 포함)
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
  c.is_recent_conversation,  -- ✅ 추가
  c.is_analysis_report,       -- ✅ 추가
  c.case_id,                  -- ✅ 추가
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

-- 7. RLS 정책 확인 (기존 정책 유지)
-- conversations 테이블의 RLS는 user_id 기반이므로 별도 수정 불필요

-- 8. 권한 부여
GRANT SELECT ON recent_conversations TO authenticated;

COMMIT;

-- 롤백 스크립트 (필요 시 실행)
-- BEGIN;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS is_recent_conversation;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS is_analysis_report;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS case_id;
-- DROP INDEX IF EXISTS idx_conversations_recent;
-- DROP INDEX IF EXISTS idx_conversations_analysis;
-- DROP INDEX IF EXISTS idx_conversations_case_id;
-- DROP VIEW IF EXISTS recent_conversations;
-- -- 기존 뷰 재생성 (생략)
-- COMMIT;