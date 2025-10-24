"""국토교통부 연립다세대 매매 실거래가 자료 API 클라이언트 (리팩토링)."""
import logging
from typing import Dict, Any

from core.data_go_kr import call_data_go_api, normalize_response
from core.settings import settings
from core.rtms_base import RTMSBaseClient

logger = logging.getLogger(__name__)


class RHTradeAPIClient(RTMSBaseClient):
    """
    국토교통부 연립다세대 매매 실거래가 자료 API 클라이언트.

    공통 유틸(data_go_kr.py)을 사용하여 간결하게 구현.
    """

    BASE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade"

    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.data_go_kr_api_key
        if not self.api_key:
            raise ValueError("공공데이터포털 API 키가 설정되지 않았습니다.")
        logger.info("연립다세대 매매 실거래가 API 클라이언트 초기화 완료")

    async def get_rh_trade(
        self,
        lawd_cd: str,
        deal_ymd: str,
        page_no: int = 1,
        num_of_rows: int = 100,
    ) -> Dict[str, Any]:
        """연립다세대 매매 실거래가 자료 조회."""
        if len(lawd_cd) != 5 or not lawd_cd.isdigit():
            raise ValueError(f"지역코드는 5자리 숫자여야 합니다: {lawd_cd}")
        if len(deal_ymd) != 6 or not deal_ymd.isdigit():
            raise ValueError(f"계약년월은 6자리 숫자(YYYYMM)여야 합니다: {deal_ymd}")

        logger.info(f"연립다세대 매매 조회: 지역={lawd_cd}, 계약년월={deal_ymd}")

        data = await call_data_go_api(
            base_url=self.BASE_URL,
            api_key=self.api_key,
            params={
                "LAWD_CD": lawd_cd,
                "DEAL_YMD": deal_ymd,
                "pageNo": str(page_no),
                "numOfRows": str(num_of_rows),
            },
        )

        result = normalize_response(data)
        logger.info(f"연립다세대 매매 조회 성공: {result['body']['totalCount']}건")
        return result
