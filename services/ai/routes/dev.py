"""
Dev API Routes - 개발자 디버깅 전용

LLM 없이 데이터 파싱/수집/요약 검증
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dev.analysis_pipeline import (
    parse_registry,
    collect_public_data,
    prepare_summary,
    ParsedRegistryResult,
    PublicDataResult,
    SummaryResult,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dev", tags=["dev"])


# ===========================
# Request Models
# ===========================
class ParseRegistryRequest(BaseModel):
    """등기부 파싱 요청"""
    case_id: str


class CollectPublicDataRequest(BaseModel):
    """공공 데이터 수집 요청"""
    case_id: str
    force: bool = False


class PrepareSummaryRequest(BaseModel):
    """요약 리포트 생성 요청"""
    case_id: str
    use_llm: bool = False
    # Step 2에서 전달받은 데이터 (Lab에서 사용)
    property_value_estimate: int | None = None  # 매매 실거래가 평균 (만원)
    jeonse_market_average: int | None = None  # 전세 실거래가 평균 (만원)
    # 계약 정보 (Step 3에서 유저 입력)
    contract_type: str | None = None  # "전세" | "월세" | "매매"
    deposit: int | None = None  # 보증금 (만원) - 전세/월세
    price: int | None = None  # 매매가 (만원) - 매매
    monthly_rent: int | None = None  # 월세 (만원) - 월세


# ===========================
# API Endpoints
# ===========================
@router.post("/parse-registry", response_model=ParsedRegistryResult)
async def parse_registry_endpoint(request: ParseRegistryRequest):
    """
    등기부 파싱 (디버깅 전용)

    - LLM 없이 등기부 PDF 파싱
    - 개인정보 마스킹 적용
    - 실행 시간 측정
    """
    from time import time
    start_time = time()
    logger.info(f"[Dev] ========== 등기부 파싱 시작 ==========")
    logger.info(f"[Dev] case_id={request.case_id}")

    try:
        result = await parse_registry(request.case_id)
        elapsed = time() - start_time

        if result.success:
            logger.info(f"[Dev] 등기부 파싱 성공: {result.execution_time_ms}ms (총 소요시간: {elapsed:.2f}s)")
        else:
            logger.error(f"[Dev] 등기부 파싱 실패: {result.error} (소요시간: {elapsed:.2f}s)")

        # 직렬화 검증 (디버깅용)
        try:
            import json
            # Pydantic v2: model_dump() 사용
            result_dict = result.model_dump()
            json_str = json.dumps(result_dict, ensure_ascii=False, default=str)
            logger.info(f"[Dev] 응답 직렬화 성공: {len(json_str)} bytes")
        except Exception as ser_err:
            logger.error(f"[Dev] 응답 직렬화 실패: {ser_err}", exc_info=True)
            # 문제 필드 찾기
            for field_name in ['registry_doc_masked', 'registry_data', 'metadata']:
                try:
                    field_val = getattr(result, field_name, None)
                    if field_val:
                        json.dumps(field_val, ensure_ascii=False, default=str)
                except Exception as field_err:
                    logger.error(f"[Dev] 필드 '{field_name}' 직렬화 오류: {field_err}")
            raise

        logger.info(f"[Dev] ========== 등기부 파싱 완료 (총 {elapsed:.2f}s) ==========")
        return result

    except Exception as e:
        elapsed = time() - start_time
        logger.error(f"[Dev] 등기부 파싱 오류 (소요시간: {elapsed:.2f}s): {e}", exc_info=True)
        raise HTTPException(500, f"등기부 파싱 중 오류 발생: {str(e)}")


@router.post("/collect-public-data", response_model=PublicDataResult)
async def collect_public_data_endpoint(request: CollectPublicDataRequest):
    """
    공공 데이터 수집 (디버깅 전용)

    - 법정동코드 조회
    - 실거래가 평균 계산
    - 전세 시장가 조회 (전세/월세 계약)
    """
    logger.info(f"[Dev] 공공 데이터 수집 요청: case_id={request.case_id}, force={request.force}")

    try:
        result = await collect_public_data(request.case_id, force=request.force)

        if result.success:
            logger.info(f"[Dev] 공공 데이터 수집 성공: {result.execution_time_ms}ms")
        else:
            logger.error(f"[Dev] 공공 데이터 수집 실패: {result.errors}")

        return result

    except Exception as e:
        logger.error(f"[Dev] 공공 데이터 수집 오류: {e}", exc_info=True)
        raise HTTPException(500, f"공공 데이터 수집 중 오류 발생: {str(e)}")


@router.post("/prepare-summary", response_model=SummaryResult)
async def prepare_summary_endpoint(request: PrepareSummaryRequest):
    """
    요약 리포트 생성 (디버깅 전용)

    - 규칙 기반 또는 LLM 요약
    - 리스크 점수 계산
    - 협상 포인트 추출
    - Step 2에서 전달받은 실거래가 데이터 활용
    - Step 3에서 전달받은 계약 정보 활용
    """
    logger.info(f"[Dev] 요약 리포트 생성 요청: case_id={request.case_id}, use_llm={request.use_llm}, "
                f"property_value_estimate={request.property_value_estimate}, jeonse_market_average={request.jeonse_market_average}, "
                f"contract_type={request.contract_type}, deposit={request.deposit}, price={request.price}, monthly_rent={request.monthly_rent}")

    try:
        result = await prepare_summary(
            request.case_id,
            use_llm=request.use_llm,
            property_value_estimate=request.property_value_estimate,
            jeonse_market_average=request.jeonse_market_average,
            contract_type=request.contract_type,
            deposit=request.deposit,
            price=request.price,
            monthly_rent=request.monthly_rent,
        )

        if result.success:
            logger.info(f"[Dev] 요약 리포트 생성 성공: {result.execution_time_ms}ms")
        else:
            logger.error(f"[Dev] 요약 리포트 생성 실패: {result.error}")

        return result

    except Exception as e:
        logger.error(f"[Dev] 요약 리포트 생성 오류: {e}", exc_info=True)
        raise HTTPException(500, f"요약 리포트 생성 중 오류 발생: {str(e)}")
