"""
ZipCheck 분석 파이프라인 - 순수 분석 로직 레이어

케이스 ID로부터 전체 분석 컨텍스트를 구축합니다.
SSE 스트리밍이나 LLM 호출과 무관한 순수 데이터 처리 레이어입니다.

주요 원칙:
- LLM 호출 없음 (LLM은 llm_streaming.py에서 처리)
- SSE 이벤트 생성 없음 (SSE는 routes/analysis.py에서 처리)
- 순수 데이터 변환 및 집계만 수행
"""
import logging
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class AnalysisContext:
    """
    분석 컨텍스트 - 모든 분석 단계의 결과를 집계

    이 클래스는 분석 파이프라인의 모든 중간 결과를 담는 컨테이너입니다.
    각 단계(등기부 파싱, 공공데이터 조회, 리스크 계산)의 결과를 순차적으로 채워갑니다.
    """
    # 기본 케이스 정보
    case_id: str
    case: Dict[str, Any]

    # 계약 데이터
    contract_data: Optional[Any] = None  # ContractData 객체

    # 등기부 파싱 결과
    registry_doc: Optional[Any] = None  # RegistryDocument 객체
    registry_doc_masked: Optional[Dict[str, Any]] = None  # 마스킹된 등기부 (유저 표시용)
    registry_data: Optional[Any] = None  # RegistryData 객체 (내부 분석용)

    # 공공 데이터 조회 결과
    property_value_estimate: Optional[int] = None  # 평균 실거래가 (만원)
    jeonse_market_average: Optional[int] = None  # 전세 시장 평균 (만원)
    recent_transactions: List[Dict[str, Any]] = None  # 최근 거래 내역

    # 리스크 분석 결과
    risk_result: Optional[Any] = None  # RiskAnalysisResult 객체
    risk_features: Optional[Any] = None  # RegistryRiskFeatures 객체

    # LLM 프롬프트 (생성만, 실행은 llm_streaming.py에서)
    llm_prompt: Optional[str] = None

    def __post_init__(self):
        """초기화 후 검증"""
        if self.recent_transactions is None:
            self.recent_transactions = []


async def build_analysis_context(case_id: str) -> AnalysisContext:
    """
    케이스 ID로부터 전체 분석 컨텍스트 생성

    이 함수는 다음 단계를 순차적으로 실행합니다:
    1. 케이스 데이터 조회 (v2_cases)
    2. 등기부 파싱 (v2_artifacts)
    3. 공공데이터 조회 (법정동코드, 실거래가)
    4. 리스크 엔진 실행
    5. 리스크 특징 추출
    6. LLM 프롬프트 생성

    Args:
        case_id: 분석 케이스 UUID

    Returns:
        AnalysisContext: 모든 분석 결과가 담긴 컨텍스트

    Raises:
        HTTPException: 케이스를 찾을 수 없거나 분석 중 오류 발생 시
    """
    from fastapi import HTTPException
    from core.supabase_client import get_supabase_client, supabase_storage

    logger.info(f"📊 [분석 파이프라인] 시작: case_id={case_id}")

    # Service Role Key 사용 (RLS 우회)
    supabase = get_supabase_client(service_role=True)

    # 1️⃣ 케이스 데이터 조회
    case_response = supabase.table("v2_cases").select("*").eq("id", case_id).execute()
    if not case_response.data:
        raise HTTPException(404, f"케이스를 찾을 수 없습니다: {case_id}")

    case = case_response.data[0]
    logger.info(f"✅ [1/6] 케이스 조회 완료: {case['property_address']}")

    # AnalysisContext 초기화
    context = AnalysisContext(case_id=case_id, case=case)

    # 2️⃣ 등기부 파싱 (선택적)
    await _parse_registry(context, supabase)

    # 3️⃣ 공공데이터 조회 (선택적)
    await _fetch_public_data(context)

    # 4️⃣ 리스크 엔진 실행
    await _analyze_risks(context)

    # 5️⃣ 리스크 특징 추출 (LLM 프롬프트 생성용)
    await _extract_risk_features(context)

    # 6️⃣ LLM 프롬프트 생성 (실행은 llm_streaming.py에서)
    await _build_llm_prompt(context)

    logger.info(f"✅ [분석 파이프라인] 완료: case_id={case_id}")
    return context


