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
    logger.info(f"[Dev] 등기부 파싱 요청: case_id={request.case_id}")

    try:
        result = await parse_registry(request.case_id)

        if result.success:
            logger.info(f"[Dev] 등기부 파싱 성공: {result.execution_time_ms}ms")
        else:
            logger.error(f"[Dev] 등기부 파싱 실패: {result.error}")

        return result

    except Exception as e:
        logger.error(f"[Dev] 등기부 파싱 오류: {e}", exc_info=True)
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
    """
    logger.info(f"[Dev] 요약 리포트 생성 요청: case_id={request.case_id}, use_llm={request.use_llm}")

    try:
        result = await prepare_summary(request.case_id, use_llm=request.use_llm)

        if result.success:
            logger.info(f"[Dev] 요약 리포트 생성 성공: {result.execution_time_ms}ms")
        else:
            logger.error(f"[Dev] 요약 리포트 생성 실패: {result.error}")

        return result

    except Exception as e:
        logger.error(f"[Dev] 요약 리포트 생성 오류: {e}", exc_info=True)
        raise HTTPException(500, f"요약 리포트 생성 중 오류 발생: {str(e)}")
