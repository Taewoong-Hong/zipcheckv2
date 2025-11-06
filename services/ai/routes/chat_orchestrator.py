"""
GPT-4o-mini 기반 채팅 오케스트레이터
Function Calling을 통한 대화형 부동산 분석 시스템
"""
import logging
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from openai import AsyncOpenAI
from core.auth import get_current_user
from core.supabase_client import get_supabase_client
from core.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat/v2", tags=["chat-v2"])

# OpenAI 클라이언트 초기화
client = AsyncOpenAI(api_key=settings.openai_api_key)

# ===========================
# Request/Response Models
# ===========================
class ChatMessage(BaseModel):
    role: str = Field(..., description="메시지 역할 (user/assistant/system)")
    content: str = Field(..., description="메시지 내용")

class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="대화 히스토리")
    session_id: Optional[str] = Field(None, description="세션 ID")
    context: Optional[Dict[str, Any]] = Field(None, description="추가 컨텍스트")

class ToolCall(BaseModel):
    type: str = Field(..., description="도구 타입")
    data: Dict[str, Any] = Field(..., description="도구 데이터")

class ChatResponse(BaseModel):
    reply: str = Field(..., description="응답 메시지")
    tool_calls: Optional[List[ToolCall]] = Field(None, description="실행할 도구들")
    context_updates: Optional[Dict[str, Any]] = Field(None, description="컨텍스트 업데이트")
    session_id: Optional[str] = Field(None, description="세션 ID")

# ===========================
# Tool Definitions
# ===========================
def get_tool_definitions():
    """OpenAI Function Calling을 위한 도구 정의"""
    return [
        {
            "type": "function",
            "function": {
                "name": "open_address_search_modal",
                "description": "사용자가 분석할 부동산 주소를 입력할 때 주소 검색 모달을 엽니다",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "keyword": {
                            "type": "string",
                            "description": "검색할 주소 키워드 (사용자가 제공한 경우)"
                        },
                        "purpose": {
                            "type": "string",
                            "enum": ["single_analysis", "comparison"],
                            "description": "단일 분석인지 비교 분석인지"
                        },
                        "search_index": {
                            "type": "integer",
                            "description": "비교 분석일 경우 몇 번째 주소인지 (0부터 시작)"
                        }
                    },
                    "required": ["purpose"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "request_registry_upload",
                "description": "등기부등본 업로드를 요청합니다. 전세/월세/반전세는 필수, 매매는 선택",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "contract_type": {
                            "type": "string",
                            "enum": ["매매", "전세", "월세", "반전세"],
                            "description": "계약 유형"
                        },
                        "is_required": {
                            "type": "boolean",
                            "description": "등기부가 필수인지 여부"
                        }
                    },
                    "required": ["contract_type", "is_required"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "start_analysis",
                "description": "수집된 정보를 바탕으로 부동산 분석을 시작합니다",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "analysis_type": {
                            "type": "string",
                            "enum": ["sale", "lease", "comparison"],
                            "description": "분석 유형"
                        },
                        "property_address": {
                            "type": "string",
                            "description": "분석할 부동산 주소"
                        },
                        "has_registry": {
                            "type": "boolean",
                            "description": "등기부 포함 여부"
                        },
                        "additional_info": {
                            "type": "object",
                            "description": "추가 정보 (가격, 계약 조건 등)"
                        }
                    },
                    "required": ["analysis_type", "property_address"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "generate_report",
                "description": "분석 결과를 바탕으로 상세 리포트를 생성합니다",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "case_id": {
                            "type": "string",
                            "description": "분석 케이스 ID"
                        },
                        "report_type": {
                            "type": "string",
                            "enum": ["summary", "detailed", "comparison"],
                            "description": "리포트 유형"
                        },
                        "include_recommendations": {
                            "type": "boolean",
                            "description": "추천사항 포함 여부"
                        }
                    },
                    "required": ["case_id", "report_type"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "ask_clarification",
                "description": "사용자에게 추가 정보나 명확한 설명을 요청합니다",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "question": {
                            "type": "string",
                            "description": "사용자에게 묻고 싶은 질문"
                        },
                        "options": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "선택 옵션들 (선택형 질문인 경우)"
                        },
                        "context": {
                            "type": "string",
                            "description": "질문의 맥락 설명"
                        }
                    },
                    "required": ["question"]
                }
            }
        }
    ]

# ===========================
# System Prompt
# ===========================
SYSTEM_PROMPT = """당신은 집체크의 AI 부동산 분석 전문가입니다.
사용자가 부동산 계약 관련 질문을 하면 친절하고 전문적으로 도와주세요.

중요 규칙:
1. 매매 계약: 등기부는 선택사항이며, 여러 매물을 비교 분석할 수 있습니다
2. 전세/월세/반전세: 등기부등본이 필수입니다 (안전한 계약을 위해)
3. 사용자가 주소를 언급하면 open_address_search_modal 도구를 사용하세요
4. 계약 유형에 따라 적절한 시점에 request_registry_upload 도구를 사용하세요
5. 충분한 정보가 모이면 start_analysis 도구로 분석을 시작하세요
6. 분석이 완료되면 generate_report로 상세 리포트를 제공하세요

대화 스타일:
- 친근하지만 전문적인 톤 유지
- 복잡한 부동산 용어는 쉽게 설명
- 단계별로 차근차근 안내
- 불확실한 정보는 ask_clarification으로 확인

분석 가능한 항목:
- 전세가율 및 갭투자 위험도
- 등기부 상 권리관계 및 압류/가압류 여부
- 근저당 설정액 및 우선변제권
- 시세 대비 적정성
- 주변 인프라 및 향후 개발 계획
"""

