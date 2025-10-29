-- ============================================
-- 보안 수정: recent_conversations 뷰
-- ============================================
-- 작성일: 2025-01-29
-- 이슈: Supabase Security Advisor 경고
-- 내용: SECURITY DEFINER → SECURITY INVOKER 변경
-- ============================================

-- ============================================
-- 1. 기존 뷰 삭제
-- ============================================
DROP VIEW IF EXISTS public.recent_conversations;

-- ============================================
-- 2. 안전한 뷰 재생성 (SECURITY INVOKER)
-- ============================================
CREATE VIEW public.recent_conversations
WITH (security_invoker = true)  -- ⭐ Current user privileges (RLS 적용)
AS
SELECT
    c.id,
    c.title,
    c.property_address,
    c.contract_type,
    c.analysis_status,
    c.created_at,
    c.updated_at,
    -- Last user message subquery
    (
        SELECT m.content
        FROM messages m
        WHERE m.conversation_id = c.id
        AND m.role = 'user'
        ORDER BY m.created_at DESC
        LIMIT 1
    ) AS last_user_message,
    -- Message count
    (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.conversation_id = c.id
    ) AS message_count
FROM conversations c
WHERE c.user_id = auth.uid()  -- ⭐ Explicit user filter (이미 있음)
ORDER BY c.updated_at DESC;

-- ============================================
-- 3. 권한 부여
-- ============================================
GRANT SELECT ON public.recent_conversations TO authenticated;

-- ============================================
-- 4. RLS 정책 확인 및 생성
-- ============================================

-- conversations 테이블 RLS 활성화
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- conversations 조회 정책 (없으면 생성)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'conversations'
        AND policyname = 'Users can view own conversations'
    ) THEN
        CREATE POLICY "Users can view own conversations"
        ON conversations FOR SELECT
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- messages 테이블 RLS 활성화
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- messages 조회 정책 (없으면 생성)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'messages'
        AND policyname = 'Users can view messages of own conversations'
    ) THEN
        CREATE POLICY "Users can view messages of own conversations"
        ON messages FOR SELECT
        USING (EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        ));
    END IF;
END $$;

-- ============================================
-- 5. 검증 쿼리 (주석 처리)
-- ============================================
-- 뷰 정의 확인
-- SELECT viewname, viewowner, definition
-- FROM pg_views
-- WHERE viewname = 'recent_conversations';

-- SECURITY 속성 확인 (SECURITY INVOKER여야 함)
-- SELECT
--     v.relname AS view_name,
--     CASE
--         WHEN v.relkind = 'v' THEN
--             CASE
--                 WHEN v.reloptions IS NOT NULL AND 'security_invoker=true' = ANY(v.reloptions) THEN 'SECURITY INVOKER'
--                 ELSE 'SECURITY DEFINER'
--             END
--         ELSE 'Not a view'
--     END AS security_mode
-- FROM pg_class v
-- WHERE v.relname = 'recent_conversations'
-- AND v.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 테스트 쿼리 (본인 데이터만 보여야 함)
-- SELECT * FROM recent_conversations;

-- ============================================
-- 완료!
-- ============================================
-- 적용 방법:
-- 1. Supabase Dashboard → SQL Editor
-- 2. 이 파일 내용 복사 → 붙여넣기 → Run
-- 3. 또는 CLI: supabase db push
-- ============================================