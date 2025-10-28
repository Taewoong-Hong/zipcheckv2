"""
크롤러 테스트 API
관리자 전용 - 크롤러 패키지 연동 테스트
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List

# ⚠️ 크롤러 패키지는 lazy import로 변경 (앱 시작 시 블로킹 방지)
# 실제 사용 시점에 임포트됩니다

from core.auth import require_admin

router = APIRouter(prefix="/crawler-test", tags=["크롤러 테스트 (관리자 전용)"])


# ============== 요청/응답 스키마 ==============

class CrawlTestRequest(BaseModel):
    """크롤링 테스트 요청"""
    lat: float = Field(..., description="위도", ge=-90, le=90)
    lon: float = Field(..., description="경도", ge=-180, le=180)
    radius_km: float = Field(5.0, description="검색 반경 (km)", ge=1, le=20)
    trade_types: List[str] = Field(
        ["A1"],
        description="거래 유형 (A1: 매매, B1: 전세, B2: 월세)"
    )


class CrawlTestResponse(BaseModel):
    """크롤링 테스트 응답"""
    ok: bool
    message: str
    center: dict
    radius_km: float
    trade_types: List[str]
    total_complexes: int
    sample_data: dict


# ============== API 엔드포인트 ==============

@router.post("/crawl", response_model=CrawlTestResponse)
async def test_crawl(
    request: CrawlTestRequest,
    user: dict = Depends(require_admin),  # ✅ 관리자 인증 필수
):
    """
    크롤러 패키지 테스트 (관리자 전용)

    **주의**: 실제 외부 API를 호출합니다. 개발 환경에서만 사용하세요.

    Args:
        request: 크롤링 테스트 요청

    Returns:
        크롤링 결과 샘플
    """
    try:
        # Lazy import - 실제 사용 시점에만 임포트
        from zipcheck_crawler import PropertyCrawler, DataNormalizer

        # 1. 크롤러 초기화
        crawler = PropertyCrawler()

        # 2. 크롤링 실행
        result = await crawler.crawl_area(
            lat=request.lat,
            lon=request.lon,
            radius_km=request.radius_km,
            trade_types=request.trade_types
        )

        # 3. 결과 집계
        total_complexes = 0
        sample_complexes = []

        for trade_name, trade_data in result["data"].items():
            if "body" in trade_data and isinstance(trade_data["body"], list):
                complexes = trade_data["body"]
                total_complexes += len(complexes)

                # 각 거래 유형에서 첫 번째 단지만 샘플로 추출
                if complexes:
                    sample_complex = complexes[0]
                    # 데이터 정규화
                    normalized = DataNormalizer.normalize_complex(sample_complex)
                    # 프론트엔드용으로 출처 제거
                    clean = DataNormalizer.anonymize_for_frontend(normalized)
                    sample_complexes.append({
                        "trade_type": trade_name,
                        "complex": clean
                    })

        return CrawlTestResponse(
            ok=True,
            message=f"크롤링 성공! {total_complexes}개 단지 발견",
            center={"lat": request.lat, "lon": request.lon},
            radius_km=request.radius_km,
            trade_types=request.trade_types,
            total_complexes=total_complexes,
            sample_data={
                "region_code": result.get("region_code"),
                "samples": sample_complexes
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"크롤링 실패: {str(e)}"
        )


@router.get("/health")
async def health_check(
    user: dict = Depends(require_admin),
):
    """
    크롤러 패키지 헬스체크

    Returns:
        패키지 정보 및 상태
    """
    try:
        # 크롤러 패키지 임포트 테스트
        from zipcheck_crawler import __version__

        return {
            "ok": True,
            "package": "zipcheck-crawler",
            "version": __version__,
            "github": "https://github.com/Taewoong-Hong/zipcheck_rawl",
            "status": "healthy"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"패키지 로드 실패: {str(e)}"
        )
