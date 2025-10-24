"""아파트 매매 실거래가 상세 자료 라우터."""
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from core.apt_trade_detail_api import AptTradeDetailAPIClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/apt-trade", tags=["apt-trade"])


# ============================================
# Request/Response Models
# ============================================

class AptTradeSearchRequest(BaseModel):
    """아파트 실거래가 검색 요청."""
    lawd_cd: str = Field(..., description="지역코드 (법정동코드 앞 5자리)", min_length=5, max_length=5)
    deal_ymd: str = Field(..., description="계약년월 (YYYYMM)", min_length=6, max_length=6)
    page_no: int = Field(default=1, description="페이지 번호", ge=1)
    num_of_rows: int = Field(default=100, description="한 페이지 결과 수", ge=1, le=1000)


class AptTradePeriodRequest(BaseModel):
    """기간별 아파트 실거래가 검색 요청."""
    lawd_cd: str = Field(..., description="지역코드 (5자리)")
    start_ym: str = Field(..., description="시작년월 (YYYYMM)")
    end_ym: str = Field(..., description="종료년월 (YYYYMM)")


class AptTradeItem(BaseModel):
    """아파트 실거래 항목."""
    지역코드_시군구: Optional[str] = None
    지역코드_읍면동: Optional[str] = None
    읍면동명: Optional[str] = None
    지번: Optional[str] = None
    도로명: Optional[str] = None
    아파트명: Optional[str] = None
    아파트동: Optional[str] = None
    전용면적: float
    층: Optional[str] = None
    건축년도: Optional[str] = None
    거래일자: Optional[str] = None
    거래금액_원: int
    거래금액_만원: int
    거래유형: Optional[str] = None
    매도자구분: Optional[str] = None
    매수자구분: Optional[str] = None
    중개사소재지: Optional[str] = None
    토지임대여부: Optional[str] = None


class AptTradeSearchResponse(BaseModel):
    """아파트 실거래가 검색 응답."""
    success: bool
    total_count: int
    page_no: int
    num_of_rows: int
    items: List[AptTradeItem]
    lawd_cd: str
    deal_ymd: str


class AptTradePeriodResponse(BaseModel):
    """기간별 아파트 실거래가 검색 응답."""
    success: bool
    total_count: int
    items: List[AptTradeItem]
    lawd_cd: str
    start_ym: str
    end_ym: str


# ============================================
# API Endpoints
# ============================================

@router.post("/search", response_model=AptTradeSearchResponse)
async def search_apt_trade(request: AptTradeSearchRequest):
    """
    아파트 매매 실거래가 상세 자료 조회.

    **상세 정보 제공**:
    - 층정보 (개인정보 보호)
    - 동정보 (소유권 이전등기 완료 건만)
    - 중개사 정보
    - 매도자/매수자 구분
    - 거래유형, 토지임대여부 등

    Args:
        request: 검색 요청 (지역코드, 계약년월, 페이지 정보)

    Returns:
        아파트 실거래가 상세 목록

    Example:
        POST /apt-trade/search
        {
            "lawd_cd": "11680",
            "deal_ymd": "202401",
            "page_no": 1,
            "num_of_rows": 100
        }
    """
    try:
        async with AptTradeDetailAPIClient() as client:
            result = await client.get_apt_trade_detail(
                lawd_cd=request.lawd_cd,
                deal_ymd=request.deal_ymd,
                page_no=request.page_no,
                num_of_rows=request.num_of_rows,
            )

            # 응답 파싱
            body = result["body"]
            items = body["items"]

            # 각 항목을 파싱
            parsed_items = []
            for item in items:
                parsed = client.parse_trade_item(item)
                parsed_items.append(AptTradeItem(**parsed))

            return AptTradeSearchResponse(
                success=True,
                total_count=body["totalCount"],
                page_no=body["pageNo"],
                num_of_rows=body["numOfRows"],
                items=parsed_items,
                lawd_cd=request.lawd_cd,
                deal_ymd=request.deal_ymd,
            )

    except ValueError as e:
        logger.error(f"파라미터 오류: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"아파트 실거래가 조회 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"아파트 실거래가 조회 중 오류 발생: {str(e)}"
        )


@router.get("/search-simple", response_model=AptTradeSearchResponse)
async def search_apt_trade_simple(
    lawd_cd: str = Query(..., description="지역코드 (5자리)", min_length=5, max_length=5),
    deal_ymd: str = Query(..., description="계약년월 (YYYYMM)", min_length=6, max_length=6),
    page_no: int = Query(default=1, description="페이지 번호", ge=1),
    num_of_rows: int = Query(default=100, description="한 페이지 결과 수", ge=1, le=1000),
):
    """
    아파트 실거래가 간편 조회 (GET).

    Query Parameters:
        - lawd_cd: 지역코드 (예: 11680 - 강남구)
        - deal_ymd: 계약년월 (예: 202401)
        - page_no: 페이지 번호
        - num_of_rows: 결과 수

    Example:
        GET /apt-trade/search-simple?lawd_cd=11680&deal_ymd=202401
    """
    request = AptTradeSearchRequest(
        lawd_cd=lawd_cd,
        deal_ymd=deal_ymd,
        page_no=page_no,
        num_of_rows=num_of_rows,
    )
    return await search_apt_trade(request)


@router.post("/search-period", response_model=AptTradePeriodResponse)
async def search_apt_trade_period(request: AptTradePeriodRequest):
    """
    기간별 아파트 실거래가 조회.

    **주의**: 기간이 길수록 시간이 오래 걸립니다.

    Args:
        request: 기간별 검색 요청 (지역코드, 시작년월, 종료년월)

    Returns:
        전체 기간의 아파트 실거래가 목록

    Example:
        POST /apt-trade/search-period
        {
            "lawd_cd": "11680",
            "start_ym": "202301",
            "end_ym": "202312"
        }
    """
    try:
        async with AptTradeDetailAPIClient() as client:
            items = await client.get_apt_trades_by_period(
                lawd_cd=request.lawd_cd,
                start_ym=request.start_ym,
                end_ym=request.end_ym,
            )

            # 각 항목을 파싱
            parsed_items = []
            for item in items:
                parsed = client.parse_trade_item(item)
                parsed_items.append(AptTradeItem(**parsed))

            return AptTradePeriodResponse(
                success=True,
                total_count=len(parsed_items),
                items=parsed_items,
                lawd_cd=request.lawd_cd,
                start_ym=request.start_ym,
                end_ym=request.end_ym,
            )

    except ValueError as e:
        logger.error(f"파라미터 오류: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"기간별 아파트 실거래가 조회 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"기간별 조회 중 오류 발생: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """헬스 체크 엔드포인트."""
    return {"status": "ok", "service": "apt-trade"}
