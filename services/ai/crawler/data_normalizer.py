"""
네이버 부동산 데이터 정규화
외부 출처를 숨기고 자체 DB 형식으로 변환
"""

from typing import Dict, List, Optional
from datetime import datetime
import re


class DataNormalizer:
    """데이터 정규화 - 네이버 출처 제거 및 표준화"""

    @staticmethod
    def normalize_complex(raw_data: Dict) -> Dict:
        """
        네이버 단지 데이터 → 집체크 표준 형식

        Args:
            raw_data: 네이버 API 응답 원본

        Returns:
            정규화된 단지 정보
        """
        # 네이버 필드명을 집체크 표준으로 변환
        normalized = {
            "name": raw_data.get("complexName", ""),
            "address": raw_data.get("address", ""),
            "road_address": raw_data.get("roadAddress", ""),
            "latitude": float(raw_data.get("lat", 0)),
            "longitude": float(raw_data.get("lon", 0)),
            "total_households": raw_data.get("totalHouseholdCount"),
            "completion_date": DataNormalizer._parse_date(
                raw_data.get("useApproveYmd")
            ),
            "building_count": raw_data.get("dongCount"),
            "max_floor": raw_data.get("maxFloor"),
            "parking_count": raw_data.get("parkingCount"),
            "avg_maintenance_fee": raw_data.get("avgMaintenanceCost"),

            # 내부 참조용 (프론트엔드 노출 금지)
            "external_id": str(raw_data.get("complexNo", "")),

            # 메타
            "crawled_at": datetime.now().isoformat()
        }

        # 면적 정보 변환
        if "areaTypeList" in raw_data:
            normalized["area_types"] = [
                {
                    "type": area.get("areaTypeName"),
                    "area": area.get("exclusiveArea"),
                    "supply_area": area.get("supplyArea")
                }
                for area in raw_data["areaTypeList"]
            ]

        return normalized

    @staticmethod
    def normalize_property(raw_data: Dict, complex_id: str) -> Dict:
        """
        네이버 매물 데이터 → 집체크 표준 형식

        Args:
            raw_data: 네이버 매물 원본
            complex_id: 단지 UUID

        Returns:
            정규화된 매물 정보
        """
        # 거래 유형 변환 (A1 → SALE, B1 → JEONSE, B2 → MONTHLY)
        trade_type_map = {
            "A1": "SALE",      # 매매
            "B1": "JEONSE",    # 전세
            "B2": "MONTHLY",   # 월세
            "B3": "MONTHLY"    # 단기월세
        }

        trade_type = trade_type_map.get(
            raw_data.get("tradeType", ""),
            "SALE"
        )

        normalized = {
            "complex_id": complex_id,
            "trade_type": trade_type,
            "floor": raw_data.get("floor"),
            "area_type": raw_data.get("areaTypeName"),
            "exclusive_area": raw_data.get("exclusiveArea"),
            "supply_area": raw_data.get("supplyArea"),
            "direction": raw_data.get("direction"),

            # 가격 정보 (만원 단위로 통일)
            "price": DataNormalizer._parse_price(
                raw_data.get("dealOrWarrantPrc")
            ),
            "deposit": DataNormalizer._parse_price(
                raw_data.get("deposit")
            ) if trade_type == "MONTHLY" else None,
            "monthly_rent": DataNormalizer._parse_price(
                raw_data.get("monthRentPrc")
            ) if trade_type == "MONTHLY" else None,

            # 내부 참조용 (노출 금지)
            "external_article_id": str(raw_data.get("articleNo", "")),

            # 상태
            "status": "ACTIVE",

            # 메타
            "crawled_at": datetime.now().isoformat()
        }

        return normalized

    @staticmethod
    def _parse_date(date_str: Optional[str]) -> Optional[str]:
        """
        날짜 문자열 파싱 (YYYYMMDD → YYYY-MM-DD)

        Args:
            date_str: 날짜 문자열 (예: 20230115)

        Returns:
            ISO 형식 날짜 (예: 2023-01-15) 또는 None
        """
        if not date_str:
            return None

        # 숫자만 추출
        digits = re.sub(r'\D', '', str(date_str))

        if len(digits) == 8:
            return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"

        return None

    @staticmethod
    def _parse_price(price_str: Optional[str]) -> Optional[int]:
        """
        가격 문자열 파싱 → 만원 단위 정수

        Args:
            price_str: 가격 문자열 (예: "5억 2,000만원", "52000")

        Returns:
            만원 단위 정수 (예: 52000) 또는 None
        """
        if not price_str:
            return None

        # 문자열인 경우 숫자만 추출
        if isinstance(price_str, str):
            # "5억 2,000" → 52000
            digits = re.sub(r'[^\d]', '', price_str)
            if digits:
                return int(digits)
            return None

        # 이미 숫자인 경우
        return int(price_str)

    @staticmethod
    def normalize_region(raw_data: Dict) -> Dict:
        """
        네이버 지역 데이터 → 집체크 표준 형식

        Args:
            raw_data: 네이버 cortarList 원본

        Returns:
            정규화된 지역 정보
        """
        # cortarName 파싱 (예: "서울특별시 강남구 역삼동")
        name_parts = raw_data.get("cortarName", "").split()

        sido = name_parts[0] if len(name_parts) > 0 else ""
        sigungu = name_parts[1] if len(name_parts) > 1 else None
        dong = name_parts[2] if len(name_parts) > 2 else None

        # 지역 레벨 결정
        level = len([x for x in [sido, sigungu, dong] if x])

        normalized = {
            "sido": sido,
            "sigungu": sigungu,
            "dong": dong,
            "cortar_no": str(raw_data.get("cortarNo", "")),
            "center_lat": float(raw_data.get("centerLat", 0)),
            "center_lon": float(raw_data.get("centerLon", 0)),
            "level": level
        }

        # 경계 좌표
        if all(k in raw_data for k in ["leftLon", "rightLon", "topLat", "bottomLat"]):
            normalized["bounds"] = {
                "left_lon": float(raw_data["leftLon"]),
                "right_lon": float(raw_data["rightLon"]),
                "top_lat": float(raw_data["topLat"]),
                "bottom_lat": float(raw_data["bottomLat"])
            }

        return normalized

    @staticmethod
    def anonymize_for_frontend(data: Dict) -> Dict:
        """
        프론트엔드 전송용 데이터에서 출처 관련 필드 제거

        Args:
            data: DB 저장된 원본 데이터

        Returns:
            출처 정보가 제거된 데이터
        """
        # 금지 필드 (네이버 출처 암시)
        forbidden_fields = [
            "external_id",
            "external_article_id",
            "cortar_no",
            "crawled_at"
        ]

        # 재귀적으로 금지 필드 제거
        if isinstance(data, dict):
            return {
                k: DataNormalizer.anonymize_for_frontend(v)
                for k, v in data.items()
                if k not in forbidden_fields
            }
        elif isinstance(data, list):
            return [
                DataNormalizer.anonymize_for_frontend(item)
                for item in data
            ]
        else:
            return data


# 테스트
if __name__ == "__main__":
    # 네이버 단지 샘플
    naver_complex = {
        "complexNo": "12345",
        "complexName": "래미안강남힐즈",
        "address": "서울특별시 강남구 역삼동 123",
        "roadAddress": "서울특별시 강남구 테헤란로 123",
        "lat": 37.498095,
        "lon": 127.027610,
        "totalHouseholdCount": 2000,
        "useApproveYmd": "20150115",
        "dongCount": 15,
        "maxFloor": 35,
        "parkingCount": 2500,
        "avgMaintenanceCost": 250000
    }

    normalized = DataNormalizer.normalize_complex(naver_complex)
    print("정규화된 단지:")
    print(normalized)

    # 프론트엔드용 익명화
    frontend_data = DataNormalizer.anonymize_for_frontend(normalized)
    print("\n프론트엔드 전송용:")
    print(frontend_data)