async def _parse_registry(context: AnalysisContext, supabase) -> None:
    """
    등기부 파싱 단계

    v2_artifacts에서 registry_pdf를 조회하고 파싱합니다.
    파싱 결과는 context.registry_doc, context.registry_data에 저장됩니다.
    """
    from ingest.registry_parser import parse_registry_from_url
    from core.risk_engine import RegistryData

    artifact_response = supabase.table("v2_artifacts") \
        .select("*") \
        .eq("case_id", context.case_id) \
        .eq("artifact_type", "registry_pdf") \
        .execute()

    if not artifact_response.data:
        logger.info(f"ℹ️ [2/6] 등기부 없음 (선택적)")
        return

    # 동적 Signed URL 생성 (1시간 만료)
    file_path = artifact_response.data[0].get("file_path")
    if not file_path:
        logger.warning(f"⚠️ [2/6] 등기부 파일 경로 누락")
        return

    bucket, path = file_path.split("/", 1)
    from core.supabase_client import supabase_storage
    registry_url = await supabase_storage.get_signed_url(bucket, path, expires_in=3600)

    logger.info(f"📄 [2/6] 등기부 파싱 시작: {file_path}")

    # 감사 로그 컨텍스트 전달
    context.registry_doc = await parse_registry_from_url(
        registry_url,
        case_id=context.case_id,
        user_id=context.case['user_id']
    )

    # RegistryData 모델로 변환 (내부 분석용 - 원본 사용)
    context.registry_data = RegistryData(
        property_value=None,  # 공공 데이터에서 추정
        mortgage_total=sum([m.amount or 0 for m in context.registry_doc.mortgages]),
        seizure_exists=any(s.type == "압류" for s in context.registry_doc.seizures),
        provisional_attachment_exists=any(s.type == "가압류" for s in context.registry_doc.seizures),
        ownership_disputes=False  # TODO: 소유권 분쟁 감지 로직
    )

    # 마스킹된 버전 (유저 표시용)
    context.registry_doc_masked = context.registry_doc.to_masked_dict()

    logger.info(f"✅ [2/6] 등기부 파싱 완료: 근저당 {context.registry_data.mortgage_total}만원, "
                f"압류={context.registry_data.seizure_exists}, "
                f"가압류={context.registry_data.provisional_attachment_exists}")


