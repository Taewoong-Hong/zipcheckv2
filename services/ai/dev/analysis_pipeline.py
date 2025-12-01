"""
집체크 Analysis Lab - 코어 분석 파이프라인 모듈

개발자용 디버깅 전용. LLM 없이 데이터 파싱/수집/요약 검증.
"""
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel
import httpx

from dev.event_logger import dev_logger, StepLogger

logger = logging.getLogger(__name__)


# ===========================
# Data Models
# ===========================
class ParsedRegistryResult(BaseModel):
    """등기부 파싱 결과"""
    success: bool
    registry_doc_masked: Optional[Dict[str, Any]] = None
    registry_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time_ms: int
    metadata: Dict[str, Any] = {}


class PublicDataResult(BaseModel):
    """공공 데이터 수집 결과"""
    success: bool
    legal_dong_code: Optional[str] = None
    property_value_estimate: Optional[int] = None
    jeonse_market_average: Optional[int] = None
    recent_transactions: List[Dict[str, Any]] = []
    # 건축물대장 데이터
    building_ledger: Optional[Dict[str, Any]] = None
    # 주소 변환 결과
    address_convert_result: Optional[Dict[str, Any]] = None
    errors: List[str] = []
    execution_time_ms: int
    metadata: Dict[str, Any] = {}


class SummaryResult(BaseModel):
    """요약 리포트 결과"""
    success: bool
    summary: Optional[str] = None
    risk_score: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time_ms: int
    metadata: Dict[str, Any] = {}


# ===========================
# Core Functions
# ===========================
async def parse_registry(case_id: str) -> ParsedRegistryResult:
    """
    등기부 파싱 (코어 로직만, LLM 없음)

    Args:
        case_id: 케이스 UUID

    Returns:
        ParsedRegistryResult: 파싱 결과 (마스킹된 데이터 포함)
    """
    from core.supabase_client import get_supabase_client, supabase_storage
    from ingest.registry_parser import parse_registry_from_url
    from core.risk_engine import RegistryData

    with StepLogger(case_id, "parse_registry"):
        start_time = datetime.now()
        supabase = get_supabase_client(service_role=True)

        try:
            # 케이스 조회
            dev_logger.log_api_call(case_id, "parse_registry", "supabase.v2_cases.select",
                                    {"case_id": case_id})
            api_start = datetime.now()

            case_response = supabase.table("v2_cases").select("*").eq("id", case_id).execute()

            api_time = int((datetime.now() - api_start).total_seconds() * 1000)
            dev_logger.log_api_response(case_id, "parse_registry", "supabase.v2_cases.select",
                                       status_code=200 if case_response.data else 404,
                                       response_time_ms=api_time,
                                       success=bool(case_response.data))

            if not case_response.data:
                return ParsedRegistryResult(
                    success=False,
                    error=f"Case not found: {case_id}",
                    execution_time_ms=0,
                )

            case = case_response.data[0]

            # 등기부 PDF 조회
            dev_logger.log_api_call(case_id, "parse_registry", "supabase.v2_artifacts.select",
                                    {"case_id": case_id, "artifact_type": "registry_pdf"})
            api_start = datetime.now()

            artifact_response = supabase.table("v2_artifacts") \
                .select("*") \
                .eq("case_id", case_id) \
                .eq("artifact_type", "registry_pdf") \
                .execute()

            api_time = int((datetime.now() - api_start).total_seconds() * 1000)
            dev_logger.log_api_response(case_id, "parse_registry", "supabase.v2_artifacts.select",
                                       status_code=200 if artifact_response.data else 404,
                                       response_time_ms=api_time,
                                       success=bool(artifact_response.data))

            if not artifact_response.data:
                return ParsedRegistryResult(
                    success=False,
                    error="Registry PDF not found",
                    execution_time_ms=int((datetime.now() - start_time).total_seconds() * 1000),
                )

            # Signed URL 생성
            dev_logger.log_api_call(case_id, "parse_registry", "supabase_storage.get_signed_url",
                                    {"file_path": artifact_response.data[0].get("file_path")})
            api_start = datetime.now()

            file_path = artifact_response.data[0].get("file_path")
            bucket, path = file_path.split("/", 1)
            registry_url = await supabase_storage.get_signed_url(bucket, path, expires_in=3600)

            api_time = int((datetime.now() - api_start).total_seconds() * 1000)
            dev_logger.log_api_response(case_id, "parse_registry", "supabase_storage.get_signed_url",
                                       status_code=200,
                                       response_time_ms=api_time,
                                       success=True)

            # 등기부 파싱 (3000ms 임계값 모니터링)
            parse_start = datetime.now()
            dev_logger.log_api_call(case_id, "parse_registry", "parse_registry_from_url",
                                    {"registry_url": registry_url[:100]})

            registry_doc = await parse_registry_from_url(registry_url, case_id=case_id, user_id=case['user_id'])

            parse_time = int((datetime.now() - parse_start).total_seconds() * 1000)
            dev_logger.log_api_response(case_id, "parse_registry", "parse_registry_from_url",
                                       response_time_ms=parse_time,
                                       success=True)

            # 느린 작업 감지 (3000ms 임계값)
            if parse_time > 3000:
                dev_logger.log_slow_operation(
                    case_id, "parse_registry", "PDF 파싱", parse_time, threshold_ms=3000
                )

            # RegistryData 모델로 변환 (말소되지 않은 근저당/압류만 계산)
            active_mortgages = [m for m in registry_doc.mortgages if not m.is_deleted]
            active_seizures = [s for s in registry_doc.seizures if not s.is_deleted]

            registry_data = RegistryData(
                property_value=None,
                mortgage_total=sum([m.amount or 0 for m in active_mortgages]),
                seizure_exists=any(s.type == "압류" for s in active_seizures),
                provisional_attachment_exists=any(s.type == "가압류" for s in active_seizures),
                ownership_disputes=False
            )

            # 마스킹된 버전
            registry_doc_masked = registry_doc.to_masked_dict()

            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)

            return ParsedRegistryResult(
                success=True,
                registry_doc_masked=registry_doc_masked,
                registry_data=registry_data.dict(),
                execution_time_ms=execution_time,
                metadata={
                    "address": registry_doc.property_address,
                    "owner_count": 1 if registry_doc.owner else 0,
                    "mortgage_count": len(registry_doc.mortgages),
                    "active_mortgage_count": len(active_mortgages),
                    "deleted_mortgage_count": len(registry_doc.mortgages) - len(active_mortgages),
                    "seizure_count": len(registry_doc.seizures),
                    "active_seizure_count": len(active_seizures),
                    "deleted_seizure_count": len(registry_doc.seizures) - len(active_seizures),
                }
            )

        except Exception as e:
            logger.error(f"등기부 파싱 실패: {e}", exc_info=True)
            return ParsedRegistryResult(
                success=False,
                error=str(e),
                execution_time_ms=int((datetime.now() - start_time).total_seconds() * 1000),
            )


