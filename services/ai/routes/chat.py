"""
채팅 API 라우터
기존 conversations/messages 테이블 활용
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from uuid import UUID
import logging

from core.auth import get_current_user
from core.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["채팅"])


# ============== 요청/응답 스키마 ==============

class CreateConversationResponse(BaseModel):
    """새 대화 시작 응답"""
    conversation_id: str
    message: str


class SendMessageRequest(BaseModel):
    """메시지 전송 요청"""
    conversation_id: str = Field(..., description="대화 ID")
    content: str = Field(..., min_length=1, max_length=5000, description="메시지 내용")
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

        # 1. conversations 생성
        conv_result = supabase.table("conversations").insert({
            "user_id": user_id,
            "title": "새 대화",
            "analysis_status": "pending"
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
async def send_message(request: SendMessageRequest, user: dict = Depends(get_current_user)):
    """
    메시지 전송 (사용자 메시지 저장)
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

        # 2. 메시지 저장 (기존 messages 테이블 구조)
        message_data = {
            "conversation_id": request.conversation_id,
            "role": "user",
            "content": request.content,
            "meta": { "topic": "contract_analysis", "extension": "chat" }
        }

        # payload에 컴포넌트 정보 저장
        if request.component_type or request.component_data:
            message_data["meta"] = message_data.get("meta", {})
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
            for ct in ["전세", "전월세", "월세", "매매"]:
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
                    assistant_msg = (
                        f"주소를 확인했습니다: {addr_extracted.address}\n\n"
                        "계약 유형을 선택해주세요. (전세/전월세/월세/매매)"
                    )
                else:
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
async def get_recent_conversations(limit: int = 20, user: dict = Depends(get_current_user)):
    """
    최근 대화 목록 조회
    """
    user_id = user["sub"]
    logger.info(f"최근 대화 조회: user_id={user_id}, limit={limit}")

    try:
        supabase = get_supabase_client(service_role=False)

        # recent_conversations 뷰 조회
        result = supabase.table("recent_conversations") \
            .select("*") \
            .limit(limit) \
            .execute()

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