# ===========================
# API Endpoints
# ===========================
@router.post("/message", response_model=ChatResponse)
async def chat_with_gpt(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    """
    GPT-4o-mini를 사용한 대화형 채팅 엔드포인트
    Function Calling을 통해 도구를 자동으로 선택하고 실행
    """
    try:
        # 세션 관리
        session_id = request.session_id
        if not session_id:
            # 새 세션 생성
            supabase = get_supabase_client()
            session_response = supabase.table("chat_sessions").insert({
                "user_id": user["sub"],
                "context": request.context or {},
                "created_at": datetime.utcnow().isoformat()
            }).execute()

            if session_response.data:
                session_id = session_response.data[0]["id"]

        # 메시지 준비
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]

        # 대화 히스토리 추가
        for msg in request.messages:
            messages.append({
                "role": msg.role,
                "content": msg.content
            })

        # GPT-4o-mini 호출 with Function Calling
        logger.info(f"Calling GPT-4o-mini with {len(messages)} messages")

        completion = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=get_tool_definitions(),
            tool_choice="auto",
            temperature=0.7,
            max_tokens=1000
        )

        response_message = completion.choices[0].message

        # Tool calls 처리
        tool_calls = []
        if response_message.tool_calls:
            for tool_call in response_message.tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)

                logger.info(f"Tool call: {function_name} with args: {function_args}")

                # 도구별 처리 로직
                if function_name == "open_address_search_modal":
                    tool_calls.append(ToolCall(
                        type="OPEN_ADDRESS_MODAL",
                        data={
                            "keyword": function_args.get("keyword", ""),
                            "purpose": function_args["purpose"],
                            "index": function_args.get("search_index", 0)
                        }
                    ))

                elif function_name == "request_registry_upload":
                    tool_calls.append(ToolCall(
                        type="REQUEST_REGISTRY_UPLOAD",
                        data={
                            "contractType": function_args["contract_type"],
                            "isRequired": function_args["is_required"]
                        }
                    ))

                elif function_name == "start_analysis":
                    # 백그라운드에서 분석 시작
                    background_tasks.add_task(
                        start_background_analysis,
                        session_id,
                        function_args,
                        user["sub"]
                    )
                    tool_calls.append(ToolCall(
                        type="START_ANALYSIS",
                        data=function_args
                    ))

                elif function_name == "generate_report":
                    tool_calls.append(ToolCall(
                        type="GENERATE_REPORT",
                        data=function_args
                    ))

                elif function_name == "ask_clarification":
                    tool_calls.append(ToolCall(
                        type="ASK_CLARIFICATION",
                        data=function_args
                    ))

        # 응답 메시지
        reply = response_message.content or "무엇을 도와드릴까요?"

        # 세션 컨텍스트 업데이트
        if session_id:
            supabase = get_supabase_client()
            supabase.table("chat_sessions").update({
                "context": {
                    **(request.context or {}),
                    "last_message": reply,
                    "last_tool_calls": [tc.dict() for tc in tool_calls] if tool_calls else []
                },
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", session_id).execute()

        return ChatResponse(
            reply=reply,
            tool_calls=tool_calls if tool_calls else None,
            session_id=session_id
        )

    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(500, f"채팅 처리 중 오류가 발생했습니다: {str(e)}")

@router.get("/session/{session_id}")
async def get_session(
    session_id: str,
    user: dict = Depends(get_current_user)
):
    """세션 정보 조회"""
    supabase = get_supabase_client()

    response = supabase.table("chat_sessions") \
        .select("*") \
        .eq("id", session_id) \
        .eq("user_id", user["sub"]) \
        .execute()

    if not response.data:
        raise HTTPException(404, "Session not found")

    return response.data[0]

# ===========================
# Background Tasks
# ===========================
async def start_background_analysis(session_id: str, args: dict, user_id: str):
    """백그라운드에서 분석 실행"""
    try:
        logger.info(f"Starting background analysis for session {session_id}")

        # TODO: 실제 분석 로직 구현
        # 1. 케이스 생성
        # 2. 등기부 파싱 (있는 경우)
        # 3. 공공데이터 수집
        # 4. 리스크 분석
        # 5. 리포트 생성

        # 임시로 세션 업데이트만
        supabase = get_supabase_client()
        supabase.table("chat_sessions").update({
            "context": {
                "analysis_started": True,
                "analysis_args": args
            },
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", session_id).execute()

    except Exception as e:
        logger.error(f"Background analysis failed: {e}", exc_info=True)