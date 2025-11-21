-- Migration: GPT 스타일 사이드바 지원 (현재 단순 스키마 기반)
-- Created: 2025-01-21
-- Description: 기존 conversations 테이블에 사이드바용 메타데이터 추가 + 전용 뷰 생성
-- Strategy: 현재 단순 스키마 활용 (user_id 기반, messages 테이블 없음)

BEGIN;

-- ===========================
-- 1. conversations 테이블 확장
-- ===========================

-- 사이드바용 핵심 메타 컬럼 추가 (이미 존재하는 컬럼은 건너뛰기)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE NOT NULL;

-- is_archived 컬럼 추가 (아직 없다면)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE NOT NULL;

-- 주석 추가
COMMENT ON COLUMN public.conversations.is_recent_conversation IS 'GPT 최근 대화 섹션 표시 여부';
COMMENT ON COLUMN public.conversations.is_analysis_report IS 'GPT 분석 리포트 섹션 표시 여부 (case_id 있으면 자동 TRUE)';
COMMENT ON COLUMN public.conversations.is_pinned IS '상단 고정 여부 (즐겨찾기)';
COMMENT ON COLUMN public.conversations.is_archived IS '아카이브 여부 (사이드바에서 숨김)';
COMMENT ON COLUMN public.conversations.case_id IS 'v2_cases와 연동 (분석 리포트인 경우)';

-- ===========================
-- 2. 사이드바 조회 최적화 인덱스
-- ===========================

-- 사용자별 최근 대화
CREATE INDEX IF NOT EXISTS idx_conv_recent_sidebar
ON public.conversations (user_id, is_archived, is_recent_conversation, updated_at DESC)
WHERE is_archived = FALSE AND is_recent_conversation = TRUE;

-- 사용자별 분석 리포트
CREATE INDEX IF NOT EXISTS idx_conv_report_sidebar
ON public.conversations (user_id, is_archived, is_analysis_report, updated_at DESC)
WHERE is_archived = FALSE AND is_analysis_report = TRUE;

-- 핀 고정 대화 우선 정렬
CREATE INDEX IF NOT EXISTS idx_conv_pinned_sidebar
ON public.conversations (user_id, is_archived, is_pinned, updated_at DESC)
WHERE is_archived = FALSE;

-- case_id로 빠른 조회
CREATE INDEX IF NOT EXISTS idx_conv_case_id
ON public.conversations (case_id)
WHERE case_id IS NOT NULL;

-- ===========================
-- 3. 사이드바 전용 뷰 생성 (v2_cases 조인 포함)
-- ===========================

DROP VIEW IF EXISTS public.sidebar_conversations;

CREATE VIEW public.sidebar_conversations
WITH (security_invoker = true) AS
SELECT
  -- 대화 기본 정보
  c.id,
  c.user_id,
  c.title,
  c.property_address,
  c.contract_type,
  c.analysis_status,
  c.is_archived,
  c.is_recent_conversation,
  c.is_analysis_report,
  c.is_pinned,
  c.case_id,
  c.meta,
  c.created_at,
  c.updated_at,

  -- v2_cases 조인 (분석 리포트인 경우)
  vc.property_address AS case_property_address,
  vc.contract_type AS case_contract_type,
  vc.current_state AS case_state,
  vc.metadata AS case_metadata

FROM public.conversations c
LEFT JOIN public.v2_cases vc
  ON vc.id = c.case_id

WHERE
  c.user_id = auth.uid()       -- RLS: 내 대화만
  AND c.is_archived = FALSE     -- 아카이브 제외

ORDER BY
  c.is_pinned DESC,              -- 핀 고정 우선
  c.updated_at DESC;             -- 최근 업데이트 순

COMMENT ON VIEW public.sidebar_conversations IS 'GPT 스타일 사이드바 전용 뷰 (RLS + v2_cases 조인)';

-- ===========================
-- 4. 뷰 권한 부여
-- ===========================

GRANT SELECT ON public.sidebar_conversations TO authenticated;

-- ===========================
-- 5. 기존 데이터 마이그레이션
-- ===========================

-- case_id가 있는 대화는 자동으로 분석 리포트로 태깅
UPDATE public.conversations
SET is_analysis_report = TRUE
WHERE case_id IS NOT NULL
  AND is_analysis_report = FALSE;

-- ===========================
-- 6. Helper Functions
-- ===========================

-- 대화 핀 토글 (UUID 기반)
CREATE OR REPLACE FUNCTION public.toggle_conversation_pin(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_current_pinned BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 현재 핀 상태 조회 (권한 확인 포함)
  SELECT c.is_pinned INTO v_current_pinned
  FROM public.conversations c
  WHERE c.id = p_conversation_id
    AND c.user_id = v_user_id
  LIMIT 1;

  IF v_current_pinned IS NULL THEN
    RAISE EXCEPTION 'Conversation not found or access denied';
  END IF;

  -- 토글
  UPDATE public.conversations
  SET
    is_pinned = NOT v_current_pinned,
    updated_at = NOW()
  WHERE id = p_conversation_id;

  RETURN NOT v_current_pinned;
END;
$$;

COMMENT ON FUNCTION public.toggle_conversation_pin IS '대화 핀 고정/해제 토글 (RLS 적용)';

-- 대화 아카이브 (UUID 기반)
CREATE OR REPLACE FUNCTION public.archive_conversation(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 권한 확인 후 아카이브
  UPDATE public.conversations
  SET
    is_archived = TRUE,
    is_recent_conversation = FALSE,  -- 최근 대화에서 제거
    updated_at = NOW()
  WHERE id = p_conversation_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found or access denied';
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.archive_conversation IS '대화 아카이브 (최근 대화에서 제거, RLS 적용)';

-- 대화 복원 (UUID 기반)
CREATE OR REPLACE FUNCTION public.unarchive_conversation(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 권한 확인 후 복원
  UPDATE public.conversations
  SET
    is_archived = FALSE,
    is_recent_conversation = TRUE,  -- 최근 대화로 복원
    updated_at = NOW()
  WHERE id = p_conversation_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found or access denied';
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.unarchive_conversation IS '대화 복원 (아카이브 해제, RLS 적용)';

-- ===========================
-- 7. 권한 부여
-- ===========================

GRANT EXECUTE ON FUNCTION public.toggle_conversation_pin TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.unarchive_conversation TO authenticated;

COMMIT;

-- ===========================
-- 롤백 스크립트 (필요 시 실행)
-- ===========================
-- BEGIN;
-- DROP VIEW IF EXISTS public.sidebar_conversations;
-- DROP FUNCTION IF EXISTS public.toggle_conversation_pin;
-- DROP FUNCTION IF EXISTS public.archive_conversation;
-- DROP FUNCTION IF EXISTS public.unarchive_conversation;
-- ALTER TABLE public.conversations DROP COLUMN IF EXISTS is_pinned;
-- ALTER TABLE public.conversations DROP COLUMN IF EXISTS is_archived;
-- DROP INDEX IF EXISTS idx_conv_recent_sidebar;
-- DROP INDEX IF EXISTS idx_conv_report_sidebar;
-- DROP INDEX IF EXISTS idx_conv_pinned_sidebar;
-- DROP INDEX IF EXISTS idx_conv_case_id;
-- COMMIT;
