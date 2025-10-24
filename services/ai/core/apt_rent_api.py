"""국토교통부 아파트 전월세 실거래가 자료 API 클라이언트 (리팩토링)."""
import logging
from typing import Dict, Any

from core.data_go_kr import call_data_go_api, normalize_response
from core.settings import settings
from core.rtms_base import RTMSBaseClient

logger = logging.getLogger(__name__)


class AptRentAPIClient(RTMSBaseClient):
    """
    국토교통부 아파트 전월세 실거래가 자료 API 클라이언트.

    공통 유틸(data_go_kr.py)을 사용하여 간결하게 구현.
    """

    BASE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent"

    def __init__(self, api_key: str = None):
        """
        Args:
            api_key: 공공데이터포털 API 키 (없으면 settings에서 가져옴)
        """
        self.api_key = api_key or settings.data_go_kr_api_key

        if not self.api_key:
            raise ValueError("공공데이터포털 API 키가 설정되지 않았습니다.")

        logger.info("아파트 전월세 실거래가 API 클라이언트 초기화 완료")

    async def get_apt_rent(
        self,
        lawd_cd: str,
        deal_ymd: str,
        page_no: int = 1,
        num_of_rows: int = 100,
    ) -> Dict[str, Any]:
        """
        아파트 전월세 실거래가 자료 조회.

        Args:
            lawd_cd: 지역코드 (법정동코드 앞 5자리)
            deal_ymd: 계약년월 (6자리, YYYYMM)
            page_no: 페이지 번호 (기본값: 1)
            num_of_rows: 한 페이지 결과 수 (기본값: 100)

        Returns:
            {
                "header": {"resultCode": "000", "resultMsg": "OK"},
                "body": {"items": [...], "totalCount": 1644}
            }

        Raises:
            ValueError: 파라미터 검증 실패 또는 API 오류
        """
        # 파라미터 검증
        if len(lawd_cd) != 5 or not lawd_cd.isdigit():
            raise ValueError(f"지역코드는 5자리 숫자여야 합니다: {lawd_cd}")

        if len(deal_ymd) != 6 or not deal_ymd.isdigit():
            raise ValueError(f"계약년월은 6자리 숫자(YYYYMM)여야 합니다: {deal_ymd}")

        logger.info(
            f"아파트 전월세 조회: 지역={lawd_cd}, "
            f"계약년월={deal_ymd}, 페이지={page_no}"
        )

        # 공통 유틸로 API 호출
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

        # 표준 형식으로 변환
        result = normalize_response(data)

        logger.info(
            f"아파트 전월세 조회 성공: {result['body']['totalCount']}건"
        )

        return result
