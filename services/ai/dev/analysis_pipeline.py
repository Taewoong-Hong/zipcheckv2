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

            # RegistryData 모델로 변환
            registry_data = RegistryData(
                property_value=None,
                mortgage_total=sum([m.amount or 0 for m in registry_doc.mortgages]),
                seizure_exists=any(s.type == "압류" for s in registry_doc.seizures),
                provisional_attachment_exists=any(s.type == "가압류" for s in registry_doc.seizures),
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
                    "seizure_count": len(registry_doc.seizures),
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
    use_llm: bool = False
) -> SummaryResult:
    """
    요약 리포트 생성 (규칙 기반 or LLM)

    Args:
        case_id: 케이스 UUID
        use_llm: LLM 사용 여부 (False이면 규칙 기반만)

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
                # 규칙 기반 요약
                case = context.case
                risk_result = context.risk_result

                summary_parts = [
                    "# 부동산 분석 리포트 (규칙 기반)\n",
                    f"**주소**: {case.get('property_address', 'N/A')}\n",
                    f"**계약 유형**: {case.get('contract_type', 'N/A')}\n",
                    f"\n## 리스크 점수\n",
                ]

                if risk_result:
                    summary_parts.append(f"- **총점**: {risk_result.risk_score.total_score:.1f}점\n")
                    summary_parts.append(f"- **위험 등급**: {risk_result.risk_score.risk_level}\n")

                    if risk_result.risk_score.jeonse_ratio:
                        summary_parts.append(f"- **전세가율**: {risk_result.risk_score.jeonse_ratio:.1f}%\n")

                    if risk_result.risk_score.mortgage_ratio:
                        summary_parts.append(f"- **근저당 비율**: {risk_result.risk_score.mortgage_ratio:.1f}%\n")

                    summary_parts.append(f"\n## 위험 요인\n")
                    for factor in risk_result.risk_score.risk_factors:
                        summary_parts.append(f"- {factor}\n")

                    summary_parts.append(f"\n## 협상 포인트\n")
                    for point in risk_result.negotiation_points:
                        summary_parts.append(f"- **[{point.category}]** {point.point} (영향: {point.impact})\n")

                    summary_parts.append(f"\n## 권장 조치\n")
                    for rec in risk_result.recommendations:
                        summary_parts.append(f"- {rec}\n")

                final_answer = "".join(summary_parts)

            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)

            return SummaryResult(
                success=True,
                summary=final_answer,
                risk_score=context.risk_result.risk_score.dict() if context.risk_result else None,
                execution_time_ms=execution_time,
                metadata={
                    "use_llm": use_llm,
                    "has_registry": bool(context.registry_doc),
                    "has_market_data": bool(context.property_value_estimate),
                }
            )

        except Exception as e:
            logger.error(f"요약 리포트 생성 실패: {e}", exc_info=True)
            return SummaryResult(
                success=False,
                error=str(e),
                execution_time_ms=int((datetime.now() - start_time).total_seconds() * 1000),
            )
