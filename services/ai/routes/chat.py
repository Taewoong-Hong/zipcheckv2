"""
채팅 API 라우터
기존 conversations/messages 테이블 활용 + Idempotency + SSE Streaming
"""

from fastapi import APIRouter, HTTPException, Depends, status, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, AsyncGenerator
from uuid import UUID
import logging
import asyncio
import json
from datetime import datetime

from core.auth import get_current_user
from core.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["채팅"])


# ============== 헬퍼 함수 ==============

async def update_conversation_title(
    supabase,
    conversation_id: str,
    property_address: Optional[str],
    contract_type: Optional[str],
    first_user_message: Optional[str] = None
):
    """
    대화 제목 자동 생성

    우선순위:
    1. 주소 + 계약 유형: "서울 강남구 역삼동 전세 분석"
    2. 주소만: "서울 강남구 역삼동"
    3. 첫 번째 의미 있는 질문 내용 요약 (최대 30자)
    4. 없으면: 제목 업데이트 안 함 (기존 "새 대화" 유지)
    """
    try:
        title = None

        if property_address and contract_type:
            # 우선순위 1: 주소 + 계약 유형 (최대 40자)
            short_address = property_address[:30] + "..." if len(property_address) > 30 else property_address
            title = f"{short_address} {contract_type} 분석"
        elif property_address:
            # 우선순위 2: 주소만 (최대 40자)
            title = property_address[:40] + "..." if len(property_address) > 40 else property_address
        elif first_user_message:
            # 우선순위 3: 첫 번째 질문 내용 요약 (최대 30자)
            # 개행 제거 및 공백 정리
            cleaned_message = first_user_message.replace('\n', ' ').strip()
            if len(cleaned_message) > 30:
                title = cleaned_message[:30] + "..."
            else:
                title = cleaned_message

        if title:
            supabase.table("conversations").update({
                "title": title
            }).eq("id", conversation_id).execute()

            logger.info(f"대화 제목 업데이트: conversation_id={conversation_id}, title={title}")

    except Exception as e:
        logger.warning(f"대화 제목 업데이트 실패(무시): {e}")


# ============== 요청/응답 스키마 ==============

class CreateConversationResponse(BaseModel):
    """새 대화 시작 응답"""
    conversation_id: str
    message: str


class SendMessageRequest(BaseModel):
    """메시지 전송 요청 (idempotency 지원)"""
    conversation_id: str = Field(..., description="대화 ID")
    content: str = Field(..., min_length=1, max_length=5000, description="메시지 내용")
    client_message_id: Optional[str] = Field(None, description="클라이언트 생성 메시지 ID (idempotency key, ULID 권장)")
    component_type: Optional[str] = Field(None, description="UI 컴포넌트 타입")
    component_data: Optional[dict] = Field(None, description="UI 컴포넌트 데이터")


class Message(BaseModel):
    """메시지 모델"""
    id: int
    role: Literal["user", "assistant", "system"]
    content: str
    component_type: Optional[str] = None
    component_data: Optional[dict] = None
    created_at: str


class GetMessagesResponse(BaseModel):
    """메시지 목록 응답"""
    conversation_id: str
    messages: List[Message]
    total: int


class RecentConversation(BaseModel):
    """최근 대화 항목"""
    id: str
    title: Optional[str] = None
    property_address: Optional[str] = None
    contract_type: Optional[str] = None
    analysis_status: str
    last_user_message: Optional[str] = None
    message_count: int
    created_at: str
    updated_at: str


class GetRecentConversationsResponse(BaseModel):
    """최근 대화 목록 응답"""
    conversations: List[RecentConversation]
    total: int


class UpdateConversationRequest(BaseModel):
    """대화 정보 업데이트 요청"""
    property_address: Optional[str] = Field(None, description="부동산 주소")
    contract_type: Optional[str] = Field(None, description="계약 유형 (전세/매매/월세)")
    analysis_status: Optional[str] = Field(None, description="분석 상태")


# ============== API 엔드포인트 ==============

