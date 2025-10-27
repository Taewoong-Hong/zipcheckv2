"""
네이버 부동산 매물 크롤러
좌표 기반 부동산 정보 수집
"""

import asyncio
import httpx
from typing import List, Dict, Optional
from datetime import datetime
import json


class NaverLandCrawler:
    """네이버 부동산 크롤러"""

    BASE_URL = "https://new.land.naver.com"

    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": "https://new.land.naver.com/complexes",
        }

    async def get_cortars(self, lat: float, lon: float, zoom: int = 13) -> Dict:
        """
        좌표로 지역 코드(cortarNo) 조회

        Args:
            lat: 위도
            lon: 경도
            zoom: 지도 줌 레벨 (기본 13)

        Returns:
            지역 정보 딕셔너리
        """
        url = f"{self.BASE_URL}/api/cortars"
        params = {
            "zoom": zoom,
            "centerLat": lat,
            "centerLon": lon
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()

    async def get_complex_markers(
        self,
        cortar_no: str,
        left_lon: float,
        right_lon: float,
        top_lat: float,
        bottom_lat: float,
        zoom: int = 16,
        real_estate_type: str = "APT:PRE:ABYG:JGC",
        trade_type: str = "A1",  # A1: 매매, B1: 전세, B2: 월세
        price_type: str = "RETAIL"
    ) -> Dict:
        """
        좌표 범위 내 아파트 단지 마커 조회

        Args:
            cortar_no: 지역 코드
            left_lon, right_lon: 경도 범위
            top_lat, bottom_lat: 위도 범위
            zoom: 지도 줌 레벨
            real_estate_type: 부동산 유형 (APT: 아파트, PRE: 아파트분양권, ABYG: 재건축, JGC: 재개발)
            trade_type: 거래 유형 (A1: 매매, B1: 전세, B2: 월세)
            price_type: 가격 유형 (RETAIL, DEAL 등)

        Returns:
            단지 마커 정보 리스트
        """
        url = f"{self.BASE_URL}/api/complexes/single-markers/2.0"

        params = {
            "cortarNo": cortar_no,
            "zoom": zoom,
            "priceType": price_type,
            "markerId": "",
            "markerType": "",
            "selectedComplexNo": "",
            "selectedComplexBuildingNo": "",
            "fakeComplexMarker": "",
            "realEstateType": real_estate_type,
            "tradeType": trade_type,
            "tag": ":::::::::",
            "rentPriceMin": 0,
            "rentPriceMax": 900000000,
            "priceMin": 0,
            "priceMax": 900000000,
            "areaMin": 0,
            "areaMax": 900000000,
            "oldBuildYears": "",
            "recentlyBuildYears": "",
            "minHouseHoldCount": "",
            "maxHouseHoldCount": "",
            "showArticle": "false",
            "sameAddressGroup": "false",
            "minMaintenanceCost": "",
            "maxMaintenanceCost": "",
            "directions": "",
            "leftLon": left_lon,
            "rightLon": right_lon,
            "topLat": top_lat,
            "bottomLat": bottom_lat,
            "isPresale": "true"
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()

    def calculate_bounds(self, center_lat: float, center_lon: float, radius_km: float = 5.0) -> Dict[str, float]:
        """
        중심 좌표에서 반경 N km 내 경계 좌표 계산

        Args:
            center_lat: 중심 위도
            center_lon: 중심 경도
            radius_km: 반경 (km)

        Returns:
            left_lon, right_lon, top_lat, bottom_lat 딕셔너리
        """
        # 위도 1도 ≈ 111km, 경도 1도 ≈ 88km (한국 위도 기준)
        lat_offset = radius_km / 111.0
        lon_offset = radius_km / 88.0

        return {
            "left_lon": center_lon - lon_offset,
            "right_lon": center_lon + lon_offset,
            "top_lat": center_lat + lat_offset,
            "bottom_lat": center_lat - lat_offset
        }

    async def crawl_area(
        self,
        lat: float,
        lon: float,
        radius_km: float = 5.0,
        trade_types: List[str] = ["A1"]  # A1: 매매, B1: 전세, B2: 월세
    ) -> Dict:
        """
        특정 좌표 기준 반경 N km 내 매물 크롤링

        Args:
            lat: 위도
            lon: 경도
            radius_km: 검색 반경 (km)
            trade_types: 거래 유형 리스트

        Returns:
            크롤링 결과 딕셔너리
        """
        # 1. 지역 코드 조회
        cortar_data = await self.get_cortars(lat, lon)

        if not cortar_data or "cortarList" not in cortar_data:
            raise ValueError(f"좌표 ({lat}, {lon})에 대한 지역 정보를 찾을 수 없습니다.")

        # 가장 상세한 지역 코드 선택 (cortarType이 큰 값)
        cortar_list = sorted(
            cortar_data["cortarList"],
            key=lambda x: x.get("cortarType", 0),
            reverse=True
        )
        cortar_no = cortar_list[0]["cortarNo"]

        # 2. 경계 좌표 계산
        bounds = self.calculate_bounds(lat, lon, radius_km)

        # 3. 각 거래 유형별 매물 조회
        results = {
            "timestamp": datetime.now().isoformat(),
            "center": {"lat": lat, "lon": lon},
            "radius_km": radius_km,
            "cortar_no": cortar_no,
            "cortar_info": cortar_list[0],
            "data": {}
        }

        for trade_type in trade_types:
            marker_data = await self.get_complex_markers(
                cortar_no=cortar_no,
                left_lon=bounds["left_lon"],
                right_lon=bounds["right_lon"],
                top_lat=bounds["top_lat"],
                bottom_lat=bounds["bottom_lat"],
                trade_type=trade_type
            )

            trade_name = {
                "A1": "매매",
                "B1": "전세",
                "B2": "월세"
            }.get(trade_type, trade_type)

            results["data"][trade_name] = marker_data

        return results


# 사용 예시
async def main():
    crawler = NaverLandCrawler()

    # 서울 강남역 좌표
    gangnam_lat = 37.498095
    gangnam_lon = 127.027610

    # 강남역 반경 5km 내 매매/전세 매물 크롤링
    result = await crawler.crawl_area(
        lat=gangnam_lat,
        lon=gangnam_lon,
        radius_km=5.0,
        trade_types=["A1", "B1"]  # 매매, 전세
    )

    print(f"크롤링 완료: {len(result['data'])} 거래 유형")
    for trade_name, data in result["data"].items():
        if "body" in data and isinstance(data["body"], list):
            print(f"  - {trade_name}: {len(data['body'])} 단지")

    # 결과 저장
    with open("naver_land_result.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    asyncio.run(main())