async def _fetch_public_data(context: AnalysisContext) -> None:
    """
    공공데이터 조회 단계

    법정동코드 조회 → 실거래가 조회 → property_value 추정
    결과는 context.property_value_estimate, context.recent_transactions에 저장됩니다.
    """
    from core.public_data_api import AptTradeAPIClient, AptRentAPIClient, LegalDongCodeAPIClient
    from core.settings import settings
    import httpx

    logger.info(f"🔍 [3/6] 공공데이터 조회 시작")

    # 헬퍼 함수들 (analysis.py에서 추출)
    def get_previous_month(year: int, month: int, months_back: int = 1) -> str:
        """이전 월 계산 (YYYYMM 형식)"""
        from datetime import datetime
        from dateutil.relativedelta import relativedelta
        current_date = datetime(year, month, 1)
        target_date = current_date - relativedelta(months=months_back)
        return f"{target_date.year}{target_date.month:02d}"

    def calculate_average_exclude_outliers(amounts: list[int]) -> Optional[int]:
        """최댓값/최솟값 제외 평균 계산"""
        if len(amounts) <= 2:
            return sum(amounts) // len(amounts) if amounts else None
        sorted_amounts = sorted(amounts)
        filtered_amounts = sorted_amounts[1:-1]
        if not filtered_amounts:
            return None
        return sum(filtered_amounts) // len(filtered_amounts)

    async with httpx.AsyncClient() as client:
        # 법정동 코드 조회
        legal_dong_client = LegalDongCodeAPIClient(
            api_key=settings.public_data_api_key,
            client=client
        )
        legal_dong_result = await legal_dong_client.get_legal_dong_code(
            keyword=context.case['property_address']
        )

        lawd_cd = None
        if legal_dong_result['body']['items']:
            lawd_cd = legal_dong_result['body']['items'][0]['lawd5']
            logger.info(f"✅ [3/6] 법정동코드: {lawd_cd}")

        if not lawd_cd:
            logger.warning(f"⚠️ [3/6] 법정동코드 조회 실패")
            return

        now = datetime.now()
        contract_type = context.case.get('contract_type', '전세')

        # 전세/월세: 듀얼 API (전세 6개월 + 매매 3개월)
        if contract_type in ["전세", "월세"]:
            logger.info(f"📊 [3/6] 듀얼 API - 전세(6개월) + 매매(3개월) 조회")

            # (1) 전세 실거래가 조회
            apt_rent_client = AptRentAPIClient(
                api_key=settings.public_data_api_key,
                client=client
            )

            jeonse_amounts = []
            for months_back in range(6):
                deal_ymd = get_previous_month(now.year, now.month, months_back)
                try:
                    rent_result = await apt_rent_client.get_apt_rent_transactions(
                        lawd_cd=lawd_cd,
                        deal_ymd=deal_ymd
                    )
                    if rent_result['body']['items']:
                        for item in rent_result['body']['items']:
                            if item.get('deposit') and not item.get('monthlyRent'):
                                jeonse_amounts.append(item['deposit'])
                except Exception as e:
                    logger.warning(f"전세 실거래가 조회 실패 ({deal_ymd}): {e}")

            if jeonse_amounts:
                context.jeonse_market_average = sum(jeonse_amounts) // len(jeonse_amounts)
                logger.info(f"✅ [3/6] 전세 평균: {context.jeonse_market_average:,}만원 ({len(jeonse_amounts)}건)")

            # (2) 매매 실거래가 조회
            apt_trade_client = AptTradeAPIClient(
                api_key=settings.public_data_api_key,
                client=client
            )

            sale_amounts = []
            for months_back in range(3):
                deal_ymd = get_previous_month(now.year, now.month, months_back)
                try:
                    trade_result = await apt_trade_client.get_apt_trades(
                        lawd_cd=lawd_cd,
                        deal_ymd=deal_ymd
                    )
                    if trade_result['body']['items']:
                        context.recent_transactions.extend(trade_result['body']['items'])
                        for item in trade_result['body']['items']:
                            if item.get('dealAmount'):
                                sale_amounts.append(item['dealAmount'])
                except Exception as e:
                    logger.warning(f"매매 실거래가 조회 실패 ({deal_ymd}): {e}")

            if sale_amounts:
                context.property_value_estimate = calculate_average_exclude_outliers(sale_amounts)
                logger.info(f"✅ [3/6] 매매 평균: {context.property_value_estimate:,}만원 ({len(sale_amounts)}건)")

        # 매매: 단일 API (현재 월만)
        else:
            logger.info(f"📊 [3/6] 단일 API - 매매(현재 월) 조회")
            deal_ymd = f"{now.year}{now.month:02d}"

            apt_trade_client = AptTradeAPIClient(
                api_key=settings.public_data_api_key,
                client=client
            )
            trade_result = await apt_trade_client.get_apt_trades(
                lawd_cd=lawd_cd,
                deal_ymd=deal_ymd
            )

            if trade_result['body']['items']:
                context.recent_transactions = trade_result['body']['items']
                amounts = [item['dealAmount'] for item in context.recent_transactions
                          if item.get('dealAmount')]
                if amounts:
                    context.property_value_estimate = sum(amounts) // len(amounts)
                    logger.info(f"✅ [3/6] 매매 평균: {context.property_value_estimate:,}만원 ({len(amounts)}건)")