@router.post("/init", response_model=CreateConversationResponse)
async def init_chat(user: dict = Depends(get_current_user)):
    """
    새 채팅 세션 시작 (대화 생성 + 환영 메시지)
    """
    user_id = user["sub"]
    logger.info(f"채팅 초기화: user_id={user_id}")

    try:
        supabase = get_supabase_client(service_role=True)

        # 1. conversations 생성 (카테고리 자동 설정)
        conv_result = supabase.table("conversations").insert({
            "user_id": user_id,
            "title": "새 대화",
            "analysis_status": "pending",
            "is_recent_conversation": True,  # 모든 대화는 기본적으로 최근 대화
            "is_analysis_report": False,     # 분석 완료 시 TRUE로 변경됨
            "case_id": None                  # 분석 리포트 연동 시 설정
        }).execute()

        if not conv_result.data:
            raise HTTPException(500, "대화 생성 실패")

        conversation_id = conv_result.data[0]["id"]

        # 2. 환영 메시지 추가
        welcome_msg = """안녕하세요! 집체크입니다. 🏡

부동산 계약 리스크 분석을 도와드리겠습니다.

먼저 **분석하고 싶은 부동산의 주소**를 입력해주세요.
(도로명 주소 또는 지번 주소 모두 가능합니다)"""

        # Store extended info in 'meta' JSON to match DB schema
        supabase.table("messages").insert({
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": welcome_msg,
            "meta": {
                "topic": "contract_analysis",
                "extension": "chat"
            }
        }).execute()

        logger.info(f"새 대화 생성: conversation_id={conversation_id}")

        return CreateConversationResponse(
            conversation_id=str(conversation_id),
            message="새 대화가 시작되었습니다"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"채팅 초기화 오류: {e}")
        raise HTTPException(500, f"채팅 초기화 실패: {str(e)}")


