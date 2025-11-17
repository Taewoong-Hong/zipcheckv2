-- 기존 recent_conversations 뷰 정의 확인

-- 1. 뷰 존재 여부 확인
SELECT EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'recent_conversations'
) AS view_exists;

-- 2. 뷰 정의 확인
SELECT
    viewname,
    viewowner,
    definition
FROM pg_views
WHERE schemaname = 'public'
AND viewname = 'recent_conversations';

-- 3. 뷰의 SECURITY 속성 확인 (DEFINER vs INVOKER)
SELECT
    v.relname AS view_name,
    CASE
        WHEN v.relkind = 'v' THEN
            CASE
                WHEN v.reloptions IS NOT NULL AND 'security_invoker=true' = ANY(v.reloptions) THEN 'SECURITY INVOKER'
                ELSE 'SECURITY DEFINER'
            END
        ELSE 'Not a view'
    END AS security_mode
FROM pg_class v
WHERE v.relname = 'recent_conversations'
AND v.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 4. conversations 테이블 구조 확인
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'conversations'
ORDER BY ordinal_position;

-- 5. messages 테이블 구조 확인
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'messages'
ORDER BY ordinal_position;

-- 6. RLS 정책 확인
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('conversations', 'messages')
ORDER BY tablename, policyname;
