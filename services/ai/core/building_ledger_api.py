"""Building Ledger API Client for Korean Real Estate Information."""
import logging
from typing import Optional, Dict, Any
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from .settings import settings

logger = logging.getLogger(__name__)


class BuildingLedgerAPIError(Exception):
    """Base exception for Building Ledger API errors."""
    pass


class BuildingLedgerAPIClient:
    """국토교통부 건축HUB 건축물대장 조회 API 클라이언트."""

    BASE_URL = "http://apis.data.go.kr/1613000/BldRgstHubService"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.building_ledger_api_key
        self.client = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def search_building_by_address(
        self,
        sigungu_cd: str,
        bjdong_cd: str,
        plat_gb_cd: str,
        bun: str,
        ji: str = "",
        num_of_rows: int = 10,
        page_no: int = 1
    ) -> Dict[str, Any]:
        """
        주소 기반 건축물대장 검색 (표제부 요약 정보).

        Args:
            sigungu_cd: 시군구코드 5자리 (예: "11680")
            bjdong_cd: 법정동코드 5자리 (예: "10300")
            plat_gb_cd: 대지구분코드 (0:대지, 1:산, 2:블록)
            bun: 본번 (예: "12" or "0012")
            ji: 지번 (예: "3" or "0003", 없으면 빈 문자열)
            num_of_rows: 페이지당 결과 수 (default: 10)
            page_no: 페이지 번호 (default: 1)

        Returns:
            {
                "success": True,
                "totalCount": 총 건수,
                "items": [
                    {
                        "mgmBldrgstPk": "관리건축물대장PK (고유번호)",
                        "platPlc": "대지위치 (주소)",
                        "newPlatPlc": "도로명대지위치",
                        "bldNm": "건물명",
                        "splotNm": "특수지명",
                        "mainPurpsCdNm": "주용도코드명",
                        "etcPurps": "기타용도",
                        "mainBldCnt": "주건축물수",
                        "atchBldCnt": "부속건축물수",
                        "totArea": "총면적",
                        "archArea": "건축면적",
                        "bcRat": "건폐율",
                        "vlRat": "용적률",
                        "useAprDay": "사용승인일"
                    }
                ],
                "query": {
                    "sigungu_cd": str,
                    "bjdong_cd": str,
                    "bun": str,
                    "ji": str
                }
            }

        Raises:
            BuildingLedgerAPIError: API 호출 실패 시
        """
        logger.info(f"건축물대장 검색: sigungu={sigungu_cd}, bjdong={bjdong_cd}, bun={bun}, ji={ji}")

        endpoint = f"{self.BASE_URL}/getBrRecapTitleInfo"

        params = {
            "serviceKey": self.api_key,
            "sigunguCd": sigungu_cd,
            "bjdongCd": bjdong_cd,
            "platGbCd": plat_gb_cd,
            "bun": bun.zfill(4),  # 4자리 본번
            "ji": ji.zfill(4) if ji else "0000",  # 4자리 지번
            "numOfRows": str(num_of_rows),
            "pageNo": str(page_no),
            "_type": "json"  # JSON 응답 요청
        }

        try:
            response = await self.client.get(endpoint, params=params)
            response.raise_for_status()

            data = response.json()
            logger.info(f"건축물대장 API 응답: status={response.status_code}")

            # 에러 체크
            header = data.get("response", {}).get("header", {})
            result_code = header.get("resultCode")
            result_msg = header.get("resultMsg")

            if result_code != "00":
                logger.error(f"건축물대장 API 오류: {result_code} - {result_msg}")
                raise BuildingLedgerAPIError(f"API Error: {result_msg}")

            # 응답 구조 확인
            response_body = data.get("response", {}).get("body", {})
            items_data = response_body.get("items", {})
            total_count = response_body.get("totalCount", 0)

            # items 추출
            item_list = items_data.get("item", [])
            items = item_list if isinstance(item_list, list) else ([item_list] if item_list else [])

            logger.info(f"건축물대장 검색 성공: {len(items)}개 결과 (총 {total_count}건)")

            return {
                "success": True,
                "totalCount": total_count,
                "items": items,
                "query": {
                    "sigungu_cd": sigungu_cd,
                    "bjdong_cd": bjdong_cd,
                    "bun": bun,
                    "ji": ji
                }
            }

        except httpx.HTTPError as e:
            logger.error(f"건축물대장 API HTTP 오류: {e}")
            raise BuildingLedgerAPIError(f"HTTP Error: {e}") from e
        except Exception as e:
            logger.error(f"건축물대장 API 호출 실패: {e}")
            raise BuildingLedgerAPIError(f"API call failed: {e}") from e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def get_building_detail(
        self,
        sigungu_cd: str,
        bjdong_cd: str,
        plat_gb_cd: str,
        bun: str,
        ji: str,
        mgm_bldrgst_pk: str
    ) -> Dict[str, Any]:
        """
        건축물대장 상세 정보 조회 (표제부).

        Args:
            sigungu_cd: 시군구코드
            bjdong_cd: 법정동코드
            plat_gb_cd: 대지구분코드
            bun: 본번
            ji: 지번
            mgm_bldrgst_pk: 관리건축물대장PK (고유번호)

        Returns:
            {
                "success": True,
                "item": {
                    "mgmBldrgstPk": "관리건축물대장PK",
                    "platPlc": "대지위치",
                    "newPlatPlc": "도로명대지위치",
                    "bldNm": "건물명",
                    "splotNm": "특수지명",
                    "block": "블록",
                    "lot": "로트",
                    "bylotCnt": "외필지수",
                    "mainPurpsCd": "주용도코드",
                    "mainPurpsCdNm": "주용도코드명",
                    "etcPurps": "기타용도",
                    "roofCd": "지붕코드",
                    "roofCdNm": "지붕코드명",
                    "etcRoof": "기타지붕",
                    "hhldCnt": "세대수",
                    "fmlyCnt": "가구수",
                    "mainBldCnt": "주건축물수",
                    "atchBldCnt": "부속건축물수",
                    "atchBldArea": "부속건축물면적",
                    "totDongTotArea": "총동연면적",
                    "indrMechUtcnt": "옥내기계식대수",
                    "indrMechArea": "옥내기계식면적",
                    "oudrMechUtcnt": "옥외기계식대수",
                    "oudrMechArea": "옥외기계식면적",
                    "indrAutoUtcnt": "옥내자주식대수",
                    "indrAutoArea": "옥내자주식면적",
                    "oudrAutoUtcnt": "옥외자주식대수",
                    "oudrAutoArea": "옥외자주식면적",
                    "pmsDay": "허가일",
                    "stcnsDay": "착공일",
                    "useAprDay": "사용승인일",
                    "pmsno": "허가번호",
                    "archArea": "건축면적",
                    "bcRat": "건폐율",
                    "totArea": "연면적",
                    "vlRatEstmTotArea": "용적률산정연면적",
                    "vlRat": "용적률",
                    "mainAtchGbCdNm": "주부속구분코드명",
                    "platArea": "대지면적",
                    "height": "높이",
                    "grndFlrCnt": "지상층수",
                    "ugrndFlrCnt": "지하층수",
                    "rideUseElvtCnt": "승용승강기수",
                    "emgenUseElvtCnt": "비상용승강기수",
                    "hoCorUseyn": "복도사용여부",
                    "engrGrade": "에너지등급",
                    "engrRat": "에너지효율",
                    "engrEpi": "EPI점수",
                    "gnBldGrade": "친환경건축물등급",
                    "gnBldCert": "친환경건축물인증점수",
                    "itgBldGrade": "지능형건축물등급",
                    "itgBldCert": "지능형건축물인증점수",
                    "crtnDay": "생성일자"
                },
                "query": {"mgm_bldrgst_pk": str}
            }

        Raises:
            BuildingLedgerAPIError: API 호출 실패 시
        """
        logger.info(f"건축물대장 상세 조회: pk={mgm_bldrgst_pk}")

        endpoint = f"{self.BASE_URL}/getBrTitleInfo"

        params = {
            "serviceKey": self.api_key,
            "sigunguCd": sigungu_cd,
            "bjdongCd": bjdong_cd,
            "platGbCd": plat_gb_cd,
            "bun": bun.zfill(4),
            "ji": ji.zfill(4) if ji else "0000",
            "mgmBldrgstPk": mgm_bldrgst_pk,
            "_type": "json"
        }

        try:
            response = await self.client.get(endpoint, params=params)
            response.raise_for_status()

            data = response.json()

            # 에러 체크
            header = data.get("response", {}).get("header", {})
            result_code = header.get("resultCode")
            result_msg = header.get("resultMsg")

            if result_code != "00":
                logger.error(f"건축물대장 상세 API 오류: {result_code} - {result_msg}")
                raise BuildingLedgerAPIError(f"API Error: {result_msg}")

            response_body = data.get("response", {}).get("body", {})
            items_data = response_body.get("items", {})

            item = items_data.get("item", {})
            items = [item] if isinstance(item, dict) else (item if isinstance(item, list) else [])

            logger.info(f"건축물대장 상세 조회 성공: {len(items)}개 결과")

            return {
                "success": True,
                "item": items[0] if items else {},
                "query": {"mgm_bldrgst_pk": mgm_bldrgst_pk}
            }

        except httpx.HTTPError as e:
            logger.error(f"건축물대장 상세 API HTTP 오류: {e}")
            raise BuildingLedgerAPIError(f"HTTP Error: {e}") from e
        except Exception as e:
            logger.error(f"건축물대장 상세 API 호출 실패: {e}")
            raise BuildingLedgerAPIError(f"API call failed: {e}") from e


# Helper function for easy usage
async def search_building(
    address: str,
    sigungu_cd: str,
    bjdong_cd: str,
    bun: str,
    ji: str = "",
    plat_gb_cd: str = "0"
) -> Dict[str, Any]:
    """
    건축물대장 간편 검색 헬퍼 함수.

    Args:
        address: 검색 주소 (로깅용)
        sigungu_cd: 시군구코드 5자리
        bjdong_cd: 법정동코드 5자리
        bun: 본번
        ji: 지번 (옵션)
        plat_gb_cd: 대지구분코드 (default: 0-대지)

    Returns:
        건축물대장 검색 결과
    """
    async with BuildingLedgerAPIClient() as client:
        result = await client.search_building_by_address(
            sigungu_cd=sigungu_cd,
            bjdong_cd=bjdong_cd,
            plat_gb_cd=plat_gb_cd,
            bun=bun,
            ji=ji
        )
        return result