@router.post("/message")
async def send_message(
    request: SendMessageRequest,
    user: dict = Depends(get_current_user),
    x_idempotency_key: Optional[str] = Header(None)
):
    """
    메시지 전송 (사용자 메시지 저장) - Idempotent

    클라이언트는 client_message_id (ULID) 또는 X-Idempotency-Key 헤더를 전송하여
    네트워크 재시도 시 중복 메시지 방지
    """
    user_id = user["sub"]
    logger.info(f"메시지 전송: user_id={user_id}, conversation_id={request.conversation_id}")

    try:
        supabase = get_supabase_client(service_role=True)

        # 1. 대화 소유권 확인
        conv_check = supabase.table("conversations") \
            .select("id") \
            .eq("id", request.conversation_id) \
            .eq("user_id", user_id) \
            .execute()

        if not conv_check.data:
            raise HTTPException(404, "대화를 찾을 수 없거나 권한이 없습니다")

        # 2. Idempotency 체크
        idempotency_key = request.client_message_id or x_idempotency_key

        if idempotency_key:
            # 동일 키로 이미 생성된 메시지가 있는지 확인
            existing = supabase.table("messages") \
                .select("id, conversation_id, role, content, created_at, meta") \
                .eq("conversation_id", request.conversation_id) \
                .execute()

            for msg in (existing.data or []):
                meta = msg.get("meta") or {}
                if meta.get("client_message_id") == idempotency_key:
                    logger.info(f"Idempotent 응답: message_id={msg['id']}, key={idempotency_key}")
                    return {
                        "ok": True,
                        "message_id": msg["id"],
                        "conversation_id": request.conversation_id,
                        "idempotent": True
                    }

        # 3. 메시지 저장 (기존 messages 테이블 구조)
        message_data = {
            "conversation_id": request.conversation_id,
            "role": "user",
            "content": request.content,
            "meta": {
                "topic": "contract_analysis",
                "extension": "chat",
                "client_message_id": idempotency_key  # Idempotency key 저장
            }
        }

        # payload에 컴포넌트 정보 저장
        if request.component_type or request.component_data:
            message_data["meta"]["component_type"] = request.component_type
            message_data["meta"]["component_data"] = request.component_data or {}

        result = supabase.table("messages").insert(message_data).execute()

        if not result.data:
            raise HTTPException(500, "메시지 저장 실패")

        saved_message = result.data[0]
        logger.info(f"메시지 저장 완료: message_id={saved_message['id']}")

        # ========== 간단한 상태 진행 유도 ==========
        # 대화 메타(주소/유형) 확인 후, 적절한 다음 단계 안내 메시지를 보냅니다.
        try:
            conv_resp = supabase.table("conversations").select("id, property_address, contract_type").eq("id", request.conversation_id).single().execute()
            conv = conv_resp.data if hasattr(conv_resp, 'data') else (conv_resp or {})
            property_address = (conv or {}).get("property_address")
            contract_type = (conv or {}).get("contract_type")

            # 주소 추출 시도
            from core.address_extractor import extract_address_from_text
            addr_extracted = extract_address_from_text(request.content)

            # 계약유형 판별
            content_lower = request.content.strip()
            detected_contract = None
            for ct in ["전세", "전월세", "월세", "반전세", "매매"]:
                if ct in content_lower:
                    detected_contract = ct
                    break

            assistant_msg = None

            if not property_address:
                if addr_extracted.found and addr_extracted.confidence >= 0.6:
                    # 주소 업데이트 후 계약 유형 선택 안내
                    supabase.table("conversations").update({
                        "property_address": addr_extracted.address
                    }).eq("id", request.conversation_id).execute()

                    # ✅ 대화 제목 자동 생성 (주소만 있는 경우)
                    await update_conversation_title(
                        supabase=supabase,
                        conversation_id=request.conversation_id,
                        property_address=addr_extracted.address,
                        contract_type=None
                    )

                    assistant_msg = (
                        f"주소를 확인했습니다: {addr_extracted.address}\n\n"
                        "계약 유형을 선택해주세요. (전세/전월세/월세/매매)"
                    )
                else:
                    # ✅ 주소가 없는 첫 메시지인 경우, 질문 내용으로 제목 생성
                    # 메시지 개수 확인 (첫 번째 유저 메시지인지)
                    msg_count_resp = supabase.table("messages") \
                        .select("id", count="exact") \
                        .eq("conversation_id", request.conversation_id) \
                        .eq("role", "user") \
                        .execute()

                    user_message_count = msg_count_resp.count if hasattr(msg_count_resp, 'count') else 0

                    # 첫 번째 유저 메시지라면 제목 생성
                    if user_message_count == 1:  # 방금 저장한 메시지가 첫 번째
                        await update_conversation_title(
                            supabase=supabase,
                            conversation_id=request.conversation_id,
                            property_address=None,
                            contract_type=None,
                            first_user_message=request.content
                        )

                    # 주소 요청 안내
                    assistant_msg = (
                        "부동산 주소를 입력해주세요.\n"
                        "예: 서울특별시 강남구 테헤란로 123, 또는 '서울 강남구 역삼동 123-45'"
                    )
            elif not contract_type:
                if detected_contract:
                    # 계약 유형 저장 후 등기부 단계 안내
                    supabase.table("conversations").update({
                        "contract_type": detected_contract
                    }).eq("id", request.conversation_id).execute()

                    # ✅ 대화 제목 자동 생성 (주소 + 계약 유형)
                    await update_conversation_title(
                        supabase=supabase,
                        conversation_id=request.conversation_id,
                        property_address=property_address,
                        contract_type=detected_contract
                    )

                    assistant_msg = (
                        f"계약 유형을 '{detected_contract}'로 설정했습니다.\n\n"
                        "등기부를 발급(크레딧 차감)하시겠어요, 아니면 PDF를 업로드하시겠어요?"
                    )
                else:
                    assistant_msg = "계약 유형을 선택해주세요. (전세/전월세/월세/매매)"
            # else: 나머지 단계는 프론트 UI/다음 API가 안내함

            if assistant_msg:
                supabase.table("messages").insert({
                    "conversation_id": request.conversation_id,
                    "role": "assistant",
                    "content": assistant_msg,
                    "meta": {"topic": "contract_analysis", "extension": "chat"}
                }).execute()
        except Exception as guide_err:
            logger.warning(f"다음 단계 안내 메시지 생성 실패(무시): {guide_err}")

        return {
            "ok": True,
            "message_id": saved_message["id"],
            "conversation_id": request.conversation_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메시지 전송 오류: {e}")
        raise HTTPException(500, f"메시지 전송 실패: {str(e)}")


@router.get("/messages/{conversation_id}", response_model=GetMessagesResponse)
async def get_messages(
    conversation_id: str,
    limit: int = 100,
    offset: int = 0,
    user: dict = Depends(get_current_user)
):
    """
    대화의 채팅 메시지 조회
    """
    user_id = user["sub"]
    logger.info(f"메시지 조회: user_id={user_id}, conversation_id={conversation_id}")

    try:
        supabase = get_supabase_client(service_role=True)

        # 1. 소유권 확인
        conv_check = supabase.table("conversations") \
            .select("id") \
            .eq("id", conversation_id) \
            .eq("user_id", user_id) \
            .execute()

        if not conv_check.data:
            raise HTTPException(404, "대화를 찾을 수 없거나 권한이 없습니다")

        # 2. 메시지 조회
        result = supabase.table("messages") \
            .select("id, role, content, meta, created_at") \
            .eq("conversation_id", conversation_id) \
            .order("created_at", desc=False) \
            .limit(limit) \
            .execute()

        messages = result.data or []

        # meta에서 컴포넌트/확장 정보 추출
        formatted_messages = []
        for m in messages:
            meta = m.get("meta") or {}
            formatted_messages.append(Message(
                id=m["id"],
                role=m["role"],
                content=m["content"],
                component_type=meta.get("component_type"),
                component_data=meta.get("component_data"),
                created_at=m["created_at"]
            ))

        logger.info(f"메시지 조회 완료: {len(formatted_messages)}개")

        return GetMessagesResponse(
            conversation_id=conversation_id,
            messages=formatted_messages,
            total=len(formatted_messages)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메시지 조회 오류: {e}")
        raise HTTPException(500, f"메시지 조회 실패: {str(e)}")


@router.get("/recent", response_model=GetRecentConversationsResponse)
async def get_recent_conversations(
    limit: int = 20,
    category: Optional[str] = None,  # "recent" | "analysis" | None (전체)
    user: dict = Depends(get_current_user)
):
    """
    최근 대화 목록 조회

    Args:
        limit: 최대 결과 수 (기본값: 20)
        category: 카테고리 필터
            - "recent": is_recent_conversation=TRUE 대화만
            - "analysis": is_analysis_report=TRUE 대화만
            - None: 전체 대화 (중복 허용, 분류 무관)
    """
    user_id = user["sub"]
    logger.info(f"최근 대화 조회: user_id={user_id}, limit={limit}, category={category}")

    try:
        supabase = get_supabase_client(service_role=False)

        # recent_conversations 뷰 조회 (카테고리 필터 적용)
        query = supabase.table("recent_conversations").select("*")

        # 카테고리 필터
        if category == "recent":
            query = query.eq("is_recent_conversation", True)
        elif category == "analysis":
            query = query.eq("is_analysis_report", True)
        # else: 전체 조회 (필터 없음)

        result = query.limit(limit).execute()

        conversations = result.data or []

        formatted_conversations = [
            RecentConversation(
                id=str(c["id"]),
                title=c.get("title"),
                property_address=c.get("property_address"),
                contract_type=c.get("contract_type"),
                analysis_status=c.get("analysis_status", "pending"),
                last_user_message=c.get("last_user_message"),
                message_count=c.get("message_count", 0),
                created_at=c["created_at"],
                updated_at=c["updated_at"]
            )
            for c in conversations
        ]

        logger.info(f"최근 대화 조회 완료: {len(formatted_conversations)}개")

        return GetRecentConversationsResponse(
            conversations=formatted_conversations,
            total=len(formatted_conversations)
        )

    except Exception as e:
        logger.error(f"최근 대화 조회 오류: {e}")
        raise HTTPException(500, f"최근 대화 조회 실패: {str(e)}")


@router.patch("/conversation/{conversation_id}")
async def update_conversation(
    conversation_id: str,
    request: UpdateConversationRequest,
    user: dict = Depends(get_current_user)
):
    """
    대화 정보 업데이트 (주소, 계약 유형 등)
    """
    user_id = user["sub"]
    logger.info(f"대화 업데이트: user_id={user_id}, conversation_id={conversation_id}")

    try:
        supabase = get_supabase_client(service_role=True)

        # 소유권 확인
        conv_check = supabase.table("conversations") \
            .select("id") \
            .eq("id", conversation_id) \
            .eq("user_id", user_id) \
            .execute()

        if not conv_check.data:
            raise HTTPException(404, "대화를 찾을 수 없거나 권한이 없습니다")

        # 업데이트 데이터 구성
        update_data = {}
        if request.property_address:
            update_data["property_address"] = request.property_address
        if request.contract_type:
            update_data["contract_type"] = request.contract_type
        if request.analysis_status:
            update_data["analysis_status"] = request.analysis_status

        if not update_data:
            return {"ok": True, "message": "업데이트할 내용이 없습니다"}

        # 업데이트 실행
        result = supabase.table("conversations") \
            .update(update_data) \
            .eq("id", conversation_id) \
            .execute()

        if not result.data:
            raise HTTPException(500, "대화 업데이트 실패")

        logger.info(f"대화 업데이트 완료: conversation_id={conversation_id}")

        return {
            "ok": True,
            "conversation_id": conversation_id,
            "updated_fields": list(update_data.keys())
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 업데이트 오류: {e}")
        raise HTTPException(500, f"대화 업데이트 실패: {str(e)}")


@router.delete("/conversation/{conversation_id}")
async def delete_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    """
    대화 삭제 (메시지 포함, CASCADE)
    """
    user_id = user["sub"]
    logger.info(f"대화 삭제: user_id={user_id}, conversation_id={conversation_id}")

    try:
        supabase = get_supabase_client(service_role=True)

        # 삭제 (메시지는 CASCADE로 자동 삭제)
        result = supabase.table("conversations") \
            .delete() \
            .eq("id", conversation_id) \
            .eq("user_id", user_id) \
            .execute()

        if not result.data:
            raise HTTPException(404, "대화를 찾을 수 없거나 권한이 없습니다")

        logger.info(f"대화 삭제 완료: conversation_id={conversation_id}")

        return {
            "ok": True,
            "conversation_id": conversation_id,
            "message": "대화가 삭제되었습니다"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 삭제 오류: {e}")
        raise HTTPException(500, f"대화 삭제 실패: {str(e)}")


# ============== SSE 스트리밍 엔드포인트 ==============

@router.get("/stream/{message_id}")
async def stream_message(message_id: int, user: dict = Depends(get_current_user)):
    """
    메시지 스트리밍 (SSE)

    - LLM 응답을 실시간으로 스트리밍
    - message_chunks 테이블에서 청크를 읽어서 전송
    - 클라이언트는 EventSource로 연결
    """
    user_id = user["sub"]
    logger.info(f"메시지 스트리밍 시작: user_id={user_id}, message_id={message_id}")

    async def event_generator() -> AsyncGenerator[str, None]:
        """SSE 이벤트 생성기"""
        try:
            supabase = get_supabase_client(service_role=True)

            # 1. 메시지 소유권 확인
            msg_check = supabase.table("messages") \
                .select("id, conversation_id") \
                .eq("id", message_id) \
                .execute()

            if not msg_check.data:
                yield f"event: error\ndata: {json.dumps({'error': 'Message not found'})}\n\n"
                return

            conversation_id = msg_check.data[0]["conversation_id"]

            # 대화 소유권 확인
            conv_check = supabase.table("conversations") \
                .select("id") \
                .eq("id", conversation_id) \
                .eq("user_id", user_id) \
                .execute()

            if not conv_check.data:
                yield f"event: error\ndata: {json.dumps({'error': 'Unauthorized'})}\n\n"
                return

            # 2. message_chunks 폴링 (실시간 스트리밍 시뮬레이션)
            last_seq = -1
            max_poll_count = 300  # 최대 5분 (1초 간격)
            poll_count = 0

            while poll_count < max_poll_count:
                # 새로운 청크 조회
                chunks_result = supabase.table("message_chunks") \
                    .select("seq, delta, created_at") \
                    .eq("message_id", message_id) \
                    .gt("seq", last_seq) \
                    .order("seq", desc=False) \
                    .execute()

                chunks = chunks_result.data or []

                if chunks:
                    for chunk in chunks:
                        # SSE 형식으로 전송
                        data = {
                            "seq": chunk["seq"],
                            "delta": chunk["delta"],
                            "timestamp": chunk["created_at"]
                        }
                        yield f"event: chunk\ndata: {json.dumps(data)}\n\n"
                        last_seq = chunk["seq"]

                # 메시지 완료 상태 확인
                msg_status = supabase.table("messages") \
                    .select("meta") \
                    .eq("id", message_id) \
                    .execute()

                if msg_status.data:
                    meta = msg_status.data[0].get("meta") or {}
                    if meta.get("status") == "completed":
                        # 스트리밍 완료
                        yield f"event: done\ndata: {json.dumps({'message_id': message_id})}\n\n"
                        logger.info(f"메시지 스트리밍 완료: message_id={message_id}")
                        return

                # 1초 대기
                await asyncio.sleep(1)
                poll_count += 1

            # 타임아웃
            yield f"event: timeout\ndata: {json.dumps({'message_id': message_id})}\n\n"
            logger.warning(f"메시지 스트리밍 타임아웃: message_id={message_id}")

        except Exception as e:
            logger.error(f"메시지 스트리밍 오류: {e}")
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Nginx 버퍼링 비활성화
        }
    )


@router.post("/message/{message_id}/finalize")
async def finalize_message(message_id: int, user: dict = Depends(get_current_user)):
    """
    메시지 스트리밍 완료 처리

    - message_chunks의 모든 청크를 병합하여 messages.content에 저장
    - 청크 테이블은 선택적으로 보관 (분석/디버깅용)
    """
    user_id = user["sub"]
    logger.info(f"메시지 완료 처리: user_id={user_id}, message_id={message_id}")

    try:
        supabase = get_supabase_client(service_role=True)

        # 1. 메시지 소유권 확인
        msg_check = supabase.table("messages") \
            .select("id, conversation_id, content") \
            .eq("id", message_id) \
            .execute()

        if not msg_check.data:
            raise HTTPException(404, "Message not found")

        conversation_id = msg_check.data[0]["conversation_id"]

        # 대화 소유권 확인
        conv_check = supabase.table("conversations") \
            .select("id") \
            .eq("id", conversation_id) \
            .eq("user_id", user_id) \
            .execute()

        if not conv_check.data:
            raise HTTPException(403, "Unauthorized")

        # 2. 청크 조회 및 병합
        chunks_result = supabase.table("message_chunks") \
            .select("seq, delta") \
            .eq("message_id", message_id) \
            .order("seq", desc=False) \
            .execute()

        chunks = chunks_result.data or []

        if not chunks:
            # 청크가 없으면 현재 content 유지
            logger.warning(f"청크 없음: message_id={message_id}")
            return {
                "ok": True,
                "message_id": message_id,
                "finalized": False,
                "reason": "no_chunks"
            }

        # 청크 병합
        final_content = "".join([chunk["delta"] for chunk in chunks])

        # 3. messages.content 업데이트
        supabase.table("messages").update({
            "content": final_content,
            "meta": {
                "status": "completed",
                "chunk_count": len(chunks)
            }
        }).eq("id", message_id).execute()

        logger.info(f"메시지 완료 처리 성공: message_id={message_id}, chunks={len(chunks)}")

        return {
            "ok": True,
            "message_id": message_id,
            "finalized": True,
            "chunk_count": len(chunks),
            "content_length": len(final_content)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메시지 완료 처리 오류: {e}")
        raise HTTPException(500, f"메시지 완료 처리 실패: {str(e)}")