async def collect_public_data(
    case_id: str,
    force: bool = False
) -> PublicDataResult:
    """
    공공 데이터 수집 (주소 변환 + 법정동코드 + 실거래가 + 건축물대장)

    Args:
        case_id: 케이스 UUID
        force: 강제 재수집 여부

    Returns:
        PublicDataResult: 수집 결과
    """
    from core.supabase_client import get_supabase_client
    from core.public_data_api import AptTradeAPIClient, LegalDongCodeAPIClient, AptRentAPIClient
    from core.address_converter import AddressConverter
    from core.building_ledger_api import BuildingLedgerAPIClient
    from core.settings import settings
    from datetime import datetime
    from dateutil.relativedelta import relativedelta

    with StepLogger(case_id, "collect_public_data", {"force": force}):
        start_time = datetime.now()
        supabase = get_supabase_client(service_role=True)
        errors = []
        building_ledger = None
        address_convert_result = None

        try:
            # 케이스 조회
            dev_logger.log_api_call(case_id, "collect_public_data", "supabase.v2_cases.select",
                                    {"case_id": case_id})
            api_start = datetime.now()

            case_response = supabase.table("v2_cases").select("*").eq("id", case_id).execute()

            api_time = int((datetime.now() - api_start).total_seconds() * 1000)
            dev_logger.log_api_response(case_id, "collect_public_data", "supabase.v2_cases.select",
                                       status_code=200 if case_response.data else 404,
                                       response_time_ms=api_time,
                                       success=bool(case_response.data))

            if not case_response.data:
                return PublicDataResult(
                    success=False,
                    errors=[f"Case not found: {case_id}"],
                    execution_time_ms=0,
                )

            case = case_response.data[0]
            contract_type = case.get('contract_type', '전세')
            property_address = case.get('property_address', '')

            async with httpx.AsyncClient() as client:
                # ======================================
                # Step 2.1: 주소 변환 (AddressConverter)
                # ======================================
                dev_logger.log_api_call(case_id, "collect_public_data", "address_converter",
                                        {"address": property_address})
                api_start = datetime.now()

                try:
                    converter = AddressConverter()
                    converter.client = client  # 기존 httpx client 재사용
                    addr_result = await converter.convert(property_address)
                    address_convert_result = addr_result.dict()

                    api_time = int((datetime.now() - api_start).total_seconds() * 1000)
                    dev_logger.log_api_response(case_id, "collect_public_data", "address_converter",
                                               response_time_ms=api_time,
                                               success=addr_result.success)

                    if not addr_result.success:
                        errors.append(f"주소 변환 실패: {addr_result.error}")

                    # 느린 작업 감지 (3000ms 임계값)
                    if api_time > 3000:
                        dev_logger.log_slow_operation(
                            case_id, "collect_public_data", "주소 변환", api_time, threshold_ms=3000
                        )
                except Exception as e:
                    errors.append(f"주소 변환 오류: {str(e)}")
                    addr_result = None

                # ======================================
                # Step 2.2: 건축물대장 조회 (BuildingLedgerAPI)
                # ======================================
                if addr_result and addr_result.success and addr_result.sigungu_cd and addr_result.bjdong_cd:
                    dev_logger.log_api_call(case_id, "collect_public_data", "building_ledger_api",
                                            {"sigungu_cd": addr_result.sigungu_cd,
                                             "bjdong_cd": addr_result.bjdong_cd,
                                             "bun": addr_result.bun,
                                             "ji": addr_result.ji})
                    api_start = datetime.now()

                    try:
                        building_client = BuildingLedgerAPIClient()
                        building_client.client = client  # 기존 httpx client 재사용

                        ledger_result = await building_client.search_building_by_address(
                            sigungu_cd=addr_result.sigungu_cd,
                            bjdong_cd=addr_result.bjdong_cd,
                            plat_gb_cd="0",  # 대지
                            bun=addr_result.bun or "",
                            ji=addr_result.ji or ""
                        )

                        api_time = int((datetime.now() - api_start).total_seconds() * 1000)
                        dev_logger.log_api_response(case_id, "collect_public_data", "building_ledger_api",
                                                   response_time_ms=api_time,
                                                   success=ledger_result.get('success', False))

                        if ledger_result.get('success') and ledger_result.get('items'):
                            building_ledger = ledger_result['items'][0]
                            logger.info(f"건축물대장 조회 성공: {building_ledger.get('bldNm', 'N/A')}")
                        else:
                            errors.append("건축물대장 조회 결과 없음")

                        # 느린 작업 감지 (3000ms 임계값)
                        if api_time > 3000:
                            dev_logger.log_slow_operation(
                                case_id, "collect_public_data", "건축물대장 조회", api_time, threshold_ms=3000
                            )

                    except Exception as e:
                        errors.append(f"건축물대장 조회 오류: {str(e)}")
                        logger.warning(f"건축물대장 조회 실패: {e}")

                # ======================================
                # Step 2.3: 법정동 코드 조회 (기존 로직)
                # ======================================
                dev_logger.log_api_call(case_id, "collect_public_data", "legal_dong_api",
                                        {"keyword": property_address})
                api_start = datetime.now()

                legal_dong_client = LegalDongCodeAPIClient(
                    api_key=settings.public_data_api_key,
                    client=client
                )
                legal_dong_result = await legal_dong_client.get_legal_dong_code(
                    keyword=property_address
                )

                api_time = int((datetime.now() - api_start).total_seconds() * 1000)
                dev_logger.log_api_response(case_id, "collect_public_data", "legal_dong_api",
                                           response_time_ms=api_time,
                                           success=bool(legal_dong_result['body']['items']))

                # 느린 작업 감지 (2000ms 임계값)
                if api_time > 2000:
                    dev_logger.log_slow_operation(
                        case_id, "collect_public_data", "법정동코드 조회", api_time, threshold_ms=2000
                    )

                # 법정동코드 결정: AddressConverter 결과 우선, 없으면 legal_dong_api 사용
                lawd_cd = None
                if addr_result and addr_result.success and addr_result.lawd_cd:
                    lawd_cd = addr_result.lawd_cd
                    logger.info(f"법정동코드 (AddressConverter): {lawd_cd}")
                elif legal_dong_result['body']['items']:
                    lawd_cd = legal_dong_result['body']['items'][0]['lawd5']
                    logger.info(f"법정동코드 (LegalDongAPI): {lawd_cd}")
                else:
                    errors.append("법정동코드 조회 실패")

                # 실거래가 조회
                property_value_estimate = None
                jeonse_market_average = None
                recent_transactions = []

                if lawd_cd:
                    now = datetime.now()

                    # 전세/월세: 듀얼 API
                    if contract_type in ["전세", "월세"]:
                        # (1) 전세 실거래가
                        apt_rent_client = AptRentAPIClient(
                            api_key=settings.public_data_api_key,
                            client=client
                        )

                        jeonse_amounts = []
                        for months_back in range(6):
                            current_date = datetime(now.year, now.month, 1)
                            target_date = current_date - relativedelta(months=months_back)
                            deal_ymd = f"{target_date.year}{target_date.month:02d}"

                            try:
                                dev_logger.log_api_call(case_id, "collect_public_data",
                                                       f"apt_rent_api_{deal_ymd}",
                                                       {"lawd_cd": lawd_cd, "deal_ymd": deal_ymd})
                                api_start = datetime.now()

                                rent_result = await apt_rent_client.get_apt_rent_transactions(
                                    lawd_cd=lawd_cd,
                                    deal_ymd=deal_ymd
                                )

                                api_time = int((datetime.now() - api_start).total_seconds() * 1000)
                                dev_logger.log_api_response(case_id, "collect_public_data",
                                                           f"apt_rent_api_{deal_ymd}",
                                                           response_time_ms=api_time,
                                                           success=bool(rent_result['body']['items']))

                                # 느린 작업 감지
                                if api_time > 2000:
                                    dev_logger.log_slow_operation(
                                        case_id, "collect_public_data",
                                        f"전세 실거래가 조회 ({deal_ymd})", api_time, threshold_ms=2000
                                    )

                                if rent_result['body']['items']:
                                    for item in rent_result['body']['items']:
                                        if item.get('deposit') and not item.get('monthlyRent'):
                                            jeonse_amounts.append(item['deposit'])
                            except Exception as e:
                                errors.append(f"전세 실거래가 조회 실패 ({deal_ymd}): {e}")

                        if jeonse_amounts:
                            jeonse_market_average = sum(jeonse_amounts) // len(jeonse_amounts)

                        # (2) 매매 실거래가
                        apt_trade_client = AptTradeAPIClient(
                            api_key=settings.public_data_api_key,
                            client=client
                        )

                        sale_amounts = []
                        for months_back in range(3):
                            current_date = datetime(now.year, now.month, 1)
                            target_date = current_date - relativedelta(months=months_back)
                            deal_ymd = f"{target_date.year}{target_date.month:02d}"

                            try:
                                dev_logger.log_api_call(case_id, "collect_public_data",
                                                       f"apt_trade_api_{deal_ymd}",
                                                       {"lawd_cd": lawd_cd, "deal_ymd": deal_ymd})
                                api_start = datetime.now()

                                trade_result = await apt_trade_client.get_apt_trades(
                                    lawd_cd=lawd_cd,
                                    deal_ymd=deal_ymd
                                )

                                api_time = int((datetime.now() - api_start).total_seconds() * 1000)
                                dev_logger.log_api_response(case_id, "collect_public_data",
                                                           f"apt_trade_api_{deal_ymd}",
                                                           response_time_ms=api_time,
                                                           success=bool(trade_result['body']['items']))

                                # 느린 작업 감지
                                if api_time > 2000:
                                    dev_logger.log_slow_operation(
                                        case_id, "collect_public_data",
                                        f"매매 실거래가 조회 ({deal_ymd})", api_time, threshold_ms=2000
                                    )

                                if trade_result['body']['items']:
                                    recent_transactions.extend(trade_result['body']['items'])
                                    for item in trade_result['body']['items']:
                                        if item.get('dealAmount'):
                                            sale_amounts.append(item['dealAmount'])
                            except Exception as e:
                                errors.append(f"매매 실거래가 조회 실패 ({deal_ymd}): {e}")

                        # 최대/최소 제외 평균
                        if len(sale_amounts) > 2:
                            sorted_amounts = sorted(sale_amounts)
                            filtered_amounts = sorted_amounts[1:-1]
                            property_value_estimate = sum(filtered_amounts) // len(filtered_amounts)
                        elif sale_amounts:
                            property_value_estimate = sum(sale_amounts) // len(sale_amounts)

                    # 매매 계약: 단일 API
                    else:
                        apt_trade_client = AptTradeAPIClient(
                            api_key=settings.public_data_api_key,
                            client=client
                        )
                        deal_ymd = f"{now.year}{now.month:02d}"

                        try:
                            dev_logger.log_api_call(case_id, "collect_public_data",
                                                   f"apt_trade_api_{deal_ymd}",
                                                   {"lawd_cd": lawd_cd, "deal_ymd": deal_ymd})
                            api_start = datetime.now()

                            trade_result = await apt_trade_client.get_apt_trades(
                                lawd_cd=lawd_cd,
                                deal_ymd=deal_ymd
                            )

                            api_time = int((datetime.now() - api_start).total_seconds() * 1000)
                            dev_logger.log_api_response(case_id, "collect_public_data",
                                                       f"apt_trade_api_{deal_ymd}",
                                                       response_time_ms=api_time,
                                                       success=bool(trade_result['body']['items']))

                            # 느린 작업 감지
                            if api_time > 2000:
                                dev_logger.log_slow_operation(
                                    case_id, "collect_public_data",
                                    f"매매 실거래가 조회 ({deal_ymd})", api_time, threshold_ms=2000
                                )

                            if trade_result['body']['items']:
                                recent_transactions = trade_result['body']['items']
                                amounts = [item['dealAmount'] for item in recent_transactions if item['dealAmount']]
                                if amounts:
                                    property_value_estimate = sum(amounts) // len(amounts)
                        except Exception as e:
                            errors.append(f"매매 실거래가 조회 실패: {e}")

            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)

            return PublicDataResult(
                success=len(errors) == 0,
                legal_dong_code=lawd_cd,
                property_value_estimate=property_value_estimate,
                jeonse_market_average=jeonse_market_average,
                recent_transactions=recent_transactions[:10],  # 최근 10건만
                building_ledger=building_ledger,
                address_convert_result=address_convert_result,
                errors=errors,
                execution_time_ms=execution_time,
                metadata={
                    "contract_type": contract_type,
                    "transaction_count": len(recent_transactions),
                    "has_building_ledger": building_ledger is not None,
                    "address_converted": address_convert_result is not None,
                }
            )

        except Exception as e:
            logger.error(f"공공 데이터 수집 실패: {e}", exc_info=True)
            return PublicDataResult(
                success=False,
                errors=[str(e)],
                execution_time_ms=int((datetime.now() - start_time).total_seconds() * 1000),
            )


