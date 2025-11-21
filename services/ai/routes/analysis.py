"""
분석 오케스트레이터 API

케이스 상태 전환과 분석 파이프라인을 조율합니다.
"""
import logging
import asyncio
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.supabase_client import get_supabase_client, supabase_storage
from core.auth import get_current_user
from core.risk_engine import analyze_risks  # ✅ 구현 완료
from core.llm_router import dual_model_analyze  # ✅ 구현 완료
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analyze", tags=["analysis"])


# ===========================
# Request/Response Models
# ===========================
class StartAnalysisRequest(BaseModel):
    """분석 시작 요청"""
    case_id: str


class AnalysisStatusResponse(BaseModel):
    """분석 상태 응답"""
    case_id: str
    current_state: str
    progress: float  # 0.0 ~ 1.0
    message: str


class AnalysisResultResponse(BaseModel):
    """분석 결과 응답"""
    case_id: str
    report_id: Optional[str]
    risks: Optional[list] = None
    recommendations: Optional[list] = None
    summary: Optional[str] = None


class CrosscheckRequest(BaseModel):
    """교차검증 요청 (Claude 검증 전용)"""
    draft: str


class CrosscheckResponse(BaseModel):
    """교차검증 응답"""
    validation: str


class AuditLogEntry(BaseModel):
    """감사 로그 항목"""
    id: str
    event_type: str
    event_category: str
    message: str
    severity: str
    created_at: str
    metadata: Optional[dict] = None


class AuditLogsResponse(BaseModel):
    """감사 로그 목록 응답"""
    case_id: str
    total_count: int
    logs: list[AuditLogEntry]


# ===========================
# 상태 전환 매핑
# ===========================
STATE_TRANSITIONS = {
    "init": "address_pick",
    "address_pick": "contract_type",
    "contract_type": "registry_choice",
    "registry_choice": "registry_ready",
    "registry_ready": "parse_enrich",
    "parse_enrich": "report",
}

STATE_PROGRESS = {
    "init": 0.0,
    "address_pick": 0.15,
    "contract_type": 0.3,
    "registry_choice": 0.45,
    "registry_ready": 0.6,
    "parse_enrich": 0.8,
    "report": 1.0,
}


# ===========================
# API Endpoints
# ===========================
class SimpleChatRequest(BaseModel):
    """간단한 채팅 질문 요청"""
    question: str


class SimpleChatResponse(BaseModel):
    """간단한 채팅 응답"""
    answer: str
    confidence: Optional[float] = None


@router.post("/", response_model=SimpleChatResponse)
async def simple_chat_analysis(
    request: SimpleChatRequest,
    user: dict = Depends(get_current_user)
):
    """
    간단한 채팅 질문 분석 (케이스 없이 즉시 응답)

    - 부동산 관련 일반 질문에 답변
    - LLM 듀얼 시스템 (ChatGPT + Claude) 사용
    - 등기부/공공데이터 없이 답변 가능
    """
    logger.info(f"간단 채팅 분석: user_id={user['sub']}, question={request.question[:50]}...")

    try:
        # 규칙 기반 게이트 이후의 간단 Q&A는 ChatGPT(OpenAI) 단일 모델만 사용
        # (리포트 생성/검토 단계에서만 Claude 개입)
        context = """
부동산 계약 리스크 분석 전문 상담입니다.

일반적인 부동산 관련 질문에 답변하고 있습니다.
구체적인 계약서나 등기부 분석이 필요한 경우, 정식 케이스 분석을 권장합니다.
"""

        # single_model_analyze는 동기 함수이므로 실행기에서 실행
        from core.llm_router import single_model_analyze
        loop = asyncio.get_running_loop()
        single = await loop.run_in_executor(
            None,
            lambda: single_model_analyze(
                question=request.question,
                context=context,
                provider="openai",
            ),
        )

        logger.info("간단 답변 생성 완료 (provider=openai)")

        return SimpleChatResponse(
            answer=single.content,
            confidence=None,
        )

    except Exception as e:
        logger.error(f"간단 채팅 분석 실패: {e}", exc_info=True)
        raise HTTPException(500, f"답변 생성 실패: {str(e)}")


@router.post("/start", response_model=AnalysisStatusResponse)
async def start_analysis(
    request: StartAnalysisRequest,
    user: dict = Depends(get_current_user)
):
    """
    분석 시작 (백그라운드)

    - 백그라운드 작업 큐에 분석 태스크 등록
    - 실시간 진행 상황은 /analyze/stream 엔드포인트 사용
    """
    logger.info(f"▶ [start_analysis] 요청 받음")
    logger.info(f"   └─ case_id={request.case_id}")
    logger.info(f"   └─ user_id={user['sub']}")

    supabase = get_supabase_client(service_role=True)

    # 케이스 조회
    case_response = supabase.table("v2_cases") \
        .select("*") \
        .eq("id", str(request.case_id)) \
        .eq("user_id", str(user["sub"])) \
        .execute()

    if not case_response.data:
        raise HTTPException(404, "Case not found")

    case = case_response.data[0]
    current_state = case["current_state"]

    # 상태 검증: parse_enrich 상태에서만 분석 시작 가능
    if current_state != "parse_enrich":
        raise HTTPException(
            400,
            f"Cannot start analysis from state '{current_state}'. Expected 'parse_enrich'."
        )

    # 백그라운드에서 분석 파이프라인 실행 (비블로킹)
    import asyncio
    asyncio.create_task(execute_analysis_pipeline(request.case_id))

    return AnalysisStatusResponse(
        case_id=request.case_id,
        current_state="parse_enrich",
        progress=STATE_PROGRESS["parse_enrich"],
        message="분석이 시작되었습니다. 실시간 진행 상황은 /analyze/stream을 사용하세요.",
    )


