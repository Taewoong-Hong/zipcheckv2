-- ZipCheck Chat Persistence & Session Architecture
-- 메시지 단위 실시간 영구 저장 + 스트리밍 + 감사로그 + 검색
-- Migration: 011_chat_persistence_architecture.sql

-- =================================================================
-- 1. 대화방 (conversations)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,                    -- ulid
  title TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,     -- 추가 메타데이터 (태그, 카테고리 등)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON public.conversations (created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations (created_at DESC);

COMMENT ON TABLE public.conversations IS '채팅 대화방 - 사용자별 대화 세션 관리';

-- =================================================================
-- 2. 참여자 (conversation_participants)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'member', 'viewer')) DEFAULT 'owner',
  can_post BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_user_id ON public.conversation_participants (user_id);

COMMENT ON TABLE public.conversation_participants IS '대화 참여자 권한 관리';

-- =================================================================
-- 3. 메시지 (messages) - 확정된 메시지
-- =================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,                              -- ulid (client or server-generated)
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES public.messages(id) ON DELETE SET NULL,  -- 스레드/답글
  author_type TEXT CHECK (author_type IN ('user', 'assistant', 'system')) NOT NULL,
  author_id UUID REFERENCES auth.users(id),         -- user일 때만 채움
  content JSONB NOT NULL,                           -- {type:"text|rich|tool", text:"...", blocks:[...], componentType?:string}
  status TEXT CHECK (status IN ('pending', 'streaming', 'completed', 'failed', 'deleted')) DEFAULT 'completed',
  client_message_id TEXT,                           -- idempotency key (from client)
  model_id TEXT,                                    -- 사용한 LLM 모델
  usage_id TEXT,                                    -- usage_stats FK (나중에 추가)
  metadata JSONB DEFAULT '{}'::jsonb,               -- 추가 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotency: 동일 클라이언트 메시지 ID는 중복 저장 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_unique_client_key
  ON public.messages (conversation_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_time ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_author ON public.messages (author_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages (status) WHERE status IN ('pending', 'streaming');

COMMENT ON TABLE public.messages IS '확정된 채팅 메시지 - React 상태의 영구 저장소';
COMMENT ON COLUMN public.messages.client_message_id IS 'Idempotency key - 클라이언트 재시도 시 중복 방지';

-- =================================================================
-- 4. 스트리밍 청크 (message_chunks)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.message_chunks (
  id BIGSERIAL PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  seq INT NOT NULL,                                 -- 0, 1, 2, ... (순서)
  delta TEXT NOT NULL,                              -- 토큰/문자열 델타
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_chunks_message_seq ON public.message_chunks (message_id, seq);

COMMENT ON TABLE public.message_chunks IS 'SSE 스트리밍 중 실시간 청크 저장';

-- =================================================================
-- 5. 첨부파일 (attachments)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.attachments (
  id TEXT PRIMARY KEY,                              -- ulid
  message_id TEXT NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,                           -- Supabase Storage URL (public or signed)
  mime_type TEXT,
  file_size BIGINT,                                 -- bytes
  metadata JSONB DEFAULT '{}'::jsonb,               -- 원본 파일명, 업로드 시간 등
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON public.attachments (message_id);

COMMENT ON TABLE public.attachments IS '메시지 첨부파일 메타데이터';

-- =================================================================
-- 6. 반응/피드백 (reactions)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.reactions (
  message_id TEXT NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,                              -- 👍, 👎, ❤️ 등
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON public.reactions (message_id);

COMMENT ON TABLE public.reactions IS '메시지 이모지 반응 (사용자 피드백)';

-- =================================================================
-- 7. 이벤트/감사로그 (events)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.events (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES public.messages(id) ON DELETE SET NULL,
  type TEXT NOT NULL,                               -- 'message.created', 'message.updated', 'stream.started', 'stream.completed', 'message.deleted', 'participant.joined' 등
  actor UUID REFERENCES auth.users(id),             -- 누가 이 이벤트를 발생시켰는지
  payload JSONB DEFAULT '{}'::jsonb,                -- 추가 정보
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_conversation_time ON public.events (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events (type);

COMMENT ON TABLE public.events IS '모든 대화 상태 변경 감사 로그';

-- =================================================================
-- 8. 모델 스냅샷 (models) - 선택적
-- =================================================================
CREATE TABLE IF NOT EXISTS public.models (
  id TEXT PRIMARY KEY,                              -- 'gpt-4o-mini', 'claude-3-5-sonnet', 'gemini-1.5-pro' 등
  provider TEXT NOT NULL,                           -- 'openai', 'anthropic', 'google'
  params JSONB DEFAULT '{}'::jsonb,                 -- temperature, top_p, max_tokens 등
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.models IS 'LLM 모델 스펙 스냅샷';

-- =================================================================
-- 9. 사용량 집계 (usage_stats)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.usage_stats (
  id TEXT PRIMARY KEY,                              -- ulid
  conversation_id TEXT REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id TEXT REFERENCES public.messages(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,                           -- 'openai', 'anthropic', 'google'
  model TEXT NOT NULL,                              -- 'gpt-4o-mini', 'claude-3-5-sonnet' 등
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  cost NUMERIC(12, 6) DEFAULT 0,                    -- USD 단위
  metadata JSONB DEFAULT '{}'::jsonb,               -- 추가 정보
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_conversation ON public.usage_stats (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_provider_model ON public.usage_stats (provider, model);

COMMENT ON TABLE public.usage_stats IS 'LLM 토큰 사용량 및 비용 집계';

-- =================================================================
-- 10. 메시지 검색 (message_search) - TSVector 전문검색
-- =================================================================
CREATE TABLE IF NOT EXISTS public.message_search (
  message_id TEXT PRIMARY KEY REFERENCES public.messages(id) ON DELETE CASCADE,
  tsv TSVECTOR,                                     -- 한국어 형태소 분석 후 저장
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_search_gin ON public.message_search USING GIN(tsv);

COMMENT ON TABLE public.message_search IS '메시지 전문검색 인덱스 (PostgreSQL TSVector)';

-- =================================================================
-- 11. 벡터 임베딩 (message_embeddings) - pgvector 활성화 필요
-- =================================================================
-- pgvector extension 활성화 (Supabase에서는 기본 활성화됨)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.message_embeddings (
  message_id TEXT PRIMARY KEY REFERENCES public.messages(id) ON DELETE CASCADE,
  embedding VECTOR(1536),                           -- OpenAI text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW 인덱스 (pgvector ≥0.7.0)
CREATE INDEX IF NOT EXISTS idx_message_embeddings_hnsw
  ON public.message_embeddings
  USING hnsw (embedding vector_cosine_ops);

COMMENT ON TABLE public.message_embeddings IS '메시지 벡터 임베딩 (시맨틱 검색)';

-- =================================================================
-- 12. 스레드 (threads) - 선택적
-- =================================================================
CREATE TABLE IF NOT EXISTS public.threads (
  id TEXT PRIMARY KEY,                              -- ulid
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  root_message_id TEXT NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threads_conversation ON public.threads (conversation_id);
CREATE INDEX IF NOT EXISTS idx_threads_root ON public.threads (root_message_id);

COMMENT ON TABLE public.threads IS '메시지 스레드 (답글 그룹화)';

-- =================================================================
-- 13. RLS (Row Level Security) 정책
-- =================================================================

-- RLS 활성화
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;  -- 읽기 제한 또는 서비스 롤만

-- 참여자 판별 함수
CREATE OR REPLACE FUNCTION public.is_participant(conv_id TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conv_id AND cp.user_id = auth.uid()
  );
$$;

-- conversations: 본인이 참여자인 레코드만 열람
CREATE POLICY "conversations_select_participants" ON public.conversations
  FOR SELECT USING (public.is_participant(id));

-- 생성: 본인만 생성 가능 (생성 시 자신을 참여자로 추가하는 RPC 필요)
CREATE POLICY "conversations_insert_self" ON public.conversations
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- 업데이트: 참여자만
CREATE POLICY "conversations_update_participants" ON public.conversations
  FOR UPDATE USING (public.is_participant(id));

-- conversation_participants: 참여자 목록 조회
CREATE POLICY "participants_select_participants" ON public.conversation_participants
  FOR SELECT USING (public.is_participant(conversation_id));

-- messages: 해당 대화 참여자만 접근
CREATE POLICY "messages_select_participants" ON public.messages
  FOR SELECT USING (public.is_participant(conversation_id));

CREATE POLICY "messages_insert_participants" ON public.messages
  FOR INSERT WITH CHECK (public.is_participant(conversation_id));

CREATE POLICY "messages_update_participants" ON public.messages
  FOR UPDATE USING (public.is_participant(conversation_id));

-- message_chunks: 메시지 참여자만
CREATE POLICY "chunks_select_participants" ON public.message_chunks
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_participant(m.conversation_id))
  );

CREATE POLICY "chunks_insert_participants" ON public.message_chunks
  FOR INSERT WITH CHECK (
    EXISTS(SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_participant(m.conversation_id))
  );

-- attachments: 메시지 참여자만
CREATE POLICY "attachments_select_participants" ON public.attachments
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_participant(m.conversation_id))
  );

CREATE POLICY "attachments_insert_participants" ON public.attachments
  FOR INSERT WITH CHECK (
    EXISTS(SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_participant(m.conversation_id))
  );

-- reactions: 메시지 참여자만
CREATE POLICY "reactions_select_participants" ON public.reactions
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_participant(m.conversation_id))
  );

CREATE POLICY "reactions_insert_self" ON public.reactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS(SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_participant(m.conversation_id))
  );

CREATE POLICY "reactions_delete_self" ON public.reactions
  FOR DELETE USING (user_id = auth.uid());

-- events: 서비스 롤만 접근 (ANON 차단)
-- SELECT 정책 없음 → authenticated 유저도 기본적으로 차단
-- 필요 시 관리자 역할에만 허용하는 정책 추가

-- =================================================================
-- 14. 헬퍼 함수 (RPC)
-- =================================================================

-- 대화방 생성 + 본인 참여자 등록 (트랜잭션)
CREATE OR REPLACE FUNCTION public.create_conversation(
  p_conversation_id TEXT,
  p_title TEXT DEFAULT NULL
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 대화방 생성
  INSERT INTO public.conversations (id, title, created_by)
  VALUES (p_conversation_id, p_title, v_user_id);

  -- 본인을 owner로 추가
  INSERT INTO public.conversation_participants (conversation_id, user_id, role)
  VALUES (p_conversation_id, v_user_id, 'owner');

  RETURN p_conversation_id;
END;
$$;

COMMENT ON FUNCTION public.create_conversation IS '대화방 생성 + 본인 참여자 자동 등록';

-- 메시지 추가 (Idempotent)
CREATE OR REPLACE FUNCTION public.upsert_message(
  p_message_id TEXT,
  p_conversation_id TEXT,
  p_author_type TEXT,
  p_content JSONB,
  p_client_message_id TEXT DEFAULT NULL,
  p_parent_id TEXT DEFAULT NULL
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_existing_id TEXT;
BEGIN
  v_user_id := auth.uid();

  -- 참여자 확인
  IF NOT public.is_participant(p_conversation_id) THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;

  -- Idempotency: client_message_id가 있으면 기존 레코드 확인
  IF p_client_message_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.messages
    WHERE conversation_id = p_conversation_id
      AND client_message_id = p_client_message_id;

    IF v_existing_id IS NOT NULL THEN
      -- 이미 존재하면 기존 ID 반환 (중복 저장 방지)
      RETURN v_existing_id;
    END IF;
  END IF;

  -- 새 메시지 생성
  INSERT INTO public.messages (
    id, conversation_id, parent_id, author_type, author_id, content, client_message_id, status
  ) VALUES (
    p_message_id, p_conversation_id, p_parent_id, p_author_type,
    CASE WHEN p_author_type = 'user' THEN v_user_id ELSE NULL END,
    p_content, p_client_message_id, 'completed'
  );

  -- 이벤트 로그 (Service Role에서만 접근 가능하므로 여기서 직접 INSERT)
  INSERT INTO public.events (conversation_id, message_id, type, actor, payload)
  VALUES (p_conversation_id, p_message_id, 'message.created', v_user_id, '{}'::jsonb);

  RETURN p_message_id;
END;
$$;

COMMENT ON FUNCTION public.upsert_message IS 'Idempotent 메시지 생성 - 클라이언트 재시도 시 중복 방지';

-- =================================================================
-- 15. Triggers (자동 업데이트)
-- =================================================================

-- conversations.updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.update_conversation_timestamp();

-- messages.updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.update_message_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.update_message_timestamp();

-- 메시지 검색 인덱스 자동 생성/갱신
CREATE OR REPLACE FUNCTION public.update_message_search_index()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- content.text 필드에서 텍스트 추출 후 TSVector 생성
  INSERT INTO public.message_search (message_id, tsv)
  VALUES (
    NEW.id,
    to_tsvector('simple', COALESCE(NEW.content->>'text', ''))
  )
  ON CONFLICT (message_id) DO UPDATE
  SET tsv = to_tsvector('simple', COALESCE(NEW.content->>'text', ''));

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_message_search_index
AFTER INSERT OR UPDATE ON public.messages
FOR EACH ROW
WHEN (NEW.content IS NOT NULL AND NEW.status = 'completed')
EXECUTE FUNCTION public.update_message_search_index();

-- =================================================================
-- 16. Materialized View (사용량 일별 집계) - 선택적
-- =================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.usage_daily AS
SELECT
  DATE_TRUNC('day', created_at) AS day,
  provider,
  model,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cost) AS total_cost
FROM public.usage_stats
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_daily_unique ON public.usage_daily (day, provider, model);

COMMENT ON MATERIALIZED VIEW public.usage_daily IS '일별 LLM 사용량 집계 (배치 작업으로 REFRESH)';

-- =================================================================
-- 완료
-- =================================================================
