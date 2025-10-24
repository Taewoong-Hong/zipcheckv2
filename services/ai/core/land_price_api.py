"""VWorld 개별공시지가 API 클라이언트."""
import logging
from typing import Optional, Dict, Any, List
from enum import Enum

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from core.settings import settings

logger = logging.getLogger(__name__)


class ReqLevel(str, Enum):
    """요청 구분 레벨."""
    SIDO = "1"  # 시도 단위
    SIGUNGU = "2"  # 시군구 단위
    EUPMYEONDONG = "3"  # 읍면동리 단위


class ResponseFormat(str, Enum):
    """응답 형식."""
    XML = "xml"
    JSON = "json"


class LandPriceAPIClient:
    """
    VWorld 개별공시지가 API 클라이언트.

    국가중점데이터 - 개별공시지가기본현황 조회 서비스
    API 문서: https://api.vworld.kr/ned/data/getIndvdLandPrice
    """

    BASE_URL = "https://api.vworld.kr/ned/data/getIndvdLandPrice"

    def __init__(self, api_key: Optional[str] = None, domain: Optional[str] = None):
        """
        Args:
            api_key: VWorld API 키 (없으면 settings에서 가져옴)
            domain: API 발급 시 입력한 도메인 (HTTPS, FLEX 등 웹뷰어가 아닌 경우 필수)
        """
        self.api_key = api_key or settings.vworld_api_key
        self.domain = domain or getattr(settings, 'vworld_domain', None)
        self.client = httpx.AsyncClient(timeout=30.0)

        if not self.api_key:
            raise ValueError("VWorld API 키가 설정되지 않았습니다.")

        logger.info("VWorld 개별공시지가 API 클라이언트 초기화 완료")

    async def __aenter__(self):
        """비동기 컨텍스트 매니저 진입."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """비동기 컨텍스트 매니저 종료."""
        await self.close()

    async def close(self):
        """HTTP 클라이언트 종료."""
        await self.client.aclose()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(httpx.TimeoutException),
    )
    async def get_individual_land_price(
        self,
        stdr_year: str,
        req_lvl: ReqLevel,
        ld_code: Optional[str] = None,
        format: ResponseFormat = ResponseFormat.JSON,
        num_of_rows: int = 10,
        page_no: int = 1,
    ) -> Dict[str, Any]:
        """
        개별공시지가 기본현황 조회.

        Args:
            stdr_year: 기준연도 (YYYY 형식, 4자리)
            req_lvl: 요청구분
                - ReqLevel.SIDO (1): 시도 단위
                - ReqLevel.SIGUNGU (2): 시군구 단위
                - ReqLevel.EUPMYEONDONG (3): 읍면동리 단위
            ld_code: 법정동코드
                - reqLvl=1: 해당 없음
                - reqLvl=2: 2~5자리 (시군구코드)
                - reqLvl=3: 2~10자리 (읍면동코드)
            format: 응답 형식 (json 또는 xml)
            num_of_rows: 검색 건수 (최대 1000)
            page_no: 페이지 번호

        Returns:
            API 응답 (JSON 또는 XML)

        Raises:
            ValueError: 파라미터 유효성 검증 실패
            httpx.HTTPStatusError: HTTP 오류 발생

        Example:
            >>> async with LandPriceAPIClient() as client:
            ...     result = await client.get_individual_land_price(
            ...         stdr_year="2023",
            ...         req_lvl=ReqLevel.EUPMYEONDONG,
            ...         ld_code="1168010300",  # 강남구 역삼동
            ...     )
            ...     print(result['indvdLandPrices']['field'])
        """
        # 파라미터 검증
        if len(stdr_year) != 4 or not stdr_year.isdigit():
            raise ValueError(f"기준연도는 4자리 숫자여야 합니다: {stdr_year}")

        if num_of_rows > 1000:
            raise ValueError(f"검색건수는 최대 1000건입니다: {num_of_rows}")

        # reqLvl에 따라 ldCode 검증
        if req_lvl == ReqLevel.SIDO:
            ld_code = None  # 시도 단위는 법정동코드 불필요
        elif req_lvl == ReqLevel.SIGUNGU:
            if not ld_code or len(ld_code) < 2 or len(ld_code) > 5:
                raise ValueError(
                    f"시군구 단위는 법정동코드 2~5자리가 필요합니다: {ld_code}"
                )
        elif req_lvl == ReqLevel.EUPMYEONDONG:
            if not ld_code or len(ld_code) < 2 or len(ld_code) > 10:
                raise ValueError(
                    f"읍면동리 단위는 법정동코드 2~10자리가 필요합니다: {ld_code}"
                )

        # 요청 파라미터 구성
        params = {
            "key": self.api_key,
            "stdrYear": stdr_year,
            "reqLvl": req_lvl.value,
            "format": format.value,
            "numOfRows": str(num_of_rows),
            "pageNo": str(page_no),
        }

        # 선택 파라미터 추가
        if ld_code:
            params["ldCode"] = ld_code

        if self.domain:
            params["domain"] = self.domain

        logger.info(
            f"개별공시지가 조회 요청: year={stdr_year}, "
            f"level={req_lvl.value}, code={ld_code}"
        )

        try:
            response = await self.client.get(self.BASE_URL, params=params)
            response.raise_for_status()

            logger.info(
                f"개별공시지가 API 응답: status={response.status_code}, "
                f"length={len(response.content)}"
            )

            # JSON 응답 파싱
            if format == ResponseFormat.JSON:
                data = response.json()

                # 에러 체크
                if "error" in data:
                    error = data["error"]
                    error_code = error.get("code", "UNKNOWN_ERROR")
                    error_msg = error.get("message", "알 수 없는 오류")
                    logger.error(f"API 에러: {error_code} - {error_msg}")
                    raise ValueError(f"API 에러 [{error_code}]: {error_msg}")

                # 결과 데이터 추출
                result = data.get("indvdLandPrices", {})
                field_data = result.get("field", [])

                logger.info(f"개별공시지가 조회 성공: {len(field_data)}건")
                return data

            else:
                # XML 응답 (원본 텍스트 반환)
                return {"xml": response.text}

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP 에러: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"개별공시지가 조회 실패: {e}")
            raise

    async def get_land_price_by_address(
        self,
        year: str,
        sido_code: str,
        sigungu_code: str,
        dong_code: str,
        num_of_rows: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        주소 기반 개별공시지가 조회 (읍면동 단위).

        Args:
            year: 기준연도 (YYYY)
            sido_code: 시도코드 (2자리)
            sigungu_code: 시군구코드 (5자리, 시도코드 포함)
            dong_code: 법정동코드 (10자리, 시군구코드 포함)
            num_of_rows: 검색 건수

        Returns:
            공시지가 목록

        Example:
            >>> # 서울특별시 강남구 역삼동
            >>> result = await client.get_land_price_by_address(
            ...     year="2023",
            ...     sido_code="11",
            ...     sigungu_code="11680",
            ...     dong_code="1168010300"
            ... )
        """
        response = await self.get_individual_land_price(
            stdr_year=year,
            req_lvl=ReqLevel.EUPMYEONDONG,
            ld_code=dong_code,
            num_of_rows=num_of_rows,
        )

        # 결과 파싱
        field_data = response.get("indvdLandPrices", {}).get("field", [])

        if not field_data:
            logger.warning(f"해당 지역의 공시지가 데이터 없음: {dong_code}")
            return []

        # 데이터 정리
        results = []
        for item in field_data:
            results.append({
                "year": item.get("stdrYear"),
                "ld_code": item.get("ldCode"),
                "ld_code_nm": item.get("ldCodeNm"),
                "land_category": item.get("lndcgrCodeNm"),  # 지목
                "area": float(item.get("ladAr", 0)),  # 토지면적(㎡)
                "price_per_sqm": int(item.get("ladPblntfPclnd", 0)),  # 공시지가(원/㎡)
                "purpose_area": item.get("prposAreaNm"),  # 용도지역
                "purpose_district": item.get("prposDstrcNm"),  # 용도지구
                "data_date": item.get("frstRegistDt"),  # 데이터기준일
            })

        return results

    async def get_average_land_price(
        self,
        year: str,
        dong_code: str,
    ) -> Dict[str, Any]:
        """
        특정 지역의 평균 공시지가 계산.

        Args:
            year: 기준연도
            dong_code: 법정동코드 (10자리)

        Returns:
            평균 공시지가 통계

        Example:
            >>> stats = await client.get_average_land_price(
            ...     year="2023",
            ...     dong_code="1168010300"
            ... )
            >>> print(f"평균: {stats['avg_price']:,}원/㎡")
        """
        land_prices = await self.get_land_price_by_address(
            year=year,
            sido_code=dong_code[:2],
            sigungu_code=dong_code[:5],
            dong_code=dong_code,
            num_of_rows=1000,
        )

        if not land_prices:
            return {
                "count": 0,
                "avg_price": 0,
                "min_price": 0,
                "max_price": 0,
            }

        prices = [item["price_per_sqm"] for item in land_prices if item["price_per_sqm"] > 0]

        return {
            "count": len(prices),
            "avg_price": sum(prices) // len(prices) if prices else 0,
            "min_price": min(prices) if prices else 0,
            "max_price": max(prices) if prices else 0,
            "area_name": land_prices[0]["ld_code_nm"] if land_prices else "",
        }
