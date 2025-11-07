"""
대화 영속화 API (Conversations & Messages)

Supabase 기반 채팅 영구 저장소 + SSE 스트리밍 + Idempotency
"""
import logging
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from core.supabase_client import get_supabase_client
from core.auth import get_current_user
from core.llm_router import single_model_analyze
import json
import ulid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversations", tags=["conversations"])


# ===========================
# Request/Response Models
# ===========================
class CreateConversationRequest(BaseModel):
    """대화방 생성 요청"""
    title: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ConversationResponse(BaseModel):
    """대화방 응답"""
    id: str
    title: Optional[str]
    created_by: Optional[str]
    is_archived: bool
    metadata: Dict[str, Any]
    created_at: str
    updated_at: str


class CreateMessageRequest(BaseModel):
    """메시지 생성 요청"""
    conversation_id: str
    content: Dict[str, Any]  # {type: "text", text: "...", blocks?: [...]}
    parent_id: Optional[str] = None
    client_message_id: Optional[str] = None  # Idempotency key


class MessageResponse(BaseModel):
    """메시지 응답"""
    id: str
    conversation_id: str
    parent_id: Optional[str]
    author_type: str
    author_id: Optional[str]
    content: Dict[str, Any]
    status: str
    client_message_id: Optional[str]
    created_at: str
    updated_at: str


class PaginationParams(BaseModel):
    """페이지네이션 파라미터"""
    cursor: Optional[str] = None  # 마지막 메시지 ID (ULID 정렬)
    limit: int = Field(default=50, ge=1, le=100)


# ===========================
# API Endpoints
# ===========================

