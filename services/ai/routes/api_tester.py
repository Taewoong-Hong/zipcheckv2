"""
공공 데이터 API 테스터 - Step 2 디버깅 UI

15개 공공 데이터 API를 개별 테스트할 수 있는 엔드포인트 제공
"""
import logging
import time
from typing import Optional, Dict, Any, List
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from core.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api-tester", tags=["api-tester"])


# ===========================
# Response Models
# ===========================
class APITestResult(BaseModel):
    """API 테스트 결과"""
    success: bool
    api_name: str
    api_name_kr: str
    execution_time_ms: float
    total_count: int = 0
    sample_data: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None
    request_params: Dict[str, Any] = {}


class AllAPITestResult(BaseModel):
    """전체 API 테스트 결과"""
    total_apis: int
    success_count: int
    fail_count: int
    total_execution_time_ms: float
    results: List[APITestResult]


# ===========================
# Default Test Parameters (강남구 역삼동, 최근 월)
# ===========================
DEFAULT_LAWD_CD = "11680"  # 강남구
DEFAULT_SIGUNGU_CD = "11680"
DEFAULT_BJDONG_CD = "10300"  # 역삼동
DEFAULT_BUN = "123"
DEFAULT_JI = "4"


def get_current_deal_ymd() -> str:
    """현재 년월 반환 (YYYYMM)"""
    now = datetime.now()
    # 이번 달 데이터가 없을 수 있으니 전월 사용
    if now.month == 1:
        return f"{now.year - 1}12"
    return f"{now.year}{now.month - 1:02d}"


# ===========================
# 1. 법정동코드 조회 API
# ===========================
@router.get("/legal-dong", response_model=APITestResult)
async def test_legal_dong_code(
    keyword: str = Query(default="서울특별시 강남구", description="주소 검색어")
):
    """
    1. 법정동코드 조회 API 테스트

    - API: 행정표준코드관리시스템 법정동코드 조회
    - 파라미터: keyword (주소 검색어)
    """
    from core.public_data_api import LegalDongCodeAPIClient
    import httpx

    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            api = LegalDongCodeAPIClient(
                api_key=settings.data_go_kr_api_key,
                client=client
            )
            result = await api.get_legal_dong_code(keyword=keyword)

        items = result.get("body", {}).get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=True,
            api_name="LegalDongCodeAPIClient",
            api_name_kr="법정동코드 조회",
            execution_time_ms=round(execution_time, 2),
            total_count=len(items),
            sample_data=items[:5] if items else None,
            request_params={"keyword": keyword}
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"법정동코드 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="LegalDongCodeAPIClient",
            api_name_kr="법정동코드 조회",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={"keyword": keyword}
        )


# ===========================
# 2. 아파트 매매 기본 API
# ===========================
@router.get("/apt-trade", response_model=APITestResult)
async def test_apt_trade(
    lawd_cd: str = Query(default=DEFAULT_LAWD_CD, description="지역코드 5자리"),
    deal_ymd: str = Query(default=None, description="계약년월 (YYYYMM)")
):
    """
    2. 아파트 매매 실거래가 기본 API 테스트

    - API: 국토교통부 아파트 매매 실거래가
    - 파라미터: lawd_cd (법정동코드 앞 5자리), deal_ymd (계약년월)
    """
    from core.public_data_api import AptTradeAPIClient
    import httpx

    if deal_ymd is None:
        deal_ymd = get_current_deal_ymd()

    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            api = AptTradeAPIClient(
                api_key=settings.data_go_kr_api_key,
                client=client
            )
            result = await api.get_apt_trades(lawd_cd=lawd_cd, deal_ymd=deal_ymd)

        items = result.get("body", {}).get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=True,
            api_name="AptTradeAPIClient",
            api_name_kr="아파트 매매 기본",
            execution_time_ms=round(execution_time, 2),
            total_count=len(items),
            sample_data=items[:3] if items else None,
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"아파트 매매 기본 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="AptTradeAPIClient",
            api_name_kr="아파트 매매 기본",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )


# ===========================
# 3. 아파트 매매 실거래가 상세 API
# ===========================
@router.get("/apt-trade-detail", response_model=APITestResult)
async def test_apt_trade_detail(
    lawd_cd: str = Query(default=DEFAULT_LAWD_CD, description="지역코드 5자리"),
    deal_ymd: str = Query(default=None, description="계약년월 (YYYYMM)")
):
    """
    3. 아파트 매매 실거래가 상세 API 테스트

    - API: 국토교통부 아파트 매매 실거래가 상세자료
    - 파라미터: lawd_cd, deal_ymd
    """
    from core.apt_trade_detail_api import AptTradeDetailAPIClient

    if deal_ymd is None:
        deal_ymd = get_current_deal_ymd()

    start_time = time.time()
    try:
        async with AptTradeDetailAPIClient() as api:
            result = await api.get_apt_trade_detail(lawd_cd=lawd_cd, deal_ymd=deal_ymd)

        items = result.get("body", {}).get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=True,
            api_name="AptTradeDetailAPIClient",
            api_name_kr="아파트 매매 실거래가 상세",
            execution_time_ms=round(execution_time, 2),
            total_count=len(items),
            sample_data=items[:3] if items else None,
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"아파트 매매 상세 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="AptTradeDetailAPIClient",
            api_name_kr="아파트 매매 실거래가 상세",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )


# ===========================
# 4. 아파트 전월세 실거래가 API
# ===========================
@router.get("/apt-rent", response_model=APITestResult)
async def test_apt_rent(
    lawd_cd: str = Query(default=DEFAULT_LAWD_CD, description="지역코드 5자리"),
    deal_ymd: str = Query(default=None, description="계약년월 (YYYYMM)")
):
    """
    4. 아파트 전월세 실거래가 API 테스트

    - API: 국토교통부 아파트 전월세 실거래가
    - 파라미터: lawd_cd, deal_ymd
    """
    from core.apt_rent_api import AptRentAPIClient

    if deal_ymd is None:
        deal_ymd = get_current_deal_ymd()

    start_time = time.time()
    try:
        async with AptRentAPIClient() as api:
            result = await api.get_apt_rent(lawd_cd=lawd_cd, deal_ymd=deal_ymd)

        items = result.get("body", {}).get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=True,
            api_name="AptRentAPIClient",
            api_name_kr="아파트 전월세 실거래가",
            execution_time_ms=round(execution_time, 2),
            total_count=len(items),
            sample_data=items[:3] if items else None,
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"아파트 전월세 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="AptRentAPIClient",
            api_name_kr="아파트 전월세 실거래가",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )


# ===========================
# 5. 아파트 분양권 전매 실거래가 API
# ===========================
@router.get("/apt-silv-trade", response_model=APITestResult)
async def test_apt_silv_trade(
    lawd_cd: str = Query(default=DEFAULT_LAWD_CD, description="지역코드 5자리"),
    deal_ymd: str = Query(default=None, description="계약년월 (YYYYMM)")
):
    """
    5. 아파트 분양권 전매 실거래가 API 테스트

    - API: 국토교통부 아파트 분양권전매 신고자료
    - 파라미터: lawd_cd, deal_ymd
    """
    from core.apt_silv_trade_api import AptSilvTradeAPIClient

    if deal_ymd is None:
        deal_ymd = get_current_deal_ymd()

    start_time = time.time()
    try:
        async with AptSilvTradeAPIClient() as api:
            result = await api.get_apt_silv_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd)

        items = result.get("body", {}).get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=True,
            api_name="AptSilvTradeAPIClient",
            api_name_kr="아파트 분양권 전매 실거래가",
            execution_time_ms=round(execution_time, 2),
            total_count=len(items),
            sample_data=items[:3] if items else None,
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"분양권 전매 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="AptSilvTradeAPIClient",
            api_name_kr="아파트 분양권 전매 실거래가",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )


