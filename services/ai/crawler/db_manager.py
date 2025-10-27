"""
Supabase 데이터베이스 관리
크롤링 데이터 저장 및 조회
"""

import os
from typing import List, Dict, Optional
from datetime import datetime
from supabase import create_client, Client
import asyncio


class RealEstateDB:
    """부동산 데이터 DB 관리자"""

    def __init__(self):
        supabase_url = os.getenv("DATABASE_URL", "").replace("postgresql://", "https://")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "")

        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY required")

        self.client: Client = create_client(supabase_url, supabase_key)

    async def upsert_region(self, region_data: Dict) -> str:
        """
        지역 정보 저장/업데이트

        Args:
            region_data: 정규화된 지역 정보

        Returns:
            저장된 지역 UUID
        """
        # cortar_no로 기존 데이터 검색
        existing = self.client.table("v2_regions") \
            .select("id") \
            .eq("cortar_no", region_data["cortar_no"]) \
            .execute()

        if existing.data:
            # 업데이트
            result = self.client.table("v2_regions") \
                .update(region_data) \
                .eq("id", existing.data[0]["id"]) \
                .execute()
            return existing.data[0]["id"]
        else:
            # 신규 생성
            result = self.client.table("v2_regions") \
                .insert(region_data) \
                .execute()
            return result.data[0]["id"]

    async def upsert_complex(self, complex_data: Dict) -> str:
        """
        단지 정보 저장/업데이트

        Args:
            complex_data: 정규화된 단지 정보

        Returns:
            저장된 단지 UUID
        """
        # external_id로 기존 데이터 검색
        existing = self.client.table("v2_complexes") \
            .select("id") \
            .eq("external_id", complex_data["external_id"]) \
            .execute()

        if existing.data:
            # 업데이트
            result = self.client.table("v2_complexes") \
                .update(complex_data) \
                .eq("id", existing.data[0]["id"]) \
                .execute()
            return existing.data[0]["id"]
        else:
            # 신규 생성
            result = self.client.table("v2_complexes") \
                .insert(complex_data) \
                .execute()
            return result.data[0]["id"]

    async def upsert_property(self, property_data: Dict) -> str:
        """
        매물 정보 저장/업데이트

        Args:
            property_data: 정규화된 매물 정보

        Returns:
            저장된 매물 UUID
        """
        # external_article_id로 기존 데이터 검색 (있는 경우)
        if property_data.get("external_article_id"):
            existing = self.client.table("v2_properties") \
                .select("id") \
                .eq("external_article_id", property_data["external_article_id"]) \
                .execute()

            if existing.data:
                # 업데이트
                result = self.client.table("v2_properties") \
                    .update(property_data) \
                    .eq("id", existing.data[0]["id"]) \
                    .execute()
                return existing.data[0]["id"]

        # 신규 생성
        result = self.client.table("v2_properties") \
            .insert(property_data) \
            .execute()
        return result.data[0]["id"]

    async def save_crawl_result(
        self,
        region_id: str,
        complexes_data: List[Dict],
        properties_data: List[Dict]
    ) -> Dict:
        """
        크롤링 결과 일괄 저장

        Args:
            region_id: 지역 UUID
            complexes_data: 단지 데이터 리스트
            properties_data: 매물 데이터 리스트

        Returns:
            저장 결과 통계
        """
        # 크롤링 작업 생성
        job = self.client.table("v2_crawl_jobs").insert({
            "region_id": region_id,
            "status": "RUNNING",
            "started_at": datetime.now().isoformat()
        }).execute()

        job_id = job.data[0]["id"]

        try:
            complex_ids = []
            for complex_data in complexes_data:
                complex_data["region_id"] = region_id
                complex_id = await self.upsert_complex(complex_data)
                complex_ids.append(complex_id)

            property_ids = []
            for property_data in properties_data:
                property_id = await self.upsert_property(property_data)
                property_ids.append(property_id)

            # 작업 완료 업데이트
            self.client.table("v2_crawl_jobs").update({
                "status": "SUCCESS",
                "complexes_found": len(complex_ids),
                "properties_found": len(property_ids),
                "completed_at": datetime.now().isoformat()
            }).eq("id", job_id).execute()

            return {
                "job_id": job_id,
                "complexes_saved": len(complex_ids),
                "properties_saved": len(property_ids)
            }

        except Exception as e:
            # 실패 시 에러 기록
            self.client.table("v2_crawl_jobs").update({
                "status": "FAILED",
                "error_message": str(e),
                "completed_at": datetime.now().isoformat()
            }).eq("id", job_id).execute()

            raise

    def search_complexes(
        self,
        lat: float,
        lon: float,
        radius_km: float = 5.0,
        limit: int = 100
    ) -> List[Dict]:
        """
        좌표 기준 반경 내 단지 검색

        Args:
            lat: 위도
            lon: 경도
            radius_km: 반경 (km)
            limit: 최대 결과 수

        Returns:
            단지 리스트 (출처 정보 제외)
        """
        # PostGIS 공간 쿼리
        result = self.client.rpc(
            "search_complexes_by_location",
            {
                "center_lat": lat,
                "center_lon": lon,
                "radius_km": radius_km,
                "result_limit": limit
            }
        ).execute()

        # 출처 필드 제거
        return [
            {k: v for k, v in complex.items()
             if k not in ["external_id", "crawled_at"]}
            for complex in result.data
        ]

    def get_properties_by_complex(
        self,
        complex_id: str,
        trade_type: Optional[str] = None
    ) -> List[Dict]:
        """
        단지별 매물 조회

        Args:
            complex_id: 단지 UUID
            trade_type: 거래 유형 필터 (SALE, JEONSE, MONTHLY)

        Returns:
            매물 리스트 (출처 정보 제외)
        """
        query = self.client.table("v2_properties") \
            .select("*") \
            .eq("complex_id", complex_id) \
            .eq("status", "ACTIVE")

        if trade_type:
            query = query.eq("trade_type", trade_type)

        result = query.execute()

        # 출처 필드 제거
        return [
            {k: v for k, v in prop.items()
             if k not in ["external_article_id", "crawled_at"]}
            for prop in result.data
        ]


# 공간 쿼리 함수 (Supabase Function으로 생성 필요)
"""
-- Supabase Function: search_complexes_by_location
CREATE OR REPLACE FUNCTION search_complexes_by_location(
  center_lat DECIMAL,
  center_lon DECIMAL,
  radius_km DECIMAL,
  result_limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  address VARCHAR,
  latitude DECIMAL,
  longitude DECIMAL,
  total_households INT,
  completion_date DATE,
  distance_km DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.address,
    c.latitude,
    c.longitude,
    c.total_households,
    c.completion_date,
    ROUND(
      earth_distance(
        ll_to_earth(center_lat, center_lon),
        ll_to_earth(c.latitude, c.longitude)
      ) / 1000,
      2
    ) AS distance_km
  FROM v2_complexes c
  WHERE earth_box(
    ll_to_earth(center_lat, center_lon),
    radius_km * 1000
  ) @> ll_to_earth(c.latitude, c.longitude)
  ORDER BY distance_km
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
"""


# 테스트
if __name__ == "__main__":
    db = RealEstateDB()

    # 강남구 저장 테스트
    region_data = {
        "sido": "서울특별시",
        "sigungu": "강남구",
        "dong": None,
        "cortar_no": "1168010000",
        "center_lat": 37.5172,
        "center_lon": 127.0473,
        "level": 2
    }

    async def test():
        region_id = await db.upsert_region(region_data)
        print(f"저장된 지역 ID: {region_id}")

    asyncio.run(test())
