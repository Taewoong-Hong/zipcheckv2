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
from core.supabase_client import get_supabase_client
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
    분석 시작

    - 케이스 상태를 "analysis"로 전환
    - 백그라운드 작업 큐에 분석 태스크 등록 (TODO: P2에서 구현)
    """
    supabase = get_supabase_client()

    # 케이스 조회
    case_response = supabase.table("v2_cases") \
        .select("*") \
        .eq("id", request.case_id) \
        .eq("user_id", user["sub"]) \
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

    # parse_enrich 상태 유지 (DB 상태 전환 없이 비동기 분석 시작)

    # 백그라운드에서 분석 파이프라인 실행 (비블로킹)
    import asyncio
    asyncio.create_task(execute_analysis_pipeline(request.case_id))

    return AnalysisStatusResponse(
        case_id=request.case_id,
        current_state="parse_enrich",
        progress=STATE_PROGRESS["parse_enrich"],
        message="분석이 시작되었습니다. 잠시만 기다려주세요.",
    )


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
        HumanMessage(content="검증을 수행하세요."),
    ]
    resp = llm.invoke(msgs)
    return CrosscheckResponse(validation=resp.content)


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
            registry_url = artifact_response.data[0].get("file_url")
            if registry_url:
                logger.info(f"등기부 파싱 시작: {registry_url}")
                registry_doc = await parse_registry_from_url(registry_url)

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

        # registry_data 업데이트
        if registry_data and property_value_estimate:
            registry_data.property_value = property_value_estimate

        # 4️⃣ 리스크 엔진 실행 (계약 타입에 따라 분기)
        contract_type = case.get('contract_type', '전세')
        contract_data = ContractData(
            contract_type=contract_type,
            deposit=case.get('metadata', {}).get('deposit'),
            price=case.get('metadata', {}).get('price'),
            property_address=case.get('property_address') if contract_type == '매매' else None,
        )

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

        # 5️⃣ LLM 단일 시스템 (ChatGPT only - 테스트용)
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import SystemMessage, HumanMessage

        context = f"""
주소: {case['property_address']}
계약 유형: {case['contract_type']}

등기부 정보:
- 총 근저당: {registry_data.mortgage_total if registry_data else 0}만원
- 압류: {'있음' if registry_data and registry_data.seizure_exists else '없음'}
- 가압류: {'있음' if registry_data and registry_data.provisional_attachment_exists else '없음'}

리스크 분석:
- 총 점수: {risk_result.risk_score.total_score if risk_result else 0}점
- 리스크 레벨: {risk_result.risk_score.risk_level if risk_result else '알 수 없음'}
- 전세가율: {risk_result.risk_score.jeonse_ratio if risk_result and risk_result.risk_score.jeonse_ratio else 'N/A'}%
- 위험 요인: {', '.join(risk_result.risk_score.risk_factors) if risk_result else 'N/A'}

협상 포인트:
{chr(10).join([f'- [{p.category}] {p.point} (영향: {p.impact})' for p in risk_result.negotiation_points]) if risk_result else 'N/A'}

권장 조치:
{chr(10).join([f'- {r}' for r in risk_result.recommendations]) if risk_result else 'N/A'}
"""

        # 단일 모델로 간단히 테스트 (타임아웃/재시도)
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3, max_tokens=4096, max_retries=0, timeout=30)
        messages = [
            SystemMessage(content="너는 부동산 계약 리스크 점검 전문가이다. 위 정보를 바탕으로 종합 분석 리포트를 작성하라."),
            HumanMessage(content=f"{context}\n\n위 부동산 계약의 종합 분석 리포트를 작성해주세요.")
        ]
        import asyncio
        final_answer = None
        last_err = None
        for attempt in range(1, 4):
            try:
                response = llm.invoke(messages)
                final_answer = response.content
                logger.info(f"LLM 분석 완료 (시도 {attempt})")
                break
            except Exception as e:
                last_err = e
                logger.warning(f"LLM 분석 시도 {attempt} 실패: {e}")
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

        # 7️⃣ 상태 전환: parse_enrich → report
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