@router.get("/stream/{case_id}")
async def stream_analysis(
    case_id: str,
    user: dict = Depends(get_current_user)
):
    """
    실시간 분석 스트리밍 (Server-Sent Events)

    - 등기부 파싱, 리스크 계산, LLM 생성 과정을 실시간으로 스트리밍
    - ChatGPT처럼 생각하는 과정을 보여줌
    """
    from fastapi.responses import StreamingResponse
    import json

    async def event_generator():
        """SSE 이벤트 스트림 생성"""
        try:
            # 1단계: 시작
            yield f"data: {json.dumps({'step': 1, 'message': '🚀 분석을 시작합니다...', 'progress': 0.1}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.5)

            # 2단계: 케이스 데이터 조회
            yield f"data: {json.dumps({'step': 2, 'message': '📋 케이스 데이터 조회 중...', 'progress': 0.2}, ensure_ascii=False)}\n\n"

            supabase = get_supabase_client(service_role=True)
            case_response = supabase.table("v2_cases").select("*").eq("id", case_id).execute()

            if not case_response.data:
                yield f"data: {json.dumps({'error': '케이스를 찾을 수 없습니다.'}, ensure_ascii=False)}\n\n"
                return

            case = case_response.data[0]
            address = case.get("property_address", "N/A")
            yield f"data: {json.dumps({'step': 2, 'message': f'✅ 케이스 조회 완료: {address}', 'progress': 0.25}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.5)

            # 3단계: 등기부 파싱
            yield f"data: {json.dumps({'step': 3, 'message': '📄 등기부 파싱 중...', 'progress': 0.3}, ensure_ascii=False)}\n\n"

            artifact_response = supabase.table("v2_artifacts") \
                .select("*") \
                .eq("case_id", case_id) \
                .eq("artifact_type", "registry_pdf") \
                .execute()

            registry_data = None
            registry_doc_masked = None
            registry_doc = None

            if artifact_response.data:
                from ingest.registry_parser import parse_registry_from_url
                from core.risk_engine import RegistryData

                # 동적 Signed URL 생성 (1시간 만료)
                file_path = artifact_response.data[0].get("file_path")
                if file_path:
                    bucket, path = file_path.split("/", 1)
                    registry_url = await supabase_storage.get_signed_url(bucket, path, expires_in=3600)
                    # 감사 로그 컨텍스트 전달
                    registry_doc = await parse_registry_from_url(registry_url, case_id=case_id, user_id=case['user_id'])

                    # RegistryData 모델로 변환
                    registry_data = RegistryData(
                        property_value=None,
                        mortgage_total=sum([m.amount or 0 for m in registry_doc.mortgages]),
                        seizure_exists=any(s.type == "압류" for s in registry_doc.seizures),
                        provisional_attachment_exists=any(s.type == "가압류" for s in registry_doc.seizures),
                        ownership_disputes=False
                    )

                    registry_doc_masked = registry_doc.to_masked_dict()

                    # 등기부 요약 정보 전송
                    summary = f"✅ 등기부 파싱 완료\n"
                    summary += f"   📍 주소: {registry_doc.property_address or 'N/A'}\n"
                    summary += f"   👤 소유자: {registry_doc_masked['owner']['name'] if registry_doc_masked.get('owner') else 'N/A'}\n"
                    summary += f"   💰 근저당: {len(registry_doc.mortgages)}건 (총 {registry_data.mortgage_total:,}만원)\n"

                    if registry_doc.seizures:
                        summary += f"   ⚠️ 압류/가압류: {len(registry_doc.seizures)}건\n"

                    yield f"data: {json.dumps({'step': 3, 'message': summary, 'progress': 0.4, 'registry_summary': registry_doc_masked}, ensure_ascii=False)}\n\n"
                    await asyncio.sleep(1.0)

            # 4단계: 공공데이터 조회
            yield f"data: {json.dumps({'step': 4, 'message': '🔍 공공데이터 조회 중 (실거래가, 법정동코드)...', 'progress': 0.5}, ensure_ascii=False)}\n\n"

            from core.public_data_api import AptTradeAPIClient, LegalDongCodeAPIClient
            from core.settings import settings
            import httpx
            from datetime import datetime

            property_value_estimate = None
            async with httpx.AsyncClient() as client:
                legal_dong_client = LegalDongCodeAPIClient(
                    api_key=settings.public_data_api_key,
                    client=client
                )
                legal_dong_result = await legal_dong_client.get_legal_dong_code(
                    keyword=case['property_address']
                )

                lawd_cd = None
                if legal_dong_result['body']['items']:
                    lawd_cd = legal_dong_result['body']['items'][0]['lawd5']
                    yield f"data: {json.dumps({'step': 4, 'message': f'✅ 법정동코드: {lawd_cd}', 'progress': 0.55}, ensure_ascii=False)}\n\n"
                    await asyncio.sleep(0.5)

                if lawd_cd:
                    apt_trade_client = AptTradeAPIClient(
                        api_key=settings.public_data_api_key,
                        client=client
                    )
                    now = datetime.now()
                    trade_result = await apt_trade_client.get_apt_trades(
                        lawd_cd=lawd_cd,
                        deal_ymd=f"{now.year}{now.month:02d}"
                    )

                    if trade_result['body']['items']:
                        amounts = [item['dealAmount'] for item in trade_result['body']['items']
                                  if item['dealAmount']]
                        if amounts:
                            property_value_estimate = sum(amounts) // len(amounts)
                            yield f"data: {json.dumps({'step': 4, 'message': f'✅ 평균 실거래가: {property_value_estimate:,}만원 ({len(amounts)}건 분석)', 'progress': 0.6}, ensure_ascii=False)}\n\n"
                            await asyncio.sleep(0.5)

            # registry_data 업데이트
            if registry_data and property_value_estimate:
                from core.risk_engine import PropertyType, get_default_auction_rate

                contract_type = case.get('contract_type', '전세')
                property_type = case.get('metadata', {}).get('property_type')
                sido = case.get('metadata', {}).get('sido')
                sigungu = case.get('metadata', {}).get('sigungu')
                auction_rate_override = case.get('metadata', {}).get('auction_rate_override')

                if contract_type in ["전세", "월세"]:
                    auction_rate = 0.70
                    if auction_rate_override is not None:
                        auction_rate = auction_rate_override
                    elif property_type and sido and sigungu:
                        auction_rate = get_default_auction_rate(
                            property_type=PropertyType(property_type),
                            sido=sido,
                            sigungu=sigungu
                        )

                    registry_data.property_value = int(property_value_estimate * auction_rate)
                    yield f"data: {json.dumps({'step': 4, 'message': f'✅ 물건 가치 계산: {property_value_estimate:,}만원 × {auction_rate * 100:.0f}% = {registry_data.property_value:,}만원', 'progress': 0.65}, ensure_ascii=False)}\n\n"
                else:
                    registry_data.property_value = property_value_estimate

            # 5단계: 리스크 점수 계산
            yield f"data: {json.dumps({'step': 5, 'message': '📊 리스크 점수 계산 중...', 'progress': 0.7}, ensure_ascii=False)}\n\n"

            from core.risk_engine import analyze_risks, ContractData, PropertyType

            contract_type = case.get('contract_type', '전세')
            property_type = case.get('metadata', {}).get('property_type')
            sido = case.get('metadata', {}).get('sido')
            sigungu = case.get('metadata', {}).get('sigungu')
            auction_rate_override = case.get('metadata', {}).get('auction_rate_override')

            contract_data = ContractData(
                contract_type=contract_type,
                deposit=case.get('metadata', {}).get('deposit'),
                price=case.get('metadata', {}).get('price'),
                property_address=case.get('property_address') if contract_type == '매매' else None,
                property_type=PropertyType(property_type) if property_type else None,
                sido=sido,
                sigungu=sigungu,
                auction_rate_override=auction_rate_override,
            )

            risk_result = None
            if contract_type == '매매':
                from core.risk_engine import MarketData
                market_data = MarketData(
                    avg_trade_price=property_value_estimate,
                    recent_trades=[],
                    avg_price_per_pyeong=None,
                ) if property_value_estimate else None

                risk_result = analyze_risks(contract_data, registry=registry_data, market=market_data, property_value=None)
            else:
                if registry_data:
                    risk_result = analyze_risks(contract_data, registry_data)

            if risk_result:
                risk_message = f"✅ 리스크 분석 완료\n"
                risk_message += f"   📊 총점: {risk_result.risk_score.total_score:.1f}점\n"
                risk_message += f"   🎯 위험 등급: {risk_result.risk_score.risk_level}\n"

                if risk_result.risk_score.jeonse_ratio:
                    risk_message += f"   💰 전세가율: {risk_result.risk_score.jeonse_ratio:.1f}%\n"

                if risk_result.risk_score.mortgage_ratio:
                    risk_message += f"   🏦 근저당 비율: {risk_result.risk_score.mortgage_ratio:.1f}%\n"

                yield f"data: {json.dumps({'step': 5, 'message': risk_message, 'progress': 0.75, 'risk_score': risk_result.risk_score.dict()}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(1.0)

            # 6단계: LLM 리포트 생성 (스트리밍)
            yield f"data: {json.dumps({'step': 6, 'message': '🤖 AI 리포트 생성 중 (GPT-4o-mini)...', 'progress': 0.8}, ensure_ascii=False)}\n\n"

            from core.report_generator import build_risk_features_from_registry, build_llm_prompt
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import HumanMessage

            risk_features = None
            if artifact_response.data and registry_url and registry_doc:
                risk_features = build_risk_features_from_registry(
                    registry_doc=registry_doc,
                    contract_deposit=case.get('metadata', {}).get('deposit'),
                    contract_price=case.get('metadata', {}).get('price'),
                    property_value=registry_data.property_value if registry_data else None
                )

            llm_prompt = None
            if risk_features:
                llm_prompt = build_llm_prompt(
                    risk_features=risk_features,
                    contract_type=contract_type,
                    contract_deposit=case.get('metadata', {}).get('deposit'),
                    contract_price=case.get('metadata', {}).get('price'),
                    monthly_rent=case.get('metadata', {}).get('monthly_rent')
                )
            else:
                llm_prompt = f"""# 부동산 계약 분석 요청

**주소**: {case['property_address']}
**계약 유형**: {contract_type}

**등기부 정보**: 없음

위 정보만으로 간단한 분석을 제공하세요."""

            # LLM 스트리밍 호출
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3, max_tokens=4096, streaming=True)
            messages = [HumanMessage(content=llm_prompt)]

            # 스트리밍으로 리포트 생성 과정 실시간 전송
            final_answer = ""
            chunk_count = 0

            async for chunk in llm.astream(messages):
                if hasattr(chunk, 'content') and chunk.content:
                    final_answer += chunk.content
                    chunk_count += 1

                    # 10개 청크마다 진행 상황 업데이트 (너무 자주 보내지 않도록)
                    if chunk_count % 10 == 0:
                        progress = 0.8 + (min(len(final_answer), 2000) / 2000) * 0.1  # 0.8 ~ 0.9
                        event_data = {
                            'step': 6,
                            'message': f'📝 리포트 생성 중... ({len(final_answer)}자)',
                            'progress': progress,
                            'partial_content': final_answer[:200] + '...'
                        }
                        yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"

            # 생성 완료
            event_data_complete = {
                'step': 6,
                'message': f'✅ AI 리포트 생성 완료 ({len(final_answer)}자)',
                'progress': 0.9
            }
            yield f"data: {json.dumps(event_data_complete, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.5)

            # 7단계: 리포트 저장
            yield f"data: {json.dumps({'step': 7, 'message': '💾 리포트 저장 중...', 'progress': 0.95}, ensure_ascii=False)}\n\n"

            market_data = None
            report_response = supabase.table("v2_reports").insert({
                "case_id": case_id,
                "user_id": case['user_id'],
                "content": final_answer,
                "risk_score": risk_result.risk_score.dict() if risk_result else {},
                "registry_data": registry_doc_masked,
                "report_data": {
                    "summary": final_answer,
                    "risk": risk_result.risk_score.dict() if risk_result else {},
                    "registry": registry_doc_masked,
                    "market": market_data.dict() if (contract_type == '매매' and market_data) else None
                },
                "metadata": {
                    "model": "gpt-4o-mini",
                    "confidence": 0.85,
                }
            }).execute()

            if not report_response.data:
                yield f"data: {json.dumps({'error': '리포트 저장 실패'}, ensure_ascii=False)}\n\n"
                return

            report_id = report_response.data[0]['id']
            logger.info(f"✅ [SSE] 리포트 생성 완료: case_id={case_id}, user_id={case['user_id']}, report_id={report_id}")

            # 8단계: 상태 전환
            supabase.table("v2_cases").update({
                "current_state": "report",
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("id", case_id).execute()

            # ✅ 검증 단계 추가 (SSE_REPORT_DEBUG.md 방안 1)
            # 8-1: v2_reports 재확인 (Supabase 리플리케이션 지연 감지)
            verify_report = supabase.table("v2_reports") \
                .select("id") \
                .eq("id", report_id) \
                .execute()

            if not verify_report.data:
                logger.error(f"❌ [SSE 검증 실패] 리포트 검증 실패: report_id={report_id}")
                yield f"data: {json.dumps({'error': '리포트 저장 검증 실패. 잠시 후 다시 시도해주세요.'}, ensure_ascii=False)}\n\n"
                return

            # 8-2: v2_cases current_state 재확인
            verify_case = supabase.table("v2_cases") \
                .select("current_state") \
                .eq("id", case_id) \
                .execute()

            if not verify_case.data or verify_case.data[0]['current_state'] != 'report':
                current = verify_case.data[0]['current_state'] if verify_case.data else 'unknown'
                logger.error(f"❌ [SSE 검증 실패] 케이스 상태 검증 실패: case_id={case_id}, current_state={current}")
                yield f"data: {json.dumps({'error': '케이스 상태 전환 실패. 잠시 후 다시 시도해주세요.'}, ensure_ascii=False)}\n\n"
                return

            logger.info(f"✅ [SSE 검증 통과] 리포트 및 상태 전환 확인 완료")

            # 완료 (검증 통과 후에만 전송)
            yield f"data: {json.dumps({'step': 8, 'message': '✅ 분석 완료!', 'progress': 1.0, 'report_id': report_id, 'done': True}, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"스트리밍 분석 실패: {e}", exc_info=True)
            yield f"data: {json.dumps({'error': f'분석 중 오류 발생: {str(e)}'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# Alias: POST /analyze (guide compatibility)
@router.post("", response_model=AnalysisStatusResponse)
async def analyze_alias(
    request: StartAnalysisRequest,
    user: dict = Depends(get_current_user)
):
    """
    Guide 호환용 별칭 엔드포인트.

    - POST /analyze → 내부적으로 /analyze/start와 동일 동작
    """
    return await start_analysis(request, user)


@router.get("/status/{case_id}", response_model=AnalysisStatusResponse)
async def get_analysis_status(
    case_id: str,
    user: dict = Depends(get_current_user)
):
    """
    분석 상태 조회

    - 현재 케이스 상태와 진행률 반환
    """
    supabase = get_supabase_client()

    case_response = supabase.table("v2_cases") \
        .select("*") \
        .eq("id", case_id) \
        .eq("user_id", user["sub"]) \
        .execute()

    if not case_response.data:
        raise HTTPException(404, "Case not found")

    case = case_response.data[0]
    current_state = case["current_state"]

    messages = {
        "init": "시작하기 버튼을 눌러 진행하세요.",
        "address_pick": "부동산 주소를 선택해주세요.",
        "contract_type": "계약 유형을 선택해주세요.",
        "registry_choice": "등기부 발급 또는 업로드를 선택하세요.",
        "registry_ready": "등기부가 준비되었습니다.",
        "parse_enrich": "분석 중입니다. 잠시만 기다려주세요...",
        "report": "리포트가 준비되었습니다.",
    }

    return AnalysisStatusResponse(
        case_id=case_id,
        current_state=current_state,
        progress=STATE_PROGRESS.get(current_state, 0.0),
        message=messages.get(current_state, "알 수 없는 상태입니다."),
    )


@router.post("/transition/{case_id}", response_model=AnalysisStatusResponse)
async def transition_state(
    case_id: str,
    target_state: str,
    user: dict = Depends(get_current_user)
):
    """
    상태 전환 (디버깅/테스트용)

    - 수동으로 케이스 상태를 전환
    - 프로덕션에서는 자동 전환 사용 권장
    """
    supabase = get_supabase_client()

    # 유효한 상태인지 확인
    valid_states = list(STATE_TRANSITIONS.keys()) + ["report"]
    if target_state not in valid_states:
        raise HTTPException(400, f"Invalid state: {target_state}")

    # 케이스 업데이트
    update_response = supabase.table("v2_cases") \
        .update({
            "current_state": target_state,
            "updated_at": datetime.utcnow().isoformat(),
        }) \
        .eq("id", case_id) \
        .eq("user_id", user["sub"]) \
        .execute()

    if not update_response.data:
        raise HTTPException(404, "Case not found or update failed")

    return AnalysisStatusResponse(
        case_id=case_id,
        current_state=target_state,
        progress=STATE_PROGRESS.get(target_state, 0.0),
        message=f"상태가 '{target_state}'로 전환되었습니다.",
    )


@router.get("/result/{case_id}", response_model=AnalysisResultResponse)
async def get_analysis_result(
    case_id: str,
    user: dict = Depends(get_current_user)
):
    """
    분석 결과 조회

    - 완료된 분석의 리포트 반환
    - TODO: Phase 3에서 리포트 시스템 구현
    """
    supabase = get_supabase_client()

    # 케이스 조회
    case_response = supabase.table("v2_cases") \
        .select("*") \
        .eq("id", case_id) \
        .eq("user_id", user["sub"]) \
        .execute()

    if not case_response.data:
        raise HTTPException(404, "Case not found")

    case = case_response.data[0]

    # 분석 완료 여부 확인
    if case["current_state"] not in ["report", "completed"]:
        raise HTTPException(
            400,
            f"Analysis not completed. Current state: {case['current_state']}"
        )

    # TODO: v2_reports 테이블에서 리포트 조회
    # report_response = supabase.table("v2_reports") \
    #     .select("*") \
    #     .eq("case_id", case_id) \
    #     .execute()

    # 임시 응답 (Phase 3에서 실제 리포트 반환)
    return AnalysisResultResponse(
        case_id=case_id,
        report_id=None,
        risks=None,
        recommendations=None,
        summary="분석 결과는 Phase 3에서 구현됩니다.",
    )


@router.post("/crosscheck", response_model=CrosscheckResponse)
async def crosscheck_draft(
    request: CrosscheckRequest,
    user: dict = Depends(get_current_user)
):
    """
    Guide 호환용: Claude로 초안을 교차검증.
    """
    judge_prompt = """너는 부동산 계약 리스크 점검 검증자이다.

다음은 ChatGPT가 생성한 초안이다:

{draft}

이 초안을 다음 관점에서 검증하라:
1. 사실 관계의 정확성
2. 법률적 표현의 적절성
3. 누락된 중요 리스크
4. 권장 조치의 실효성

검증 결과를 다음 형식으로 작성하라:

### 검증 결과
- 정확한 내용: ...
- 수정 필요: ...
- 추가 필요: ...

### 최종 권장사항
...
"""
    llm = ChatAnthropic(model="claude-3-5-sonnet-latest", temperature=0.1, max_tokens=4096)
    msgs = [
        SystemMessage(content=judge_prompt.format(draft=request.draft)),
        HumanMessage(content="검��을 수행하세요."),
    ]
    resp = llm.invoke(msgs)
    return CrosscheckResponse(validation=resp.content)


@router.get("/audit-logs/{case_id}", response_model=AuditLogsResponse)
async def get_audit_logs(
    case_id: str,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """
    케이스 감사 로그 조회

    - 파싱 에러, 경고, 성공 이벤트 등을 조회
    - severity 필터: error, warning, info 등
    - category 필터: parsing, registry, llm 등

    Args:
        case_id: 케이스 UUID
        severity: 심각도 필터 (선택)
        category: 카테고리 필터 (선택)
        limit: 최대 결과 수 (기본값: 50)
        user: 현재 사용자

    Returns:
        감사 로그 목록
    """
    supabase = get_supabase_client(service_role=True)

    # 케이스 권한 확인
    case_response = supabase.table("v2_cases") \
        .select("id") \
        .eq("id", case_id) \
        .eq("user_id", user["sub"]) \
        .execute()

    if not case_response.data:
        raise HTTPException(404, "Case not found")

    # 감사 로그 조회
    query = supabase.table("v2_audit_logs") \
        .select("*") \
        .eq("case_id", case_id) \
        .order("created_at", desc=True) \
        .limit(limit)

    # 필터 적용
    if severity:
        query = query.eq("severity", severity)

    if category:
        query = query.eq("event_category", category)

    logs_response = query.execute()

    # 응답 변환
    logs = [
        AuditLogEntry(
            id=log["id"],
            event_type=log["event_type"],
            event_category=log["event_category"],
            message=log["message"],
            severity=log["severity"],
            created_at=log["created_at"],
            metadata=log.get("metadata"),
        )
        for log in logs_response.data
    ]

    return AuditLogsResponse(
        case_id=case_id,
        total_count=len(logs),
        logs=logs,
    )


# ===========================
# 헬퍼 함수 (향후 구현)
# ===========================
async def queue_analysis_task(case_id: str):
    """
    분석 태스크를 백그라운드 큐에 등록

    TODO: Phase 2에서 구현
    - Celery, RQ, 또는 Cloud Tasks 사용
    - 비동기 분석 처리
    """
    pass


async def execute_analysis_pipeline(case_id: str):
    """
    분석 파이프라인 실행

    1. 케이스 데이터 조회 (주소, 계약서, 등기부)
    2. 등기부 파싱 및 구조화
    3. 공공 데이터 수집
    4. 리스크 엔진 실행 → 위험 점수 계산
    5. LLM 듀얼 시스템 실행 → 초안 생성 + 검증
    6. 리포트 생성 및 저장
    7. 상태 전환: analysis → report → completed
    """
    from core.supabase_client import get_supabase_client
    from ingest.registry_parser import parse_registry_from_url
    from core.public_data_api import AptTradeAPIClient, LegalDongCodeAPIClient
    from core.risk_engine import analyze_risks, ContractData, RegistryData
    from core.llm_router import dual_model_analyze
    from core.settings import settings
    import httpx
    from datetime import datetime

    # Service Role Key 사용 (RLS 우회)
    supabase = get_supabase_client(service_role=True)
    logger.info(f"분석 파이프라인 시작: case_id={case_id}")

    try:
        # 1️⃣ 케이스 데이터 조회
        case_response = supabase.table("v2_cases").select("*").eq("id", case_id).execute()
        if not case_response.data:
            raise HTTPException(404, f"Case not found: {case_id}")

        case = case_response.data[0]
        logger.info(f"케이스 조회 완료: {case['property_address']}")

        # 2️⃣ 등기부 파싱 (v2_artifacts에서 registry_file_url 조회)
        artifact_response = supabase.table("v2_artifacts") \
            .select("*") \
            .eq("case_id", case_id) \
            .eq("artifact_type", "registry_pdf") \
            .execute()

        registry_data = None
        registry_doc_masked = None  # 유저에게 보여줄 마스킹된 데이터

        if artifact_response.data:
            # 동적 Signed URL 생성 (1시간 만료)
            file_path = artifact_response.data[0].get("file_path")
            if file_path:
                bucket, path = file_path.split("/", 1)
                registry_url = await supabase_storage.get_signed_url(bucket, path, expires_in=3600)
                logger.info(f"등기부 파싱 시작: {file_path} (Signed URL 생성)")
                # 감사 로그 컨텍스트 전달
                registry_doc = await parse_registry_from_url(registry_url, case_id=case_id, user_id=case['user_id'])

                # RegistryData 모델로 변환 (내부 분석용 - 원본 사용)
                registry_data = RegistryData(
                    property_value=None,  # 공공 데이터에서 추정
                    mortgage_total=sum([m.amount or 0 for m in registry_doc.mortgages]),
                    seizure_exists=any(s.type == "압류" for s in registry_doc.seizures),
                    provisional_attachment_exists=any(s.type == "가압류" for s in registry_doc.seizures),
                    ownership_disputes=False  # TODO: 소유권 분쟁 감지 로직
                )

                # 마스킹된 버전 (유저 표시용)
                registry_doc_masked = registry_doc.to_masked_dict()

                logger.info(f"등기부 파싱 완료: 근저당 {registry_data.mortgage_total}만원")
                logger.info(f"개인정보 마스킹 완료: 소유자={registry_doc_masked['owner']['name'] if registry_doc_masked.get('owner') else None}")

        # 3️⃣ 공공 데이터 수집 (실거래가로 property_value 추정)
        async with httpx.AsyncClient() as client:
            # 법정동 코드 조회
            legal_dong_client = LegalDongCodeAPIClient(
                api_key=settings.public_data_api_key,
                client=client
            )
            legal_dong_result = await legal_dong_client.get_legal_dong_code(
                keyword=case['property_address']
            )

            lawd_cd = None
            if legal_dong_result['body']['items']:
                lawd_cd = legal_dong_result['body']['items'][0]['lawd5']
                logger.info(f"법정동코드: {lawd_cd}")

            # 실거래가 조회
            property_value_estimate = None
            if lawd_cd:
                apt_trade_client = AptTradeAPIClient(
                    api_key=settings.public_data_api_key,
                    client=client
                )
                now = datetime.now()
                trade_result = await apt_trade_client.get_apt_trades(
                    lawd_cd=lawd_cd,
                    deal_ymd=f"{now.year}{now.month:02d}"
                )

                # 실거래가 평균 계산
                if trade_result['body']['items']:
                    amounts = [item['dealAmount'] for item in trade_result['body']['items']
                              if item['dealAmount']]
                    if amounts:
                        property_value_estimate = sum(amounts) // len(amounts)
                        logger.info(f"실거래가 평균: {property_value_estimate}만원")

        # 4️⃣ 리스크 엔진 실행 (계약 타입에 따라 분기)
        contract_type = case.get('contract_type', '전세')

        # ContractData 생성 (property_type, sido, sigungu 포함)
        from core.risk_engine import PropertyType, get_default_auction_rate

        # TODO: property_type, sido, sigungu를 case metadata 또는 주소 파싱에서 가져오기
        # 임시로 기본값 설정 (향후 프론트엔드에서 전달받거나 주소 파싱으로 추출)
        property_type = case.get('metadata', {}).get('property_type')  # 예: "아파트"
        sido = case.get('metadata', {}).get('sido')  # 예: "서울특별시"
        sigungu = case.get('metadata', {}).get('sigungu')  # 예: "강남구"
        auction_rate_override = case.get('metadata', {}).get('auction_rate_override')  # 수동 지정값

        contract_data = ContractData(
            contract_type=contract_type,
            deposit=case.get('metadata', {}).get('deposit'),
            price=case.get('metadata', {}).get('price'),
            property_address=case.get('property_address') if contract_type == '매매' else None,
            property_type=PropertyType(property_type) if property_type else None,
            sido=sido,
            sigungu=sigungu,
            auction_rate_override=auction_rate_override,
        )

        # registry_data 업데이트 (임대차 계약인 경우 낙찰가율 적용)
        if registry_data and property_value_estimate and contract_type in ["전세", "월세"]:
            # 낙찰가율 결정
            auction_rate = 0.70  # 기본값

            if auction_rate_override is not None:
                # 수동 지정값 우선 사용
                auction_rate = auction_rate_override
                logger.info(f"낙찰가율 (수동 지정): {auction_rate * 100:.1f}%")
            elif property_type and sido and sigungu:
                # 자동 결정
                auction_rate = get_default_auction_rate(
                    property_type=PropertyType(property_type),
                    sido=sido,
                    sigungu=sigungu
                )
                logger.info(f"낙찰가율 (자동 결정): {auction_rate * 100:.1f}% (타입={property_type}, 지역={sido} {sigungu})")
            else:
                logger.warning(f"낙찰가율 정보 부족 (기본값 70% 사용): property_type={property_type}, sido={sido}, sigungu={sigungu}")

            # 물건 가치 계산: 실거래가 × 낙찰가율
            registry_data.property_value = int(property_value_estimate * auction_rate)
            logger.info(f"물건 가치 계산: {property_value_estimate}만원 × {auction_rate * 100:.1f}% = {registry_data.property_value}만원")
        elif registry_data and property_value_estimate:
            # 매매 계약은 낙찰가율 미적용
            registry_data.property_value = property_value_estimate

        risk_result = None
        market_data = None  # 모든 케이스에서 정의

        if contract_type == '매매':
            # 매매 계약 분석
            from core.risk_engine import MarketData, PropertyValueAssessment, evaluate_property_value_with_llm

            # MarketData 생성 (공공데이터 기반)
            market_data = None
            if property_value_estimate:
                market_data = MarketData(
                    avg_trade_price=property_value_estimate,
                    recent_trades=[],  # TODO: 최근 거래 내역 추가
                    avg_price_per_pyeong=None,  # TODO: 평당가 계산
                )
                logger.info(f"시장 데이터 생성 완료: 평균 실거래가={property_value_estimate}만원")

            # LLM 웹 검색으로 부동산 가치 평가 (학군, 공급량, 직장 수요)
            property_value_assessment = None
            try:
                property_value_assessment = evaluate_property_value_with_llm(case['property_address'])
                logger.info(f"부동산 가치 평가 완료: 총점={property_value_assessment.total_score}점 "
                           f"(학군={property_value_assessment.school_score}, "
                           f"공급={property_value_assessment.supply_score}, "
                           f"직장={property_value_assessment.job_score})")
            except Exception as e:
                logger.warning(f"부동산 가치 평가 실패 (중립 점수로 대체): {str(e)}")
                # 실패 시 None으로 유지 (analyze_risks에서 중립 점수 적용)

            # 매매 리스크 분석 (등기부 선택적)
            risk_result = analyze_risks(
                contract_data,
                registry=registry_data,
                market=market_data,
                property_value=property_value_assessment
            )
            logger.info(f"매매 리스크 분석 완료: 점수={risk_result.risk_score.total_score}, "
                       f"레벨={risk_result.risk_score.risk_level}")
        else:
            # 임대차 계약 분석 (전세/월세)
            if registry_data:
                risk_result = analyze_risks(contract_data, registry_data)
                logger.info(f"임대차 리스크 분석 완료: 점수={risk_result.risk_score.total_score}, "
                           f"레벨={risk_result.risk_score.risk_level}")

        # 5️⃣ 새 아키텍처: RegistryRiskFeatures 변환 + LLM 프롬프트 생성
        from core.report_generator import build_risk_features_from_registry, build_llm_prompt
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage

        # Step 1: RegistryDocument → RegistryRiskFeatures (코드로 100% 계산, LLM 없음)
        risk_features = None
        if artifact_response.data and registry_url:
            risk_features = build_risk_features_from_registry(
                registry_doc=registry_doc,
                contract_deposit=case.get('metadata', {}).get('deposit'),
                contract_price=case.get('metadata', {}).get('price'),
                property_value=registry_data.property_value if registry_data else None
            )
            logger.info(f"리스크 특징 추출 완료 (코드 기반): 총점={risk_features.risk_score:.1f}, "
                       f"전세가율={risk_features.jeonse_ratio or 'N/A'}, "
                       f"근저당비율={risk_features.mortgage_ratio or 'N/A'}")

        # Step 2: RegistryRiskFeatures → LLM 프롬프트 (마크다운)
        llm_prompt = None
        if risk_features:
            llm_prompt = build_llm_prompt(
                risk_features=risk_features,
                contract_type=contract_type,
                contract_deposit=case.get('metadata', {}).get('deposit'),
                contract_price=case.get('metadata', {}).get('price'),
                monthly_rent=case.get('metadata', {}).get('monthly_rent')
            )
            logger.info(f"LLM 프롬프트 생성 완료: {len(llm_prompt)}자")
        else:
            # 등기부 없는 경우 기본 프롬프트
            llm_prompt = f"""
# 부동산 계약 분석 요청

**주소**: {case['property_address']}
**계약 유형**: {contract_type}

**등기부 정보**: 없음

위 정보만으로 간단한 분석을 제공하세요. 등기부가 없으므로 일반적인 주의사항을 안내해주세요.
"""
            logger.warning("등기부 없음 - 기본 프롬프트 사용")

        # Step 3: LLM 호출 (해석만 수행, 파싱/계산 없음)
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3, max_tokens=4096, max_retries=0, timeout=30)
        messages = [HumanMessage(content=llm_prompt)]

        import asyncio
        final_answer = None
        last_err = None
        for attempt in range(1, 4):
            try:
                response = llm.invoke(messages)
                final_answer = response.content
                logger.info(f"LLM 해석 완료 (시도 {attempt}): {len(final_answer)}자")
                break
            except Exception as e:
                last_err = e
                logger.warning(f"LLM 호출 시도 {attempt} 실패: {e}")
                await asyncio.sleep(min(1 * attempt, 3))

        if final_answer is None:
            raise HTTPException(503, "분석이 지연됩니다. 잠시 후 다시 시도해주세요.")

        # 6️⃣ 리포트 저장 (v2_reports 테이블)
        report_response = supabase.table("v2_reports").insert({
            "case_id": case_id,
            "user_id": case['user_id'],
            "content": final_answer,
            "risk_score": risk_result.risk_score.dict() if risk_result else {},
            "registry_data": registry_doc_masked,  # 마스킹된 등기부 정보 저장
            "report_data": {
                "summary": final_answer,
                "risk": risk_result.risk_score.dict() if risk_result else {},
                "registry": registry_doc_masked,
                "market": market_data.dict() if (contract_type == '매매' and market_data) else None
            },
            "metadata": {
                "model": "gpt-4o-mini",
                "confidence": 0.85,
            }
        }).execute()

        if not report_response.data:
            raise HTTPException(500, "Failed to save report")

        report_id = report_response.data[0]['id']
        logger.info(f"리포트 저장 완료: {report_id}")

        # 7️⃣ 대화 카테고리 업데이트 (분석 리포트 태깅)
        # 이 케이스와 연결된 대화를 찾아서 is_analysis_report=TRUE, case_id 설정
        conversation_update = supabase.table("conversations") \
            .update({
                "is_analysis_report": True,
                "case_id": case_id,
                "updated_at": datetime.utcnow().isoformat(),
            }) \
            .eq("user_id", case['user_id']) \
            .or_(f"case_id.eq.{case_id},property_address.eq.{case['property_address']}") \
            .execute()

        if conversation_update.data:
            logger.info(f"대화 카테고리 업데이트 완료: {len(conversation_update.data)}개 대화 → 분석 리포트로 태깅")
        else:
            logger.warning(f"업데이트할 대화를 찾지 못함 (case_id={case_id}, 주소={case['property_address']})")

        # 8️⃣ 상태 전환: parse_enrich → report
        supabase.table("v2_cases").update({
            "current_state": "report",
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", case_id).execute()

        logger.info(f"분석 파이프라인 완료: case_id={case_id}, report_id={report_id}")
        return report_id

    except Exception as e:
        logger.error(f"분석 파이프라인 실패: {e}", exc_info=True)
        # 상태를 다시 registry_ready로 롤백
        supabase.table("v2_cases").update({
            "current_state": "registry_ready",
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", case_id).execute()
        raise

# Reload trigger: 1763539083.3081586