@router.post("", response_model=ConversationResponse, status_code=201)
async def create_conversation(
    request: CreateConversationRequest,
    user: dict = Depends(get_current_user)
):
    """
    대화방 생성 + 본인 참여자 자동 등록 (트랜잭션)

    - Supabase RPC `create_conversation` 사용
    - 자동으로 본인을 owner로 등록
    """
    supabase = get_supabase_client()
    conversation_id = str(ulid.new())

    try:
        # RPC 호출: 대화방 생성 + 참여자 등록 (트랜잭션)
        result = supabase.rpc(
            'create_conversation',
            {
                'p_conversation_id': conversation_id,
                'p_title': request.title
            }
        ).execute()

        if not result.data:
            raise HTTPException(500, "Failed to create conversation")

        # 생성된 대화방 조회
        conv_response = supabase.table("conversations") \
            .select("*") \
            .eq("id", conversation_id) \
            .execute()

        if not conv_response.data:
            raise HTTPException(500, "Conversation created but not found")

        conversation = conv_response.data[0]

        logger.info(f"대화방 생성 완료: {conversation_id}, user={user['sub']}")

        return ConversationResponse(
            id=conversation['id'],
            title=conversation.get('title'),
            created_by=conversation.get('created_by'),
            is_archived=conversation.get('is_archived', False),
            metadata=conversation.get('metadata', {}),
            created_at=conversation['created_at'],
            updated_at=conversation['updated_at']
        )

    except Exception as e:
        logger.error(f"대화방 생성 실패: {e}", exc_info=True)
        raise HTTPException(500, f"Failed to create conversation: {str(e)}")


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    user: dict = Depends(get_current_user)
):
    """
    대화방 정보 조회

    - RLS: 참여자만 조회 가능
    """
    supabase = get_supabase_client()

    try:
        response = supabase.table("conversations") \
            .select("*") \
            .eq("id", conversation_id) \
            .execute()

        if not response.data:
            raise HTTPException(404, "Conversation not found or access denied")

        conversation = response.data[0]

        return ConversationResponse(
            id=conversation['id'],
            title=conversation.get('title'),
            created_by=conversation.get('created_by'),
            is_archived=conversation.get('is_archived', False),
            metadata=conversation.get('metadata', {}),
            created_at=conversation['created_at'],
            updated_at=conversation['updated_at']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화방 조회 실패: {e}", exc_info=True)
        raise HTTPException(500, f"Failed to get conversation: {str(e)}")


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
async def list_messages(
    conversation_id: str,
    cursor: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """
    메시지 목록 조회 (페이지네이션)

    - RLS: 참여자만 조회 가능
    - 커서 기반 페이지네이션 (created_at DESC, id)
    """
    supabase = get_supabase_client()

    try:
        # 대화방 참여자 확인 (RLS가 자동으로 처리하지만 명시적 확인)
        conv_check = supabase.table("conversations") \
            .select("id") \
            .eq("id", conversation_id) \
            .execute()

        if not conv_check.data:
            raise HTTPException(404, "Conversation not found or access denied")

        # 메시지 조회
        query = supabase.table("messages") \
            .select("*") \
            .eq("conversation_id", conversation_id) \
            .order("created_at", desc=True) \
            .limit(limit)

        # 커서 기반 페이지네이션
        if cursor:
            # cursor는 이전 조회의 마지막 메시지 ID
            # created_at이 cursor 메시지보다 작은 것만 조회
            cursor_msg = supabase.table("messages") \
                .select("created_at") \
                .eq("id", cursor) \
                .execute()

            if cursor_msg.data:
                cursor_time = cursor_msg.data[0]['created_at']
                query = query.lt("created_at", cursor_time)

        response = query.execute()

        messages = [
            MessageResponse(
                id=msg['id'],
                conversation_id=msg['conversation_id'],
                parent_id=msg.get('parent_id'),
                author_type=msg['author_type'],
                author_id=msg.get('author_id'),
                content=msg['content'],
                status=msg['status'],
                client_message_id=msg.get('client_message_id'),
                created_at=msg['created_at'],
                updated_at=msg['updated_at']
            )
            for msg in response.data
        ]

        logger.info(f"메시지 조회 완료: {len(messages)}개, conversation={conversation_id}")

        return messages

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메시지 조회 실패: {e}", exc_info=True)
        raise HTTPException(500, f"Failed to list messages: {str(e)}")


@router.post("/messages", response_model=MessageResponse, status_code=201)
async def create_message(
    request: CreateMessageRequest,
    user: dict = Depends(get_current_user),
    x_idempotency_key: Optional[str] = Header(None)
):
    """
    메시지 생성 (Idempotent)

    - Idempotency: client_message_id 또는 X-Idempotency-Key 헤더 사용
    - 동일 키로 재시도 시 기존 메시지 반환 (중복 저장 방지)
    - 유저 메시지는 바로 completed 상태로 저장
    """
    supabase = get_supabase_client()

    # Idempotency key 결정
    client_message_id = request.client_message_id or x_idempotency_key

    if not client_message_id:
        # Idempotency key가 없으면 생성 (권장하지 않음)
        logger.warning("No idempotency key provided, generating one")
        client_message_id = str(ulid.new())

    message_id = str(ulid.new())

    try:
        # RPC 호출: Idempotent 메시지 생성
        result = supabase.rpc(
            'upsert_message',
            {
                'p_message_id': message_id,
                'p_conversation_id': request.conversation_id,
                'p_author_type': 'user',
                'p_content': json.dumps(request.content),
                'p_client_message_id': client_message_id,
                'p_parent_id': request.parent_id
            }
        ).execute()

        if not result.data:
            raise HTTPException(500, "Failed to create message")

        # 반환된 ID로 메시지 조회
        returned_id = result.data

        msg_response = supabase.table("messages") \
            .select("*") \
            .eq("id", returned_id) \
            .execute()

        if not msg_response.data:
            raise HTTPException(500, "Message created but not found")

        message = msg_response.data[0]

        logger.info(f"메시지 생성 완료: {returned_id}, conversation={request.conversation_id}")

        return MessageResponse(
            id=message['id'],
            conversation_id=message['conversation_id'],
            parent_id=message.get('parent_id'),
            author_type=message['author_type'],
            author_id=message.get('author_id'),
            content=message['content'],
            status=message['status'],
            client_message_id=message.get('client_message_id'),
            created_at=message['created_at'],
            updated_at=message['updated_at']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메시지 생성 실패: {e}", exc_info=True)
        raise HTTPException(500, f"Failed to create message: {str(e)}")


@router.get("/messages/{message_id}/stream")
async def stream_message(
    message_id: str,
    user: dict = Depends(get_current_user)
):
    """
    메시지 스트리밍 (SSE)

    - 어시스턴트 메시지 생성 시 스트리밍 청크 실시간 전송
    - message_chunks 테이블에서 실시간 조회
    """
    supabase = get_supabase_client()

    async def event_generator():
        """SSE 이벤트 생성기"""
        try:
            # 메시지 존재 확인
            msg_check = supabase.table("messages") \
                .select("*") \
                .eq("id", message_id) \
                .execute()

            if not msg_check.data:
                yield f"event: error\ndata: {json.dumps({'error': 'Message not found'})}\n\n"
                return

            message = msg_check.data[0]

            # 참여자 확인
            conv_check = supabase.table("conversations") \
                .select("id") \
                .eq("id", message['conversation_id']) \
                .execute()

            if not conv_check.data:
                yield f"event: error\ndata: {json.dumps({'error': 'Access denied'})}\n\n"
                return

            # 스트리밍 시작 이벤트
            yield f"event: stream.started\ndata: {json.dumps({'message_id': message_id})}\n\n"

            # message_chunks 실시간 조회 (폴링 방식)
            last_seq = -1
            max_wait_seconds = 60  # 최대 60초 대기
            elapsed = 0

            while elapsed < max_wait_seconds:
                # 새 청크 조회
                chunks_response = supabase.table("message_chunks") \
                    .select("*") \
                    .eq("message_id", message_id) \
                    .gt("seq", last_seq) \
                    .order("seq") \
                    .execute()

                if chunks_response.data:
                    for chunk in chunks_response.data:
                        yield f"event: delta\ndata: {json.dumps({'seq': chunk['seq'], 'delta': chunk['delta']})}\n\n"
                        last_seq = chunk['seq']

                # 메시지 상태 확인
                status_check = supabase.table("messages") \
                    .select("status") \
                    .eq("id", message_id) \
                    .execute()

                if status_check.data:
                    status = status_check.data[0]['status']
                    if status == 'completed':
                        yield f"event: stream.completed\ndata: {json.dumps({'message_id': message_id})}\n\n"
                        break
                    elif status == 'failed':
                        yield f"event: stream.failed\ndata: {json.dumps({'message_id': message_id})}\n\n"
                        break

                # 0.5초 대기
                await asyncio.sleep(0.5)
                elapsed += 0.5

            # 타임아웃
            if elapsed >= max_wait_seconds:
                yield f"event: stream.timeout\ndata: {json.dumps({'message_id': message_id})}\n\n"

        except Exception as e:
            logger.error(f"스트리밍 오류: {e}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/messages/{message_id}/finalize")
async def finalize_message(
    message_id: str,
    user: dict = Depends(get_current_user)
):
    """
    메시지 스트리밍 종료 및 확정

    - message_chunks를 합쳐서 messages.content 업데이트
    - status를 completed로 변경
    """
    supabase = get_supabase_client()

    try:
        # 메시지 조회
        msg_response = supabase.table("messages") \
            .select("*") \
            .eq("id", message_id) \
            .execute()

        if not msg_response.data:
            raise HTTPException(404, "Message not found")

        message = msg_response.data[0]

        # 참여자 확인
        conv_check = supabase.table("conversations") \
            .select("id") \
            .eq("id", message['conversation_id']) \
            .execute()

        if not conv_check.data:
            raise HTTPException(403, "Access denied")

        # message_chunks 조회
        chunks_response = supabase.table("message_chunks") \
            .select("*") \
            .eq("message_id", message_id) \
            .order("seq") \
            .execute()

        # 청크 합치기
        full_text = "".join([chunk['delta'] for chunk in chunks_response.data])

        # messages.content 업데이트
        update_response = supabase.table("messages") \
            .update({
                'content': json.dumps({'type': 'text', 'text': full_text}),
                'status': 'completed'
            }) \
            .eq("id", message_id) \
            .execute()

        if not update_response.data:
            raise HTTPException(500, "Failed to finalize message")

        logger.info(f"메시지 확정 완료: {message_id}, chunks={len(chunks_response.data)}")

        return {"message_id": message_id, "status": "completed"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메시지 확정 실패: {e}", exc_info=True)
        raise HTTPException(500, f"Failed to finalize message: {str(e)}")


@router.get("/{conversation_id}/search")
async def search_messages(
    conversation_id: str,
    q: str,
    limit: int = 20,
    user: dict = Depends(get_current_user)
):
    """
    메시지 검색 (TSVector 전문검색)

    - message_search 테이블 사용
    - 한국어 형태소 분석 후 검색 (향후 개선)
    """
    supabase = get_supabase_client()

    try:
        # 참여자 확인
        conv_check = supabase.table("conversations") \
            .select("id") \
            .eq("id", conversation_id) \
            .execute()

        if not conv_check.data:
            raise HTTPException(404, "Conversation not found or access denied")

        # 전문검색 쿼리 (Supabase에서는 RPC 필요)
        # 간단 버전: LIKE 검색
        messages_response = supabase.table("messages") \
            .select("*") \
            .eq("conversation_id", conversation_id) \
            .ilike("content->>text", f"%{q}%") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()

        results = [
            MessageResponse(
                id=msg['id'],
                conversation_id=msg['conversation_id'],
                parent_id=msg.get('parent_id'),
                author_type=msg['author_type'],
                author_id=msg.get('author_id'),
                content=msg['content'],
                status=msg['status'],
                client_message_id=msg.get('client_message_id'),
                created_at=msg['created_at'],
                updated_at=msg['updated_at']
            )
            for msg in messages_response.data
        ]

        logger.info(f"메시지 검색 완료: {len(results)}개, query={q}")

        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메시지 검색 실패: {e}", exc_info=True)
        raise HTTPException(500, f"Failed to search messages: {str(e)}")
