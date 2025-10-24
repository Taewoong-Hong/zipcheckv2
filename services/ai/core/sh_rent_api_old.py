"""국토교통부 단독/다가구 전월세 실거래가 자료 API 클라이언트."""
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from core.settings import settings

logger = logging.getLogger(__name__)


class SHRentAPIClient:
    """
    국토교통부 단독/다가구 전월세 실거래가 자료 API 클라이언트.

    「부동산 거래신고 등에 관한 법률」 및 「주택임대차보호법」에 따른
    단독/다가구 주택 전월세 실거래 및 확정일자 자료 제공

    특징:
    - 전세 및 월세 실거래 정보
    - 계약기간, 계약유형 제공
    - 갱신요구권 사용여부
    - 종전 보증금/월세 정보
    - 개인정보 보호를 위해 지번 정보는 일부만 제공

    API 문서: apis.data.go.kr/1613000/RTMSDataSvcSHRent
    """

    BASE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent"

    def __init__(self, api_key: Optional[str] = None):
        """
        Args:
            api_key: 공공데이터포털 API 키 (없으면 settings에서 가져옴)
        """
        self.api_key = api_key or settings.data_go_kr_api_key
        self.client = httpx.AsyncClient(timeout=30.0)

        if not self.api_key:
            raise ValueError("공공데이터포털 API 키가 설정되지 않았습니다.")

        logger.info("단독/다가구 전월세 실거래가 API 클라이언트 초기화 완료")

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
    async def get_sh_rent(
        self,
        lawd_cd: str,
        deal_ymd: str,
        page_no: int = 1,
        num_of_rows: int = 100,
    ) -> Dict[str, Any]:
        """
        단독/다가구 전월세 실거래가 자료 조회.

        Args:
            lawd_cd: 지역코드 (법정동코드 앞 5자리)
            deal_ymd: 계약년월 (6자리, YYYYMM)
            page_no: 페이지 번호 (기본값: 1)
            num_of_rows: 한 페이지 결과 수 (기본값: 100)

        Returns:
            API 응답 (XML을 JSON으로 파싱)

        Example:
            >>> async with SHRentAPIClient() as client:
            ...     result = await client.get_sh_rent(
            ...         lawd_cd="11680",
            ...         deal_ymd="202401"
            ...     )
        """
        # 파라미터 검증
        if len(lawd_cd) != 5 or not lawd_cd.isdigit():
            raise ValueError(f"지역코드는 5자리 숫자여야 합니다: {lawd_cd}")

        if len(deal_ymd) != 6 or not deal_ymd.isdigit():
            raise ValueError(f"계약년월은 6자리 숫자(YYYYMM)여야 합니다: {deal_ymd}")

        # 요청 파라미터 구성
        # 공식 문서 권장: serviceKey는 있는 그대로, 나머지 파라미터만 인코딩
        from urllib.parse import urlencode

        other_params = urlencode({
            "LAWD_CD": lawd_cd,
            "DEAL_YMD": deal_ymd,
            "pageNo": str(page_no),
            "numOfRows": str(num_of_rows),
        })

        url = f"{self.BASE_URL}?serviceKey={self.api_key}&{other_params}"
        logger.info(
            f"단독/다가구 전월세 조회: 지역={lawd_cd}, 계약년월={deal_ymd}"
        )

        try:
            response = await self.client.get(url)
            response.raise_for_status()

            logger.info(
                f"단독/다가구 전월세 API 응답: status={response.status_code}, "
                f"length={len(response.content)}"
            )

            # XML 응답을 파싱하여 반환
            import xmltodict
            data = xmltodict.parse(response.text)

            # 응답 구조 확인
            response_data = data.get("response", {})
            header = response_data.get("header", {})
            body = response_data.get("body", {})

            result_code = header.get("resultCode", "")
            result_msg = header.get("resultMsg", "")

            if result_code not in ["00", "000", "0000", "INFO-000"]:
                logger.error(f"API 오류: {result_code} - {result_msg}")
                raise ValueError(f"API 오류 [{result_code}]: {result_msg}")

            # items가 없거나 totalCount가 0이면 빈 리스트 반환
            items = body.get("items", {})
            total_count = int(body.get("totalCount", 0))

            if total_count == 0:
                logger.info(f"조회 결과 없음: 지역={lawd_cd}, 계약년월={deal_ymd}")
                return {
                    "header": header,
                    "body": {
                        "items": [],
                        "numOfRows": num_of_rows,
                        "pageNo": page_no,
                        "totalCount": 0,
                    }
                }

            # item이 단일 객체인 경우 리스트로 변환
            item_data = items.get("item", [])
            if isinstance(item_data, dict):
                item_data = [item_data]

            logger.info(f"단독/다가구 전월세 조회 성공: {len(item_data)}건 (총 {total_count}건)")

            return {
                "header": header,
                "body": {
                    "items": item_data,
                    "numOfRows": int(body.get("numOfRows", num_of_rows)),
                    "pageNo": int(body.get("pageNo", page_no)),
                    "totalCount": total_count,
                }
            }

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP 오류: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"단독/다가구 전월세 조회 실패: {e}")
            raise

    def parse_rent_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """
        단독/다가구 전월세 항목을 사용하기 쉬운 형태로 파싱.

        Args:
            item: API 응답의 item 객체

        Returns:
            파싱된 전월세 정보
        """
        # 보증금 및 월세 파싱
        deposit_str = item.get("deposit", "").strip().replace(",", "")
        deposit = int(deposit_str) * 10000 if deposit_str else 0

        monthly_rent_str = item.get("monthlyRent", "").strip().replace(",", "")
        monthly_rent = int(monthly_rent_str) * 10000 if monthly_rent_str else 0

        # 종전 보증금/월세
        pre_deposit_str = item.get("preDeposit", "").strip().replace(",", "")
        pre_deposit = int(pre_deposit_str) * 10000 if pre_deposit_str else 0

        pre_monthly_rent_str = item.get("preMonthlyRent", "").strip().replace(",", "")
        pre_monthly_rent = int(pre_monthly_rent_str) * 10000 if pre_monthly_rent_str else 0

        # 날짜 파싱
        deal_year = item.get("dealYear", "")
        deal_month = item.get("dealMonth", "").zfill(2)
        deal_day = item.get("dealDay", "").zfill(2)
        deal_date = f"{deal_year}-{deal_month}-{deal_day}" if all([deal_year, deal_month, deal_day]) else None

        # 계약유형 판단
        if monthly_rent > 0:
            contract_kind = "월세"
        else:
            contract_kind = "전세"

        return {
            # 위치 정보
            "지역코드_시군구": item.get("sggCd"),
            "읍면동명": item.get("umdNm"),

            # 건물 정보
            "연면적": float(item.get("totalFloorAr", 0)),
            "건축년도": item.get("buildYear"),

            # 계약 정보
            "계약일자": deal_date,
            "계약유형": contract_kind,
            "계약기간": item.get("contractTerm"),
            "계약구분": item.get("contractType"),  # 신규/갱신

            # 금액 정보 (원)
            "보증금_원": deposit,
            "보증금_만원": deposit // 10000,
            "월세_원": monthly_rent,
            "월세_만원": monthly_rent // 10000,

            # 종전 계약 정보
            "종전보증금_원": pre_deposit,
            "종전보증금_만원": pre_deposit // 10000,
            "종전월세_원": pre_monthly_rent,
            "종전월세_만원": pre_monthly_rent // 10000,

            # 기타
            "갱신요구권사용": item.get("useRRRight"),
        }