# ===========================
# 6. 공장·창고 등 부동산 매매 실거래가 API
# ===========================
@router.get("/indu-trade", response_model=APITestResult)
async def test_indu_trade(
    lawd_cd: str = Query(default=DEFAULT_LAWD_CD, description="지역코드 5자리"),
    deal_ymd: str = Query(default=None, description="계약년월 (YYYYMM)")
):
    """
    6. 공장·창고 등 부동산 매매 실거래가 API 테스트

    - API: 국토교통부 공장 및 창고 등 매매 신고자료
    - 파라미터: lawd_cd, deal_ymd
    """
    from core.indu_trade_api import InduTradeAPIClient

    if deal_ymd is None:
        deal_ymd = get_current_deal_ymd()

    start_time = time.time()
    try:
        async with InduTradeAPIClient() as api:
            result = await api.get_indu_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd)

        items = result.get("body", {}).get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=True,
            api_name="InduTradeAPIClient",
            api_name_kr="공장·창고 등 매매 실거래가",
            execution_time_ms=round(execution_time, 2),
            total_count=len(items),
            sample_data=items[:3] if items else None,
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"공장창고 매매 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="InduTradeAPIClient",
            api_name_kr="공장·창고 등 매매 실거래가",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )


# ===========================
# 7. 토지 매매 실거래가 API
# ===========================
@router.get("/land-trade", response_model=APITestResult)
async def test_land_trade(
    lawd_cd: str = Query(default=DEFAULT_LAWD_CD, description="지역코드 5자리"),
    deal_ymd: str = Query(default=None, description="계약년월 (YYYYMM)")
):
    """
    7. 토지 매매 실거래가 API 테스트

    - API: 국토교통부 토지 매매 신고자료
    - 파라미터: lawd_cd, deal_ymd
    """
    from core.land_trade_api import LandTradeAPIClient

    if deal_ymd is None:
        deal_ymd = get_current_deal_ymd()

    start_time = time.time()
    try:
        async with LandTradeAPIClient() as api:
            result = await api.get_land_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd)

        items = result.get("body", {}).get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=True,
            api_name="LandTradeAPIClient",
            api_name_kr="토지 매매 실거래가",
            execution_time_ms=round(execution_time, 2),
            total_count=len(items),
            sample_data=items[:3] if items else None,
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"토지 매매 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="LandTradeAPIClient",
            api_name_kr="토지 매매 실거래가",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )


# ===========================
# 8. 상업업무용 부동산 매매 실거래가 API
# ===========================
@router.get("/nrg-trade", response_model=APITestResult)
async def test_nrg_trade(
    lawd_cd: str = Query(default=DEFAULT_LAWD_CD, description="지역코드 5자리"),
    deal_ymd: str = Query(default=None, description="계약년월 (YYYYMM)")
):
    """
    8. 상업업무용 부동산 매매 실거래가 API 테스트

    - API: 국토교통부 상업업무용 부동산 매매 신고자료
    - 파라미터: lawd_cd, deal_ymd
    """
    from core.nrg_trade_api import NrgTradeAPIClient

    if deal_ymd is None:
        deal_ymd = get_current_deal_ymd()

    start_time = time.time()
    try:
        async with NrgTradeAPIClient() as api:
            result = await api.get_nrg_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd)

        items = result.get("body", {}).get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=True,
            api_name="NrgTradeAPIClient",
            api_name_kr="상업업무용 매매 실거래가",
            execution_time_ms=round(execution_time, 2),
            total_count=len(items),
            sample_data=items[:3] if items else None,
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"상업업무용 매매 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="NrgTradeAPIClient",
            api_name_kr="상업업무용 매매 실거래가",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )


# ===========================
# 9. 오피스텔 전월세 실거래가 API
# ===========================
@router.get("/officetel-rent", response_model=APITestResult)
async def test_officetel_rent(
    lawd_cd: str = Query(default=DEFAULT_LAWD_CD, description="지역코드 5자리"),
    deal_ymd: str = Query(default=None, description="계약년월 (YYYYMM)")
):
    """
    9. 오피스텔 전월세 실거래가 API 테스트

    - API: 국토교통부 오피스텔 전월세 실거래가
    - 파라미터: lawd_cd, deal_ymd
    """
    from core.officetel_rent_api import OfficetelRentAPIClient

    if deal_ymd is None:
        deal_ymd = get_current_deal_ymd()

    start_time = time.time()
    try:
        async with OfficetelRentAPIClient() as api:
            result = await api.get_officetel_rent(lawd_cd=lawd_cd, deal_ymd=deal_ymd)

        items = result.get("body", {}).get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=True,
            api_name="OfficetelRentAPIClient",
            api_name_kr="오피스텔 전월세 실거래가",
            execution_time_ms=round(execution_time, 2),
            total_count=len(items),
            sample_data=items[:3] if items else None,
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"오피스텔 전월세 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="OfficetelRentAPIClient",
            api_name_kr="오피스텔 전월세 실거래가",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )


# ===========================
# 10. 오피스텔 매매 실거래가 API
# ===========================
@router.get("/officetel-trade", response_model=APITestResult)
async def test_officetel_trade(
    lawd_cd: str = Query(default=DEFAULT_LAWD_CD, description="지역코드 5자리"),
    deal_ymd: str = Query(default=None, description="계약년월 (YYYYMM)")
):
    """
    10. 오피스텔 매매 실거래가 API 테스트

    - API: 국토교통부 오피스텔 매매 신고자료
    - 파라미터: lawd_cd, deal_ymd
    """
    from core.officetel_trade_api import OfficetelTradeAPIClient

    if deal_ymd is None:
        deal_ymd = get_current_deal_ymd()

    start_time = time.time()
    try:
        async with OfficetelTradeAPIClient() as api:
            result = await api.get_officetel_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd)

        items = result.get("body", {}).get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=True,
            api_name="OfficetelTradeAPIClient",
            api_name_kr="오피스텔 매매 실거래가",
            execution_time_ms=round(execution_time, 2),
            total_count=len(items),
            sample_data=items[:3] if items else None,
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"오피스텔 매매 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="OfficetelTradeAPIClient",
            api_name_kr="오피스텔 매매 실거래가",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )


# ===========================
# 11. 연립다세대 전월세 실거래가 API
# ===========================
@router.get("/rh-rent", response_model=APITestResult)
async def test_rh_rent(
    lawd_cd: str = Query(default=DEFAULT_LAWD_CD, description="지역코드 5자리"),
    deal_ymd: str = Query(default=None, description="계약년월 (YYYYMM)")
):
    """
    11. 연립다세대 전월세 실거래가 API 테스트

    - API: 국토교통부 연립다세대 전월세 실거래가
    - 파라미터: lawd_cd, deal_ymd
    """
    from core.rh_rent_api import RHRentAPIClient

    if deal_ymd is None:
        deal_ymd = get_current_deal_ymd()

    start_time = time.time()
    try:
        async with RHRentAPIClient() as api:
            result = await api.get_rh_rent(lawd_cd=lawd_cd, deal_ymd=deal_ymd)

        items = result.get("body", {}).get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=True,
            api_name="RHRentAPIClient",
            api_name_kr="연립다세대 전월세 실거래가",
            execution_time_ms=round(execution_time, 2),
            total_count=len(items),
            sample_data=items[:3] if items else None,
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"연립다세대 전월세 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="RHRentAPIClient",
            api_name_kr="연립다세대 전월세 실거래가",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )


# ===========================
# 12. 연립다세대 매매 실거래가 API
# ===========================
@router.get("/rh-trade", response_model=APITestResult)
async def test_rh_trade(
    lawd_cd: str = Query(default=DEFAULT_LAWD_CD, description="지역코드 5자리"),
    deal_ymd: str = Query(default=None, description="계약년월 (YYYYMM)")
):
    """
    12. 연립다세대 매매 실거래가 API 테스트

    - API: 국토교통부 연립다세대 매매 신고자료
    - 파라미터: lawd_cd, deal_ymd
    """
    from core.rh_trade_api import RHTradeAPIClient

    if deal_ymd is None:
        deal_ymd = get_current_deal_ymd()

    start_time = time.time()
    try:
        async with RHTradeAPIClient() as api:
            result = await api.get_rh_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd)

        items = result.get("body", {}).get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=True,
            api_name="RHTradeAPIClient",
            api_name_kr="연립다세대 매매 실거래가",
            execution_time_ms=round(execution_time, 2),
            total_count=len(items),
            sample_data=items[:3] if items else None,
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"연립다세대 매매 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="RHTradeAPIClient",
            api_name_kr="연립다세대 매매 실거래가",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )


# ===========================
# 13. 단독다가구 전월세 실거래가 API
# ===========================
@router.get("/sh-rent", response_model=APITestResult)
async def test_sh_rent(
    lawd_cd: str = Query(default=DEFAULT_LAWD_CD, description="지역코드 5자리"),
    deal_ymd: str = Query(default=None, description="계약년월 (YYYYMM)")
):
    """
    13. 단독다가구 전월세 실거래가 API 테스트

    - API: 국토교통부 단독/다가구 전월세 실거래가
    - 파라미터: lawd_cd, deal_ymd
    """
    from core.sh_rent_api import SHRentAPIClient

    if deal_ymd is None:
        deal_ymd = get_current_deal_ymd()

    start_time = time.time()
    try:
        async with SHRentAPIClient() as api:
            result = await api.get_sh_rent(lawd_cd=lawd_cd, deal_ymd=deal_ymd)

        items = result.get("body", {}).get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=True,
            api_name="SHRentAPIClient",
            api_name_kr="단독다가구 전월세 실거래가",
            execution_time_ms=round(execution_time, 2),
            total_count=len(items),
            sample_data=items[:3] if items else None,
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"단독다가구 전월세 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="SHRentAPIClient",
            api_name_kr="단독다가구 전월세 실거래가",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )


# ===========================
# 14. 단독다가구 매매 실거래가 API
# ===========================
@router.get("/sh-trade", response_model=APITestResult)
async def test_sh_trade(
    lawd_cd: str = Query(default=DEFAULT_LAWD_CD, description="지역코드 5자리"),
    deal_ymd: str = Query(default=None, description="계약년월 (YYYYMM)")
):
    """
    14. 단독다가구 매매 실거래가 API 테스트

    - API: 국토교통부 단독/다가구 매매 신고자료
    - 파라미터: lawd_cd, deal_ymd
    """
    from core.sh_trade_api import SHTradeAPIClient

    if deal_ymd is None:
        deal_ymd = get_current_deal_ymd()

    start_time = time.time()
    try:
        async with SHTradeAPIClient() as api:
            result = await api.get_sh_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd)

        items = result.get("body", {}).get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=True,
            api_name="SHTradeAPIClient",
            api_name_kr="단독다가구 매매 실거래가",
            execution_time_ms=round(execution_time, 2),
            total_count=len(items),
            sample_data=items[:3] if items else None,
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"단독다가구 매매 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="SHTradeAPIClient",
            api_name_kr="단독다가구 매매 실거래가",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={"lawd_cd": lawd_cd, "deal_ymd": deal_ymd}
        )