async def _analyze_risks(context: AnalysisContext) -> None:
    """
    리스크 엔진 실행 단계

    ContractData와 RegistryData를 기반으로 리스크 분석을 수행합니다.
    결과는 context.risk_result에 저장됩니다.
    """
    from core.risk_engine import (
        analyze_risks, ContractData, PropertyType,
        get_default_auction_rate, MarketData
    )

    logger.info(f"📊 [4/6] 리스크 엔진 시작")

    # ContractData 생성
    contract_type = context.case.get('contract_type', '전세')
    property_type = context.case.get('metadata', {}).get('property_type')
    sido = context.case.get('metadata', {}).get('sido')
    sigungu = context.case.get('metadata', {}).get('sigungu')
    auction_rate_override = context.case.get('metadata', {}).get('auction_rate_override')

    context.contract_data = ContractData(
        contract_type=contract_type,
        deposit=context.case.get('metadata', {}).get('deposit'),
        price=context.case.get('metadata', {}).get('price'),
        property_address=context.case.get('property_address') if contract_type == '매매' else None,
        property_type=PropertyType(property_type) if property_type else None,
        sido=sido,
        sigungu=sigungu,
        auction_rate_override=auction_rate_override,
    )

    # registry_data 업데이트 (낙찰가율 적용)
    if context.registry_data and context.property_value_estimate and contract_type in ["전세", "월세"]:
        auction_rate = 0.70  # 기본값

        if auction_rate_override is not None:
            auction_rate = auction_rate_override
        elif property_type and sido and sigungu:
            auction_rate = get_default_auction_rate(
                property_type=PropertyType(property_type),
                sido=sido,
                sigungu=sigungu
            )

        context.registry_data.property_value = int(context.property_value_estimate * auction_rate)
        logger.info(f"💰 [4/6] 물건 가치: {context.property_value_estimate}만원 × {auction_rate*100:.0f}% = {context.registry_data.property_value}만원")
    elif context.registry_data and context.property_value_estimate:
        context.registry_data.property_value = context.property_value_estimate

    # 리스크 분석 실행
    if contract_type == '매매':
        market_data = MarketData(
            avg_trade_price=context.property_value_estimate,
            recent_trades=[],
            avg_price_per_pyeong=None,
        ) if context.property_value_estimate else None

        context.risk_result = analyze_risks(
            context.contract_data,
            registry=context.registry_data,
            market=market_data,
            property_value=None  # TODO: LLM 웹 검색 가치 평가
        )
    else:
        if context.registry_data:
            context.risk_result = analyze_risks(context.contract_data, context.registry_data)

    if context.risk_result:
        logger.info(f"✅ [4/6] 리스크 분석 완료: 점수={context.risk_result.risk_score.total_score:.1f}, "
                    f"레벨={context.risk_result.risk_score.risk_level}")


async def _extract_risk_features(context: AnalysisContext) -> None:
    """
    리스크 특징 추출 단계

    RegistryDocument → RegistryRiskFeatures 변환 (코드 기반, LLM 없음)
    결과는 context.risk_features에 저장됩니다.
    """
    from core.report_generator import build_risk_features_from_registry

    if not context.registry_doc:
        logger.info(f"ℹ️ [5/6] 등기부 없음 - 리스크 특징 추출 생략")
        return

    logger.info(f"🔍 [5/6] 리스크 특징 추출 시작")

    context.risk_features = build_risk_features_from_registry(
        registry_doc=context.registry_doc,
        contract_deposit=context.case.get('metadata', {}).get('deposit'),
        contract_price=context.case.get('metadata', {}).get('price'),
        property_value=context.registry_data.property_value if context.registry_data else None
    )

    logger.info(f"✅ [5/6] 리스크 특징 추출 완료: 총점={context.risk_features.risk_score:.1f}")


async def _build_llm_prompt(context: AnalysisContext) -> None:
    """
    LLM 프롬프트 생성 단계

    RegistryRiskFeatures → Markdown 프롬프트 변환
    결과는 context.llm_prompt에 저장됩니다.
    LLM 실행은 llm_streaming.py에서 수행합니다.
    """
    from core.report_generator import build_llm_prompt

    logger.info(f"📝 [6/6] LLM 프롬프트 생성 시작")

    if context.risk_features:
        contract_type = context.case.get('contract_type', '전세')
        context.llm_prompt = build_llm_prompt(
            risk_features=context.risk_features,
            contract_type=contract_type,
            contract_deposit=context.case.get('metadata', {}).get('deposit'),
            contract_price=context.case.get('metadata', {}).get('price'),
            monthly_rent=context.case.get('metadata', {}).get('monthly_rent'),
            property_value_estimate=context.property_value_estimate,
            jeonse_market_average=context.jeonse_market_average,
            recent_transactions=context.recent_transactions,
        )
    else:
        # 등기부 없는 경우 기본 프롬프트
        contract_type = context.case.get('contract_type', '전세')
        context.llm_prompt = f"""
# 부동산 계약 분석 요청

**주소**: {context.case['property_address']}
**계약 유형**: {contract_type}

**등기부 정보**: 없음

위 정보만으로 간단한 분석을 제공하세요. 등기부가 없으므로 일반적인 주의사항을 안내해주세요.
"""

    logger.info(f"✅ [6/6] LLM 프롬프트 생성 완료: {len(context.llm_prompt)}자")