async def prepare_summary(
    case_id: str,
    use_llm: bool = False,
    property_value_estimate: int | None = None,
    jeonse_market_average: int | None = None,
    contract_type: str | None = None,
    deposit: int | None = None,
    price: int | None = None,
    monthly_rent: int | None = None,
) -> SummaryResult:
    """
    요약 리포트 생성 (규칙 기반 or LLM)

    Args:
        case_id: 케이스 UUID
        use_llm: LLM 사용 여부 (False이면 규칙 기반만)
        property_value_estimate: Step 2에서 전달받은 매매 실거래가 평균 (만원)
        jeonse_market_average: Step 2에서 전달받은 전세 실거래가 평균 (만원)
        contract_type: 계약 유형 ("전세" | "월세" | "매매")
        deposit: 보증금 (만원) - 전세/월세
        price: 매매가 (만원) - 매매
        monthly_rent: 월세 (만원) - 월세

    Returns:
        SummaryResult: 요약 결과
    """
    from core.supabase_client import get_supabase_client
    from core.analysis_pipeline import build_analysis_context
    from core.llm_streaming import simple_llm_analysis

    with StepLogger(case_id, "prepare_summary", {"use_llm": use_llm}):
        start_time = datetime.now()
        supabase = get_supabase_client(service_role=True)

        try:
            # 분석 컨텍스트 빌드 (등기부 + 공공데이터 + 리스크 점수)
            context = await build_analysis_context(case_id)

            # Step 2에서 전달받은 값이 있으면 사용, 없으면 context 값 사용
            effective_property_value = property_value_estimate or context.property_value_estimate
            effective_jeonse_market = jeonse_market_average or context.jeonse_market_average

            # 유저 입력 계약 정보 사용 (없으면 case metadata에서 fallback)
            case = context.case
            effective_contract_type = contract_type or case.get('contract_type', '전세')
            user_deposit = deposit or case.get('metadata', {}).get('deposit')  # 보증금 (전세/월세)
            user_price = price or case.get('metadata', {}).get('price')  # 매매가 (매매)
            user_monthly_rent = monthly_rent or case.get('metadata', {}).get('monthly_rent')  # 월세

            logger.info(f"[prepare_summary] 계약정보: type={effective_contract_type}, deposit={user_deposit}, price={user_price}, monthly_rent={user_monthly_rent}")

            if use_llm:
                # LLM 요약 (10000ms 임계값 모니터링)
                dev_logger.log_api_call(case_id, "prepare_summary", "simple_llm_analysis",
                                        {"prompt_length": len(context.llm_prompt)})
                llm_start = datetime.now()

                final_answer = await simple_llm_analysis(context.llm_prompt)

                llm_time = int((datetime.now() - llm_start).total_seconds() * 1000)
                dev_logger.log_api_response(case_id, "prepare_summary", "simple_llm_analysis",
                                           response_time_ms=llm_time,
                                           success=True)

                # 느린 작업 감지 (10000ms 임계값)
                if llm_time > 10000:
                    dev_logger.log_slow_operation(
                        case_id, "prepare_summary", "LLM 요약 생성", llm_time, threshold_ms=10000
                    )
            else:
                # 규칙 기반 요약 (Notion 스타일 마크다운)
                risk_result = context.risk_result

                # 등기부 데이터 추출
                registry_doc_masked = context.registry_doc_masked
                registry_doc = context.registry_doc

                summary_parts = []

                # ===== 헤더 섹션 =====
                summary_parts.append("# 📋 부동산 계약 분석 리포트\n\n")
                summary_parts.append("---\n\n")

                # 기본 정보 테이블
                summary_parts.append("## 📍 기본 정보\n\n")
                summary_parts.append("| 항목 | 내용 |\n")
                summary_parts.append("|------|------|\n")
                summary_parts.append(f"| **주소** | {case.get('property_address', 'N/A')} |\n")
                summary_parts.append(f"| **계약 유형** | {effective_contract_type} |\n")

                if effective_contract_type in ['전세', '월세']:
                    deposit_display = f"{user_deposit:,}만원" if user_deposit else "미입력"
                    summary_parts.append(f"| **보증금** | {deposit_display} |\n")
                    if effective_contract_type == '월세' and user_monthly_rent:
                        summary_parts.append(f"| **월세** | {user_monthly_rent:,}만원 |\n")
                else:
                    price_display = f"{user_price:,}만원" if user_price else "미입력"
                    summary_parts.append(f"| **매매가** | {price_display} |\n")

                summary_parts.append("\n---\n\n")

                # ===== 가격 비교 분석 섹션 =====
                summary_parts.append("## 💰 가격 비교 분석\n\n")

                if effective_contract_type in ['전세', '월세']:
                    market_avg = effective_jeonse_market or effective_property_value

                    if user_deposit and market_avg:
                        diff = user_deposit - market_avg
                        diff_percent = (diff / market_avg) * 100 if market_avg > 0 else 0

                        # 가격 비교 테이블
                        summary_parts.append("| 구분 | 금액 | 비고 |\n")
                        summary_parts.append("|------|------|------|\n")
                        summary_parts.append(f"| 입력 보증금 | **{user_deposit:,}만원** | 검토 대상 |\n")
                        summary_parts.append(f"| 시장 평균 | **{market_avg:,}만원** | 최근 실거래가 기준 |\n")

                        if diff > 0:
                            summary_parts.append(f"| 차액 | **+{diff:,}만원** | 시세 대비 {diff_percent:.1f}% 높음 |\n")
                        elif diff < 0:
                            summary_parts.append(f"| 차액 | **{diff:,}만원** | 시세 대비 {abs(diff_percent):.1f}% 낮음 |\n")
                        else:
                            summary_parts.append("| 차액 | **0만원** | 시세와 동일 |\n")

                        summary_parts.append("\n")

                        # 가격 적정성 판단 (Callout 스타일)
                        if diff_percent > 10:
                            summary_parts.append("> ❌ **주의 필요**: 시세 대비 과도하게 높습니다. **가격 협상을 권장**합니다.\n\n")
                        elif diff_percent > 5:
                            summary_parts.append("> ⚠️ **검토 필요**: 시세 대비 다소 높습니다. 가격 재검토를 권장합니다.\n\n")
                        elif diff_percent < -10:
                            summary_parts.append("> ✅ **유리한 조건**: 시세 대비 매우 유리한 조건입니다.\n\n")
                        else:
                            summary_parts.append("> ✅ **적정 수준**: 시세 대비 적정한 가격입니다.\n\n")
                    elif not user_deposit:
                        summary_parts.append("> ⚠️ **보증금 미입력**: 보증금을 입력해주세요.\n\n")
                    else:
                        summary_parts.append("> ⚠️ **데이터 없음**: 시장 평균 전세가 데이터를 조회하지 못했습니다.\n\n")

                else:  # 매매
                    market_avg = effective_property_value

                    if user_price and market_avg:
                        diff = user_price - market_avg
                        diff_percent = (diff / market_avg) * 100 if market_avg > 0 else 0

                        # 가격 비교 테이블
                        summary_parts.append("| 구분 | 금액 | 비고 |\n")
                        summary_parts.append("|------|------|------|\n")
                        summary_parts.append(f"| 입력 매매가 | **{user_price:,}만원** | 검토 대상 |\n")
                        summary_parts.append(f"| 시장 평균 | **{market_avg:,}만원** | 최근 실거래가 기준 |\n")

                        if diff > 0:
                            summary_parts.append(f"| 차액 | **+{diff:,}만원** | 시세 대비 {diff_percent:.1f}% 높음 |\n")
                        elif diff < 0:
                            summary_parts.append(f"| 차액 | **{diff:,}만원** | 시세 대비 {abs(diff_percent):.1f}% 낮음 |\n")
                        else:
                            summary_parts.append("| 차액 | **0만원** | 시세와 동일 |\n")

                        summary_parts.append("\n")

                        # 가격 적정성 판단 (Callout 스타일)
                        if diff_percent > 15:
                            summary_parts.append("> ❌ **주의 필요**: 시세 대비 과도하게 높습니다. **가격 협상을 강력히 권장**합니다.\n\n")
                        elif diff_percent > 5:
                            summary_parts.append("> ⚠️ **검토 필요**: 시세 대비 다소 높습니다. 가격 재검토를 권장합니다.\n\n")
                        elif diff_percent < -15:
                            summary_parts.append("> ✅ **유리한 조건**: 시세 대비 매우 유리한 조건입니다. (급매 가능성 확인 필요)\n\n")
                        else:
                            summary_parts.append("> ✅ **적정 수준**: 시세 대비 적정한 가격입니다.\n\n")
                    elif not user_price:
                        summary_parts.append("> ⚠️ **매매가 미입력**: 매매가를 입력해주세요.\n\n")
                    else:
                        summary_parts.append("> ⚠️ **데이터 없음**: 시장 평균 실거래가 데이터를 조회하지 못했습니다.\n\n")

                summary_parts.append("---\n\n")

                # ===== 등기부 분석 섹션 =====
                summary_parts.append("## 📄 등기부 분석\n\n")

                if registry_doc_masked:
                    # 소유자 정보
                    owner_info = registry_doc_masked.get('owner')
                    if owner_info and owner_info.get('name'):
                        summary_parts.append(f"### 👤 소유자 정보\n")
                        summary_parts.append(f"- **소유자**: {owner_info.get('name')}\n\n")

                    # 근저당 정보 (말소 처리 반영)
                    mortgages = registry_doc_masked.get('mortgages', [])
                    active_mortgages = [m for m in mortgages if not m.get('is_deleted')]
                    deleted_mortgages = [m for m in mortgages if m.get('is_deleted')]

                    summary_parts.append(f"### 🏦 근저당권 현황\n\n")

                    if active_mortgages:
                        total_active = sum(m.get('amount') or 0 for m in active_mortgages)
                        summary_parts.append(f"**유효 근저당**: {len(active_mortgages)}건 (총 **{total_active:,}만원**)\n\n")

                        summary_parts.append("| 채권자 | 채권최고액 | 상태 |\n")
                        summary_parts.append("|--------|------------|------|\n")
                        for m in active_mortgages:
                            creditor = m.get('creditor') or '미상'
                            amount = m.get('amount') or 0
                            summary_parts.append(f"| {creditor} | {amount:,}만원 | 🔴 유효 |\n")
                        summary_parts.append("\n")
                    else:
                        summary_parts.append("> ✅ 유효한 근저당권이 없습니다.\n\n")

                    if deleted_mortgages:
                        total_deleted = sum(m.get('amount') or 0 for m in deleted_mortgages)
                        summary_parts.append(f"**말소된 근저당**: {len(deleted_mortgages)}건 (총 {total_deleted:,}만원) - ✅ 처리 완료\n\n")

                    # 압류/가압류 정보
                    seizures = registry_doc_masked.get('seizures', [])
                    active_seizures = [s for s in seizures if not s.get('is_deleted')]
                    deleted_seizures = [s for s in seizures if s.get('is_deleted')]

                    summary_parts.append(f"### ⚖️ 압류/가압류 현황\n\n")

                    if active_seizures:
                        summary_parts.append(f"**유효 압류/가압류**: {len(active_seizures)}건\n\n")

                        summary_parts.append("| 유형 | 채권자 | 상태 |\n")
                        summary_parts.append("|------|--------|------|\n")
                        for s in active_seizures:
                            s_type = s.get('type') or '미상'
                            creditor = s.get('creditor') or '미상'
                            summary_parts.append(f"| {s_type} | {creditor} | 🔴 유효 |\n")
                        summary_parts.append("\n")

                        summary_parts.append("> ❌ **주의**: 유효한 압류/가압류가 있습니다. 반드시 해결 후 계약을 진행하세요.\n\n")
                    else:
                        summary_parts.append("> ✅ 유효한 압류/가압류가 없습니다.\n\n")

                    if deleted_seizures:
                        summary_parts.append(f"**말소된 압류/가압류**: {len(deleted_seizures)}건 - ✅ 처리 완료\n\n")
                else:
                    summary_parts.append("> ℹ️ 등기부 데이터가 없습니다.\n\n")

                summary_parts.append("---\n\n")

                # ===== 리스크 점수 섹션 =====
                summary_parts.append("## 📊 리스크 분석\n\n")

                if risk_result:
                    # 리스크 점수 요약 박스
                    risk_level = risk_result.risk_score.risk_level
                    total_score = risk_result.risk_score.total_score

                    # 리스크 레벨에 따른 이모지
                    level_emoji = {"안전": "🟢", "주의": "🟡", "위험": "🟠", "심각": "🔴"}.get(risk_level, "⚪")

                    summary_parts.append(f"### {level_emoji} 종합 리스크: **{risk_level}** ({total_score:.0f}점/100점)\n\n")

                    # 세부 지표 테이블
                    summary_parts.append("| 지표 | 값 | 평가 |\n")
                    summary_parts.append("|------|-----|------|\n")

                    if risk_result.risk_score.jeonse_ratio is not None:
                        jr = risk_result.risk_score.jeonse_ratio
                        jr_status = "🟢 안전" if jr < 70 else ("🟡 주의" if jr < 80 else ("🟠 위험" if jr < 90 else "🔴 심각"))
                        summary_parts.append(f"| 전세가율 | {jr:.1f}% | {jr_status} |\n")

                    if risk_result.risk_score.mortgage_ratio is not None:
                        mr = risk_result.risk_score.mortgage_ratio
                        mr_status = "🟢 안전" if mr < 40 else ("🟡 주의" if mr < 60 else ("🟠 위험" if mr < 80 else "🔴 심각"))
                        summary_parts.append(f"| 근저당 비율 | {mr:.1f}% | {mr_status} |\n")

                    summary_parts.append("\n")

                    # 위험 요인 (Callout 스타일)
                    if risk_result.risk_score.risk_factors:
                        summary_parts.append("### ⚠️ 위험 요인\n\n")
                        for factor in risk_result.risk_score.risk_factors:
                            summary_parts.append(f"- {factor}\n")
                        summary_parts.append("\n")

                    summary_parts.append("---\n\n")

                    # ===== 협상 포인트 섹션 =====
                    if risk_result.negotiation_points:
                        summary_parts.append("## 🤝 협상 포인트\n\n")
                        for point in risk_result.negotiation_points:
                            impact_emoji = {"높음": "🔴", "중간": "🟡", "낮음": "🟢"}.get(point.impact, "⚪")
                            summary_parts.append(f"- **[{point.category}]** {point.point}\n")
                            summary_parts.append(f"  - 영향도: {impact_emoji} {point.impact}\n")
                        summary_parts.append("\n---\n\n")

                    # ===== 권장 조치 섹션 =====
                    if risk_result.recommendations:
                        summary_parts.append("## ✅ 권장 조치\n\n")
                        for i, rec in enumerate(risk_result.recommendations, 1):
                            summary_parts.append(f"{i}. {rec}\n")
                        summary_parts.append("\n")

                else:
                    summary_parts.append("> ℹ️ 리스크 분석 데이터가 없습니다.\n\n")

                # ===== 푸터 =====
                summary_parts.append("---\n\n")
                summary_parts.append("*이 리포트는 자동 분석 결과이며, 최종 판단은 전문가와 상담하시기 바랍니다.*\n")

                final_answer = "".join(summary_parts)

            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)

            # 가격 비교 데이터 수집 (metadata용)
            price_comparison = {}
            if not use_llm:
                if effective_contract_type in ['전세', '월세']:
                    user_val = user_deposit
                    market_val = effective_jeonse_market or effective_property_value
                else:
                    user_val = user_price
                    market_val = effective_property_value

                if user_val and market_val:
                    price_comparison = {
                        "user_value": user_val,
                        "market_average": market_val,
                        "difference": user_val - market_val,
                        "difference_percent": round((user_val - market_val) / market_val * 100, 1) if market_val > 0 else 0,
                    }

            return SummaryResult(
                success=True,
                summary=final_answer,
                risk_score=context.risk_result.risk_score.dict() if context.risk_result else None,
                execution_time_ms=execution_time,
                metadata={
                    "use_llm": use_llm,
                    "has_registry": bool(context.registry_doc),
                    "has_market_data": bool(effective_property_value),
                    "jeonse_market_average": effective_jeonse_market,
                    "property_value_estimate": effective_property_value,
                    "price_comparison": price_comparison,
                    # Step 2에서 전달받은 원본 값 (디버깅용)
                    "step2_property_value_estimate": property_value_estimate,
                    "step2_jeonse_market_average": jeonse_market_average,
                    # Step 3 유저 입력 계약 정보 (디버깅용)
                    "user_contract_type": effective_contract_type,
                    "user_deposit": user_deposit,
                    "user_price": user_price,
                    "user_monthly_rent": user_monthly_rent,
                }
            )

        except Exception as e:
            logger.error(f"요약 리포트 생성 실패: {e}", exc_info=True)
            return SummaryResult(
                success=False,
                error=str(e),
                execution_time_ms=int((datetime.now() - start_time).total_seconds() * 1000),
            )