# ===========================
# 15. 건축물대장 정보 API
# ===========================
@router.get("/building-ledger", response_model=APITestResult)
async def test_building_ledger(
    sigungu_cd: str = Query(default=DEFAULT_SIGUNGU_CD, description="시군구코드 5자리"),
    bjdong_cd: str = Query(default=DEFAULT_BJDONG_CD, description="법정동코드 5자리"),
    bun: str = Query(default=DEFAULT_BUN, description="본번"),
    ji: str = Query(default=DEFAULT_JI, description="부번")
):
    """
    15. 건축물대장 정보 API 테스트

    - API: 국토교통부 건축물대장 표제부
    - 파라미터: sigungu_cd, bjdong_cd, bun, ji
    """
    from core.building_ledger_api import BuildingLedgerAPIClient

    start_time = time.time()
    try:
        async with BuildingLedgerAPIClient() as api:
            result = await api.search_building_by_address(
                sigungu_cd=sigungu_cd,
                bjdong_cd=bjdong_cd,
                plat_gb_cd="0",
                bun=bun,
                ji=ji
            )

        items = result.get("items", [])
        execution_time = (time.time() - start_time) * 1000

        return APITestResult(
            success=result.get("success", False),
            api_name="BuildingLedgerAPIClient",
            api_name_kr="건축물대장 정보",
            execution_time_ms=round(execution_time, 2),
            total_count=result.get("totalCount", len(items)),
            sample_data=items[:3] if items else None,
            request_params={
                "sigungu_cd": sigungu_cd,
                "bjdong_cd": bjdong_cd,
                "bun": bun,
                "ji": ji
            }
        )

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"건축물대장 조회 실패: {e}")
        return APITestResult(
            success=False,
            api_name="BuildingLedgerAPIClient",
            api_name_kr="건축물대장 정보",
            execution_time_ms=round(execution_time, 2),
            error=str(e),
            request_params={
                "sigungu_cd": sigungu_cd,
                "bjdong_cd": bjdong_cd,
                "bun": bun,
                "ji": ji
            }
        )


