"""국토교통부 연립다세대 매매 실거래가 자료 API 클라이언트."""
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


class RHTradeAPIClient:
    """
    국토교통부 연립다세대 매매 실거래가 자료 API 클라이언트.

    「부동산 거래신고 등에 관한 법률」에 따른 연립다세대 매매 실거래 신고 자료 제공

    특징:
    - 연립다세대 매매 실거래 정보
    - 층정보 제공 (개인정보 보호)
    - 매도자/매수자 구분
    - 중개사 정보 (소재지)
    - 해제사유발생일 정보

    API 문서: apis.data.go.kr/1613000/RTMSDataSvcRHTrade
    """

    BASE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade"

    def __init__(self, api_key: Optional[str] = None):
        """
        Args:
            api_key: 공공데이터포털 API 키 (없으면 settings에서 가져옴)
        """
        self.api_key = api_key or settings.data_go_kr_api_key
        self.client = httpx.AsyncClient(timeout=30.0)

        if not self.api_key:
            raise ValueError("공공데이터포털 API 키가 설정되지 않았습니다.")

        logger.info("연립다세대 매매 실거래가 API 클라이언트 초기화 완료")

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
    async def get_rh_trade(
        self,
        lawd_cd: str,
        deal_ymd: str,
        page_no: int = 1,
        num_of_rows: int = 100,
    ) -> Dict[str, Any]:
        """
        연립다세대 매매 실거래가 자료 조회.

        Args:
            lawd_cd: 지역코드 (법정동코드 앞 5자리)
            deal_ymd: 계약년월 (6자리, YYYYMM)
            page_no: 페이지 번호 (기본값: 1)
            num_of_rows: 한 페이지 결과 수 (기본값: 100)

        Returns:
            API 응답 (XML을 JSON으로 파싱)

        Example:
            >>> async with RHTradeAPIClient() as client:
            ...     result = await client.get_rh_trade(
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
            f"연립다세대 매매 조회: 지역={lawd_cd}, 계약년월={deal_ymd}"
        )

        try:
            response = await self.client.get(url)
            response.raise_for_status()

            logger.info(
                f"연립다세대 매매 API 응답: status={response.status_code}, "
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

            logger.info(f"연립다세대 매매 조회 성공: {len(item_data)}건 (총 {total_count}건)")

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
            logger.error(f"연립다세대 매매 조회 실패: {e}")
            raise

    def parse_trade_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """
        연립다세대 매매 항목을 사용하기 쉬운 형태로 파싱.

        Args:
            item: API 응답의 item 객체

        Returns:
            파싱된 거래 정보
        """
        # 거래금액 파싱 (쉼표 제거 후 정수 변환)
        deal_amount_str = item.get("dealAmount", "").strip().replace(",", "")
        deal_amount = int(deal_amount_str) * 10000 if deal_amount_str else 0

        # 날짜 파싱
        deal_year = item.get("dealYear", "")
        deal_month = item.get("dealMonth", "").zfill(2)
        deal_day = item.get("dealDay", "").zfill(2)
        deal_date = f"{deal_year}-{deal_month}-{deal_day}" if all([deal_year, deal_month, deal_day]) else None

        return {
            # 위치 정보
            "지역코드_시군구": item.get("sggCd"),
            "읍면동명": item.get("umdNm"),
            "지번": item.get("jibun"),

            # 건물 정보
            "연립다세대명": item.get("mhouseNm"),
            "전용면적": float(item.get("excluUseAr", 0)),
            "대지면적": float(item.get("landAr", 0)),
            "층": item.get("floor"),
            "건축년도": item.get("buildYear"),

            # 거래 정보
            "거래일자": deal_date,
            "거래금액_원": deal_amount,
            "거래금액_만원": deal_amount // 10000,
            "거래유형": item.get("cdealType"),
            "해제사유발생일": item.get("cdealDay"),
            "거래구분": item.get("dealingGbn"),

            # 당사자 정보
            "매도자구분": item.get("slerGbn"),
            "매수자구분": item.get("buyerGbn"),
            "중개사소재지": item.get("estateAgentSggNm"),

            # 기타
            "등록일자": item.get("rgstDate"),
        }
