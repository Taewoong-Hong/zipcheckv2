"""개별공시지가 조회 라우터."""
import logging
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from core.land_price_api import LandPriceAPIClient, ReqLevel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/land-price", tags=["land-price"])


# ============================================
# Request/Response Models
# ============================================

class LandPriceSearchRequest(BaseModel):
    """개별공시지가 검색 요청."""
    year: str = Field(..., description="기준연도 (YYYY)", min_length=4, max_length=4)
    dong_code: str = Field(..., description="법정동코드 (10자리)", min_length=2, max_length=10)
    num_of_rows: int = Field(default=100, description="검색 건수 (최대 1000)", ge=1, le=1000)
    page_no: int = Field(default=1, description="페이지 번호", ge=1)


class LandPriceItem(BaseModel):
    """개별공시지가 항목."""
    year: str
    ld_code: str
    ld_code_nm: str
    land_category: str
    area: float
    price_per_sqm: int
    purpose_area: Optional[str] = None
    purpose_district: Optional[str] = None
    data_date: Optional[str] = None


class LandPriceSearchResponse(BaseModel):
    """개별공시지가 검색 응답."""
    success: bool
    count: int
    items: List[LandPriceItem]
    year: str
    area_name: str


class LandPriceStatsResponse(BaseModel):
    """개별공시지가 통계 응답."""
    success: bool
    count: int
    avg_price: int
    min_price: int
    max_price: int
    area_name: str
    year: str


# ============================================
# API Endpoints
# ============================================

@router.post("/search", response_model=LandPriceSearchResponse)
async def search_land_price(request: LandPriceSearchRequest):
    """
    개별공시지가 검색 (읍면동 단위).

    Args:
        request: 검색 요청 (연도, 법정동코드, 검색건수, 페이지)

    Returns:
        개별공시지가 목록

    Example:
        POST /land-price/search
        {
            "year": "2023",
            "dong_code": "1168010300",  // 서울 강남구 역삼동
            "num_of_rows": 100,
            "page_no": 1
        }
    """
    try:
        async with LandPriceAPIClient() as client:
            # 법정동코드로 조회
            result = await client.get_land_price_by_address(
                year=request.year,
                sido_code=request.dong_code[:2],
                sigungu_code=request.dong_code[:5],
                dong_code=request.dong_code,
                num_of_rows=request.num_of_rows,
            )

            if not result:
                return LandPriceSearchResponse(
                    success=True,
                    count=0,
                    items=[],
                    year=request.year,
                    area_name="",
                )

            # LandPriceItem으로 변환
            items = [LandPriceItem(**item) for item in result]

            return LandPriceSearchResponse(
                success=True,
                count=len(items),
                items=items,
                year=request.year,
                area_name=items[0].ld_code_nm if items else "",
            )

    except ValueError as e:
        logger.error(f"파라미터 오류: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"개별공시지가 검색 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"개별공시지가 검색 중 오류 발생: {str(e)}"
        )


@router.get("/search-simple", response_model=LandPriceSearchResponse)
async def search_land_price_simple(
    year: str = Query(..., description="기준연도 (YYYY)", min_length=4, max_length=4),
    dong_code: str = Query(..., description="법정동코드 (10자리)", min_length=2, max_length=10),
    num_of_rows: int = Query(default=100, description="검색 건수", ge=1, le=1000),
):
    """
    개별공시지가 간편 검색 (GET).

    Query Parameters:
        - year: 기준연도 (예: 2023)
        - dong_code: 법정동코드 (예: 1168010300)
        - num_of_rows: 검색 건수 (기본 100)

    Example:
        GET /land-price/search-simple?year=2023&dong_code=1168010300
    """
    request = LandPriceSearchRequest(
        year=year,
        dong_code=dong_code,
        num_of_rows=num_of_rows,
    )
    return await search_land_price(request)


@router.post("/stats", response_model=LandPriceStatsResponse)
async def get_land_price_stats(
    year: str = Query(..., description="기준연도 (YYYY)"),
    dong_code: str = Query(..., description="법정동코드 (10자리)"),
):
    """
    특정 지역의 평균 공시지가 통계.

    Args:
        year: 기준연도
        dong_code: 법정동코드

    Returns:
        평균, 최소, 최대 공시지가 통계

    Example:
        POST /land-price/stats?year=2023&dong_code=1168010300
    """
    try:
        async with LandPriceAPIClient() as client:
            stats = await client.get_average_land_price(
                year=year,
                dong_code=dong_code,
            )

            return LandPriceStatsResponse(
                success=True,
                count=stats["count"],
                avg_price=stats["avg_price"],
                min_price=stats["min_price"],
                max_price=stats["max_price"],
                area_name=stats["area_name"],
                year=year,
            )

    except ValueError as e:
        logger.error(f"파라미터 오류: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"공시지가 통계 조회 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"공시지가 통계 조회 중 오류 발생: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """헬스 체크 엔드포인트."""
    return {"status": "ok", "service": "land-price"}