# ===========================
# 케이스 기반 API 테스트 (실제 주소 사용)
# ===========================
@router.get("/test-by-case/{case_id}", response_model=AllAPITestResult)
async def test_apis_by_case(case_id: str):
    """
    케이스 ID 기반 API 테스트

    - 케이스의 실제 주소를 사용하여 API 호출
    - AddressConverter로 sigungu_cd, bjdong_cd, lawd_cd 추출
    - 실제 데이터 반환
    """
    from core.supabase_client import get_supabase_client
    from core.address_converter import AddressConverter

    total_start_time = time.time()
    results: List[APITestResult] = []

    # Step 1: 케이스 조회
    supabase = get_supabase_client(service_role=True)
    case_response = supabase.table("v2_cases").select("*").eq("id", case_id).execute()

    if not case_response.data:
        return AllAPITestResult(
            total_apis=0,
            success_count=0,
            fail_count=0,
            total_execution_time_ms=0,
            results=[APITestResult(
                success=False,
                api_name="CaseLookup",
                api_name_kr="케이스 조회",
                execution_time_ms=0,
                error=f"케이스를 찾을 수 없습니다: {case_id}",
                request_params={"case_id": case_id}
            )]
        )

    case = case_response.data[0]
    property_address = case.get("property_address", "")

    if not property_address:
        return AllAPITestResult(
            total_apis=0,
            success_count=0,
            fail_count=0,
            total_execution_time_ms=0,
            results=[APITestResult(
                success=False,
                api_name="AddressCheck",
                api_name_kr="주소 확인",
                execution_time_ms=0,
                error="케이스에 주소가 없습니다",
                request_params={"case_id": case_id}
            )]
        )

    # Step 2: 주소 변환 (AddressConverter)
    converter = AddressConverter()
    addr_result = await converter.convert(property_address)

    # 주소 변환 결과를 첫 번째 결과로 추가
    results.append(APITestResult(
        success=addr_result.success,
        api_name="AddressConverter",
        api_name_kr="주소 변환",
        execution_time_ms=0,
        total_count=1 if addr_result.success else 0,
        sample_data=[{
            "original_address": property_address,
            "sigungu_cd": addr_result.sigungu_cd,
            "bjdong_cd": addr_result.bjdong_cd,
            "lawd_cd": addr_result.lawd_cd,
            "bun": addr_result.bun,
            "ji": addr_result.ji,
        }] if addr_result.success else None,
        error=addr_result.error if not addr_result.success else None,
        request_params={"address": property_address}
    ))

    if not addr_result.success:
        total_execution_time = (time.time() - total_start_time) * 1000
        return AllAPITestResult(
            total_apis=1,
            success_count=0,
            fail_count=1,
            total_execution_time_ms=round(total_execution_time, 2),
            results=results
        )

    # 추출된 코드 사용
    lawd_cd = addr_result.lawd_cd or addr_result.sigungu_cd or DEFAULT_LAWD_CD
    sigungu_cd = addr_result.sigungu_cd or DEFAULT_SIGUNGU_CD
    bjdong_cd = addr_result.bjdong_cd or DEFAULT_BJDONG_CD
    bun = addr_result.bun or DEFAULT_BUN
    ji = addr_result.ji or DEFAULT_JI
    deal_ymd = get_current_deal_ymd()

    logger.info(f"[API Tester] 케이스 기반 테스트: address={property_address}, lawd_cd={lawd_cd}, sigungu_cd={sigungu_cd}, bjdong_cd={bjdong_cd}")

    # Step 3: 15개 API 호출 (실제 코드 사용)
    # 1. 법정동코드
    results.append(await test_legal_dong_code(keyword=property_address))

    # 2-14. 실거래가 APIs
    results.append(await test_apt_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_apt_trade_detail(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_apt_rent(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_apt_silv_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_indu_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_land_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_nrg_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_officetel_rent(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_officetel_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_rh_rent(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_rh_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_sh_rent(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_sh_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))

    # 15. 건축물대장
    results.append(await test_building_ledger(
        sigungu_cd=sigungu_cd,
        bjdong_cd=bjdong_cd,
        bun=bun,
        ji=ji
    ))

    total_execution_time = (time.time() - total_start_time) * 1000
    success_count = sum(1 for r in results if r.success)
    fail_count = len(results) - success_count

    return AllAPITestResult(
        total_apis=len(results),
        success_count=success_count,
        fail_count=fail_count,
        total_execution_time_ms=round(total_execution_time, 2),
        results=results
    )


# ===========================
# 전체 API 테스트 (일괄 실행 - 기본 파라미터)
# ===========================
@router.get("/test-all", response_model=AllAPITestResult)
async def test_all_apis(
    lawd_cd: str = Query(default=DEFAULT_LAWD_CD, description="지역코드 5자리"),
    deal_ymd: str = Query(default=None, description="계약년월 (YYYYMM)"),
    sigungu_cd: str = Query(default=DEFAULT_SIGUNGU_CD, description="시군구코드 5자리 (건축물대장용)"),
    bjdong_cd: str = Query(default=DEFAULT_BJDONG_CD, description="법정동코드 5자리 (건축물대장용)")
):
    """
    전체 15개 API 일괄 테스트

    - 모든 API를 순차적으로 호출
    - 성공/실패 통계 반환
    """
    if deal_ymd is None:
        deal_ymd = get_current_deal_ymd()

    total_start_time = time.time()
    results: List[APITestResult] = []

    # 1. 법정동코드
    results.append(await test_legal_dong_code(keyword="서울특별시 강남구"))

    # 2-14. 실거래가 APIs
    results.append(await test_apt_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_apt_trade_detail(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_apt_rent(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_apt_silv_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_indu_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_land_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_nrg_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_officetel_rent(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_officetel_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_rh_rent(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_rh_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_sh_rent(lawd_cd=lawd_cd, deal_ymd=deal_ymd))
    results.append(await test_sh_trade(lawd_cd=lawd_cd, deal_ymd=deal_ymd))

    # 15. 건축물대장
    results.append(await test_building_ledger(
        sigungu_cd=sigungu_cd,
        bjdong_cd=bjdong_cd,
        bun=DEFAULT_BUN,
        ji=DEFAULT_JI
    ))

    total_execution_time = (time.time() - total_start_time) * 1000
    success_count = sum(1 for r in results if r.success)
    fail_count = len(results) - success_count

    return AllAPITestResult(
        total_apis=len(results),
        success_count=success_count,
        fail_count=fail_count,
        total_execution_time_ms=round(total_execution_time, 2),
        results=results
    )


# ===========================
# API 목록 조회
# ===========================
@router.get("/list")
async def list_available_apis():
    """
    테스트 가능한 API 목록 조회

    - 15개 공공 데이터 API 목록
    - 각 API의 엔드포인트, 설명, 필수 파라미터 정보
    """
    return {
        "total_apis": 15,
        "apis": [
            {"id": 1, "name_kr": "법정동코드 조회", "endpoint": "/api-tester/legal-dong", "params": ["keyword"]},
            {"id": 2, "name_kr": "아파트 매매 기본", "endpoint": "/api-tester/apt-trade", "params": ["lawd_cd", "deal_ymd"]},
            {"id": 3, "name_kr": "아파트 매매 실거래가 상세", "endpoint": "/api-tester/apt-trade-detail", "params": ["lawd_cd", "deal_ymd"]},
            {"id": 4, "name_kr": "아파트 전월세 실거래가", "endpoint": "/api-tester/apt-rent", "params": ["lawd_cd", "deal_ymd"]},
            {"id": 5, "name_kr": "아파트 분양권 전매", "endpoint": "/api-tester/apt-silv-trade", "params": ["lawd_cd", "deal_ymd"]},
            {"id": 6, "name_kr": "공장·창고 매매", "endpoint": "/api-tester/indu-trade", "params": ["lawd_cd", "deal_ymd"]},
            {"id": 7, "name_kr": "토지 매매", "endpoint": "/api-tester/land-trade", "params": ["lawd_cd", "deal_ymd"]},
            {"id": 8, "name_kr": "상업업무용 매매", "endpoint": "/api-tester/nrg-trade", "params": ["lawd_cd", "deal_ymd"]},
            {"id": 9, "name_kr": "오피스텔 전월세", "endpoint": "/api-tester/officetel-rent", "params": ["lawd_cd", "deal_ymd"]},
            {"id": 10, "name_kr": "오피스텔 매매", "endpoint": "/api-tester/officetel-trade", "params": ["lawd_cd", "deal_ymd"]},
            {"id": 11, "name_kr": "연립다세대 전월세", "endpoint": "/api-tester/rh-rent", "params": ["lawd_cd", "deal_ymd"]},
            {"id": 12, "name_kr": "연립다세대 매매", "endpoint": "/api-tester/rh-trade", "params": ["lawd_cd", "deal_ymd"]},
            {"id": 13, "name_kr": "단독다가구 전월세", "endpoint": "/api-tester/sh-rent", "params": ["lawd_cd", "deal_ymd"]},
            {"id": 14, "name_kr": "단독다가구 매매", "endpoint": "/api-tester/sh-trade", "params": ["lawd_cd", "deal_ymd"]},
            {"id": 15, "name_kr": "건축물대장 정보", "endpoint": "/api-tester/building-ledger", "params": ["sigungu_cd", "bjdong_cd", "bun", "ji"]},
        ],
        "test_all_endpoint": "/api-tester/test-all",
        "default_params": {
            "lawd_cd": DEFAULT_LAWD_CD,
            "deal_ymd": get_current_deal_ymd(),
            "sigungu_cd": DEFAULT_SIGUNGU_CD,
            "bjdong_cd": DEFAULT_BJDONG_CD
        }
    }
