"""
부동산 매물 API
좌표 기반 검색, 크롤링 요청
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional
import asyncio

from crawler.naver_land_crawler import NaverLandCrawler
from crawler.data_normalizer import DataNormalizer
from crawler.db_manager import RealEstateDB
from crawler.korea_regions import get_all_regions, find_region_by_name


router = APIRouter(prefix="/realestate", tags=["부동산"])

# 전역 인스턴스
crawler = NaverLandCrawler()
db = RealEstateDB()


# ============== 요청/응답 스키마 ==============

class CrawlRequest(BaseModel):
    """크롤링 요청"""
    lat: float = Field(..., description="위도", ge=-90, le=90)
    lon: float = Field(..., description="경도", ge=-180, le=180)
    radius_km: float = Field(5.0, description="검색 반경 (km)", ge=1, le=20)
    trade_types: List[str] = Field(
        ["A1"],
        description="거래 유형 (A1: 매매, B1: 전세, B2: 월세)"
    )


class SearchRequest(BaseModel):
    """매물 검색 요청"""
    lat: float = Field(..., description="위도")
    lon: float = Field(..., description="경도")
    radius_km: float = Field(5.0, description="검색 반경 (km)")
    trade_type: Optional[str] = Field(None, description="거래 유형 필터")
    limit: int = Field(100, description="최대 결과 수", ge=1, le=500)


class ComplexDetailRequest(BaseModel):
    """단지 상세 조회"""
    complex_id: str = Field(..., description="단지 UUID")
    trade_type: Optional[str] = Field(None, description="거래 유형 필터")


# ============== API 엔드포인트 ==============

@router.get("/regions")
async def get_regions():
    """
    전국 지역 목록 조회

    Returns:
        전국 시/군/구 좌표 목록
    """
    regions = get_all_regions()
    return {
        "total": len(regions),
        "regions": regions
    }


@router.post("/crawl")
async def crawl_area(
    request: CrawlRequest,
    background_tasks: BackgroundTasks
):
    """
    특정 좌표 기준 부동산 크롤링

    **주의**: 크롤링은 백그라운드로 실행됩니다.
    결과는 DB에 저장되며, `/search` API로 조회 가능합니다.

    Args:
        request: 크롤링 요청 (좌표, 반경, 거래 유형)

    Returns:
        크롤링 작업 정보
    """
    try:
        # 백그라운드 크롤링 작업 추가
        background_tasks.add_task(
            _background_crawl,
            request.lat,
            request.lon,
            request.radius_km,
            request.trade_types
        )

        return {
            "message": "크롤링이 시작되었습니다",
            "center": {"lat": request.lat, "lon": request.lon},
            "radius_km": request.radius_km,
            "trade_types": request.trade_types
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_properties(request: SearchRequest):
    """
    좌표 기반 매물 검색

    **중요**: 이 API는 자체 DB에서 검색합니다.
    크롤링 전에는 데이터가 없을 수 있습니다.

    Args:
        request: 검색 요청 (좌표, 반경, 필터)

    Returns:
        단지 및 매물 정보 (출처 정보 제외)
    """
    try:
        # DB에서 단지 검색
        complexes = db.search_complexes(
            lat=request.lat,
            lon=request.lon,
            radius_km=request.radius_km,
            limit=request.limit
        )

        # 각 단지별 매물 조회
        results = []
        for complex in complexes:
            properties = db.get_properties_by_complex(
                complex_id=complex["id"],
                trade_type=request.trade_type
            )

            # 출처 정보 제거 (프론트엔드 노출 금지)
            clean_complex = DataNormalizer.anonymize_for_frontend(complex)
            clean_properties = DataNormalizer.anonymize_for_frontend(properties)

            results.append({
                "complex": clean_complex,
                "properties": clean_properties,
                "property_count": len(clean_properties)
            })

        return {
            "total": len(results),
            "results": results
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/complex/detail")
async def get_complex_detail(request: ComplexDetailRequest):
    """
    단지 상세 정보 및 매물 조회

    Args:
        request: 단지 ID, 거래 유형 필터

    Returns:
        단지 정보 및 매물 목록 (출처 정보 제외)
    """
    try:
        # 단지 정보 조회
        complex_result = db.client.table("v2_complexes") \
            .select("*") \
            .eq("id", request.complex_id) \
            .execute()

        if not complex_result.data:
            raise HTTPException(status_code=404, detail="단지를 찾을 수 없습니다")

        complex = complex_result.data[0]

        # 매물 조회
        properties = db.get_properties_by_complex(
            complex_id=request.complex_id,
            trade_type=request.trade_type
        )

        # 출처 정보 제거
        clean_complex = DataNormalizer.anonymize_for_frontend(complex)
        clean_properties = DataNormalizer.anonymize_for_frontend(properties)

        return {
            "complex": clean_complex,
            "properties": clean_properties,
            "property_count": len(clean_properties)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== 백그라운드 작업 ==============

async def _background_crawl(
    lat: float,
    lon: float,
    radius_km: float,
    trade_types: List[str]
):
    """
    백그라운드 크롤링 작업

    Args:
        lat: 위도
        lon: 경도
        radius_km: 반경
        trade_types: 거래 유형 리스트
    """
    try:
        # 1. 크롤링 실행
        result = await crawler.crawl_area(
            lat=lat,
            lon=lon,
            radius_km=radius_km,
            trade_types=trade_types
        )

        # 2. 지역 정보 저장
        region_raw = result["cortar_info"]
        region_normalized = DataNormalizer.normalize_region(region_raw)
        region_id = await db.upsert_region(region_normalized)

        # 3. 단지 및 매물 데이터 정규화
        complexes_normalized = []
        properties_normalized = []

        for trade_name, trade_data in result["data"].items():
            if "body" not in trade_data:
                continue

            for marker in trade_data["body"]:
                # 단지 정규화
                complex_normalized = DataNormalizer.normalize_complex(marker)
                complexes_normalized.append(complex_normalized)

                # 매물이 있으면 정규화
                if "articleList" in marker:
                    for article in marker["articleList"]:
                        property_normalized = DataNormalizer.normalize_property(
                            article,
                            complex_id=None  # 저장 후 매핑
                        )
                        properties_normalized.append({
                            "complex_external_id": marker.get("complexNo"),
                            "property": property_normalized
                        })

        # 4. DB 저장
        save_result = await db.save_crawl_result(
            region_id=region_id,
            complexes_data=complexes_normalized,
            properties_data=[p["property"] for p in properties_normalized]
        )

        print(f"크롤링 완료: {save_result}")

    except Exception as e:
        print(f"크롤링 에러: {str(e)}")
        raise
