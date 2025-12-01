"""Public Data API Client for Korean Real Estate Information."""
import logging
from typing import Optional, Dict, Any, List
from urllib.parse import urlencode
import httpx
import xmltodict
from tenacity import retry, stop_after_attempt, wait_exponential

from .settings import settings

logger = logging.getLogger(__name__)


class PublicDataAPIError(Exception):
    """Base exception for Public Data API errors."""
    pass


class BasePublicDataAPI:
    """
    공공데이터포털 API 베이스 클래스.

    AsyncClient 생명주기를 관리하고 async context manager를 지원합니다.
    """

    def __init__(self, api_key: str, client: Optional[httpx.AsyncClient] = None, timeout: float = 30.0):
        """
        Args:
            api_key: 공공데이터포털 API 키
            client: 외부에서 제공하는 httpx.AsyncClient (선택)
            timeout: 요청 타임아웃 (초)
        """
        self.api_key = api_key
        self.client = client
        self._owns_client = client is None  # 클라이언트를 직접 생성했는지 여부
        self.timeout = timeout

    async def __aenter__(self):
        """Async context manager 진입."""
        if self.client is None:
            self.client = httpx.AsyncClient(timeout=self.timeout)
            self._owns_client = True
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager 종료."""
        if self._owns_client and self.client is not None:
            await self.client.aclose()

    async def close(self):
        """HTTP 클라이언트 종료."""
        if self._owns_client and self.client is not None:
            await self.client.aclose()


class JusoAPIClient:
    """도로명주소 검색 API 클라이언트 (행정안전부)."""

    BASE_URL = "https://www.juso.go.kr/addrlink/addrLinkApi.do"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def search_address(
        self,
        keyword: str,
        current_page: int = 1,
        count_per_page: int = 10
    ) -> Dict[str, Any]:
        """
        도로명주소 검색.

        Args:
            keyword: 검색 키워드 (예: "경기도 파주시")
            current_page: 현재 페이지 (default: 1)
            count_per_page: 페이지당 결과 수 (default: 10)

        Returns:
            검색 결과 딕셔너리

        Raises:
            PublicDataAPIError: API 호출 실패 시
        """
        logger.info(f"도로명주소 검색: keyword={keyword}, page={current_page}")

        # Form data 구성
        form_data = {
            "confmKey": self.api_key,
            "currentPage": str(current_page),
            "countPerPage": str(count_per_page),
            "keyword": keyword,
            "resultType": "json",
        }

        try:
            response = await self.client.post(
                self.BASE_URL,
                data=form_data,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                }
            )

            response.raise_for_status()
            data = response.json()

            # 에러 체크
            error_code = data.get("results", {}).get("common", {}).get("errorCode")
            error_message = data.get("results", {}).get("common", {}).get("errorMessage")

            if error_code != "0":
                logger.error(f"도로명주소 API 오류: {error_code} - {error_message}")
                raise PublicDataAPIError(f"API Error: {error_message}")

            logger.info(
                f"도로명주소 검색 성공: totalCount={data.get('results', {}).get('common', {}).get('totalCount')}"
            )

            return data.get("results", {})

        except httpx.HTTPError as e:
            logger.error(f"도로명주소 API HTTP 오류: {e}")
            raise PublicDataAPIError(f"HTTP Error: {e}") from e
        except Exception as e:
            logger.error(f"도로명주소 API 호출 실패: {e}")
            raise PublicDataAPIError(f"API call failed: {e}") from e


class LegalDongCodeAPIClient(BasePublicDataAPI):
    """행정표준코드관리시스템 법정동코드 조회 API 클라이언트."""

    BASE_URL = "http://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList"

    def __init__(self, api_key: str, client: Optional[httpx.AsyncClient] = None, timeout: float = 30.0):
        super().__init__(api_key, client, timeout)

    @retry(
        stop=stop_after_attempt(2),  # flag Y/N 두 번 시도
        wait=wait_exponential(multiplier=1, min=2, max=5)
    )
    async def get_legal_dong_code(
        self,
        keyword: str,
        with_flag: bool = True
    ) -> Dict[str, Any]:
        """
        법정동코드 조회.

        Args:
            keyword: 검색어 (예: "서울특별시 강남구 역삼동")
            with_flag: flag=Y 파라미터 포함 여부

        Returns:
            법정동코드 결과 딕셔너리

        Raises:
            PublicDataAPIError: API 호출 실패 시
        """
        logger.info(f"법정동코드 조회: keyword={keyword}, flag={with_flag}")

        params = {
            "serviceKey": self.api_key,
            "pageNo": "1",
            "numOfRows": "50",
            "_type": "json",  # JSON 응답 요청
            "locatadd_nm": keyword,
        }

        if with_flag:
            params["flag"] = "Y"

        # 공백을 %20으로 변환
        query_string = urlencode(params).replace("+", "%20")
        url = f"{self.BASE_URL}?{query_string}"

        # Ensure client is initialized
        if self.client is None:
            raise PublicDataAPIError("HTTP client not initialized. Use async context manager or provide client.")

        try:
            response = await self.client.get(url)

            logger.info(f"법정동코드 API 응답: status={response.status_code}")

            if not response.is_success:
                logger.error(f"법정동코드 API HTTP 오류: {response.status_code}")
                raise PublicDataAPIError(f"HTTP {response.status_code}")

            content_type = response.headers.get("content-type", "")
            text = response.text

            # XML or JSON 파싱
            if "xml" in content_type or text.strip().startswith("<"):
                # XML 응답
                logger.info("법정동코드 API: XML 응답 파싱")
                data = xmltodict.parse(text)

                # rows 추출
                rows = (
                    data.get("StanReginCd", {}).get("row", []) or
                    data.get("response", {}).get("body", {}).get("items", {}).get("item", []) or
                    []
                )
            else:
                # JSON 응답
                logger.info("법정동코드 API: JSON 응답 파싱")
                data = response.json()
                rows = data.get("rows", []) or data.get("StanReginCd", {}).get("row", []) or []

            # 배열로 변환
            if not isinstance(rows, list):
                rows = [rows] if rows else []

            logger.info(f"법정동코드 조회 성공: {len(rows)}개 결과")

            return {
                "header": {
                    "resultCode": "000",
                    "resultMsg": "OK"
                },
                "body": {
                    "items": self._normalize_legal_dong_items(rows),
                    "totalCount": len(rows)
                }
            }

        except httpx.HTTPError as e:
            logger.error(f"법정동코드 API HTTP 오류: {e}")
            raise PublicDataAPIError(f"HTTP Error: {e}") from e
        except Exception as e:
            logger.error(f"법정동코드 API 호출 실패: {e}")
            raise PublicDataAPIError(f"API call failed: {e}") from e

    def _normalize_legal_dong_items(self, rows: List[Dict]) -> List[Dict[str, str]]:
        """법정동 코드 데이터 정규화."""
        items = []

        for item in rows:
            # 다양한 필드명 지원
            code_raw = (
                item.get("locatjumin_cd") or
                item.get("region_cd") or
                item.get("regionCd") or
                item.get("code") or
                ""
            )

            name_raw = (
                item.get("locatadd_nm") or
                item.get("locataddNm") or
                item.get("bdongNm") or
                item.get("name") or
                ""
            )

            # 5자리 법정동코드 추출
            lawd5 = str(code_raw)[:5] if code_raw else ""

            normalized = {
                "regionCd": str(code_raw),
                "locataddNm": str(name_raw),
                "lawd5": lawd5,
                "sidoCd": str(item.get("sido_cd") or item.get("sidoCd") or ""),
                "sggCd": str(item.get("sgg_cd") or item.get("sggCd") or ""),
            }

            items.append(normalized)

        return items


class AptTradeAPIClient(BasePublicDataAPI):
    """국토교통부 아파트 실거래가 조회 API 클라이언트."""

    # 새 버전과 구 버전 API URL
    API_URLS = {
        "new": "http://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade",
        "old": "http://apis.data.go.kr/1611000/RTMSObsvService/getRTMSDataSvcAptTradeDev"
    }

    def __init__(self, api_key: str, client: Optional[httpx.AsyncClient] = None, timeout: float = 30.0):
        super().__init__(api_key, client, timeout)

    async def get_apt_trades(
        self,
        lawd_cd: str,
        deal_ymd: str,
        page_no: int = 1,
        num_of_rows: int = 100
    ) -> Dict[str, Any]:
        """
        아파트 실거래가 조회.

        Args:
            lawd_cd: 법정동코드 5자리 (예: "11680")
            deal_ymd: 거래년월 6자리 (예: "202501")
            page_no: 페이지 번호 (기본값: 1)
            num_of_rows: 한 페이지 결과 수 (기본값: 100)

        Returns:
            거래 내역 딕셔너리

        Raises:
            PublicDataAPIError: API 호출 실패 시
        """
        logger.info(f"아파트 실거래가 조회: lawd_cd={lawd_cd}, deal_ymd={deal_ymd}")

        # 파라미터 검증
        if len(lawd_cd) != 5 or not lawd_cd.isdigit():
            raise PublicDataAPIError(f"Invalid lawd_cd: {lawd_cd} (must be 5 digits)")

        if len(deal_ymd) != 6 or not deal_ymd.isdigit():
            raise PublicDataAPIError(f"Invalid deal_ymd: {deal_ymd} (must be 6 digits YYYYMM)")

        # Ensure client is initialized
        if self.client is None:
            raise PublicDataAPIError("HTTP client not initialized. Use async context manager or provide client.")

        # 새 버전 API 먼저 시도, 실패하면 구 버전 시도
        for version, base_url in self.API_URLS.items():
            try:
                logger.info(f"아파트 실거래가 API 시도: {version}")

                params = {
                    "serviceKey": self.api_key,
                    "LAWD_CD": lawd_cd,
                    "DEAL_YMD": deal_ymd,
                    "pageNo": str(page_no),
                    "numOfRows": str(num_of_rows)
                }

                response = await self.client.get(base_url, params=params)

                logger.info(f"아파트 실거래가 API 응답: status={response.status_code}")

                if not response.is_success:
                    logger.warning(f"{version} API 실패: {response.status_code}")
                    continue

                # XML 파싱
                text = response.text.replace("\ufeff", "")  # BOM 제거
                data = xmltodict.parse(text)

                # 결과 코드 확인
                result_code = (
                    data.get("response", {}).get("header", {}).get("resultCode") or
                    data.get("OpenAPI_ServiceResponse", {}).get("cmmMsgHeader", {}).get("returnAuthMsg", {}).get("resultCode")
                )

                result_msg = (
                    data.get("response", {}).get("header", {}).get("resultMsg") or
                    data.get("OpenAPI_ServiceResponse", {}).get("cmmMsgHeader", {}).get("returnAuthMsg", {}).get("resultMessage")
                )

                # 성공 코드 (TypeScript 코드와 동일 + "000" 추가)
                success_codes = ["00", "000", "0000", "INFO-000", "03", "INFO-003"]
                is_no_data = result_code in ["03", "INFO-003"] or "NO_DATA" in str(result_msg)

                if result_code and result_code not in success_codes and not is_no_data:
                    logger.error(f"아파트 실거래가 API 오류: {result_code} - {result_msg}")
                    raise PublicDataAPIError(f"API Error: {result_msg}")

                # NO_DATA 처리
                if is_no_data:
                    logger.info(f"아파트 실거래가 조회: 데이터 없음 (lawd_cd={lawd_cd}, deal_ymd={deal_ymd})")
                    return {
                        "header": {
                            "resultCode": result_code,
                            "resultMsg": result_msg or "NO_DATA"
                        },
                        "body": {
                            "items": [],
                            "totalCount": 0
                        }
                    }

                # rows 추출
                rows = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
                items = rows if isinstance(rows, list) else ([rows] if rows else [])

                logger.info(f"아파트 실거래가 조회 성공: {len(items)}개 결과")

                # DEBUG: 첫 번째 아이템의 원본 필드 확인 (전용면적 디버깅)
                if items:
                    first_item = items[0]
                    logger.info(f"[DEBUG] 원본 아이템 키: {list(first_item.keys())}")
                    logger.info(f"[DEBUG] excluUseAr 값: '{first_item.get('excluUseAr')}'")
                    logger.info(f"[DEBUG] 전용면적 값: '{first_item.get('전용면적')}'")
                    # 모든 필드 값 로깅 (처음 3개 아이템)
                    for i, item in enumerate(items[:3]):
                        area_fields = {k: v for k, v in item.items() if '면적' in str(k) or 'UseAr' in str(k) or 'Area' in str(k)}
                        logger.info(f"[DEBUG] item[{i}] 면적 관련 필드: {area_fields}")

                return {
                    "header": {
                        "resultCode": result_code or "000",
                        "resultMsg": result_msg or "OK"
                    },
                    "body": {
                        "items": self._normalize_apt_trade_items(items),
                        "totalCount": len(items)
                    }
                }

            except Exception as e:
                logger.error(f"{version} API 호출 실패: {e}")
                if version == "old":  # 마지막 시도였으면 에러 발생
                    raise PublicDataAPIError(f"All API endpoints failed: {e}") from e
                continue

        raise PublicDataAPIError("All API endpoints failed")

    def _normalize_apt_trade_items(self, items: List[Dict]) -> List[Dict[str, Any]]:
        """아파트 거래 데이터 정규화."""
        normalized = []

        for item in items:
            # 안전한 변환 헬퍼
            def safe_str(v) -> str:
                return str(v).strip() if v is not None else ""

            def safe_int(v) -> Optional[int]:
                s = safe_str(v).replace(" ", "").replace(",", "")
                try:
                    return int(s) if s else None
                except ValueError:
                    return None

            # 아파트명 추출
            apt_name = safe_str(
                item.get("aptNm") or
                item.get("아파트") or
                item.get("단지명") or
                ""
            )

            # 법정동 추출
            dong = safe_str(
                item.get("dong") or
                item.get("법정동") or
                item.get("읍면동") or
                ""
            )

            # PDF 스펙에 따른 전체 필드 매핑
            normalized_item = {
                # 기본 거래 정보
                "sggCd": safe_str(item.get("sggCd")),  # 지역코드 (5자리)
                "umdNm": safe_str(item.get("umdNm") or dong),  # 법정동 (60자)
                "aptNm": safe_str(item.get("aptNm") or apt_name),  # 단지명 (100자)
                "jibun": safe_str(item.get("지번") or item.get("jibun")),  # 지번 (20자)
                "excluUseAr": safe_str(item.get("excluUseAr") or item.get("전용면적")),  # 전용면적 (22자)

                # 계약 정보
                "dealYear": safe_int(item.get("년") or item.get("dealYear")),  # 계약년도 (4자)
                "dealMonth": safe_int(item.get("월") or item.get("dealMonth")),  # 계약월 (2자)
                "dealDay": safe_int(item.get("일") or item.get("dealDay")),  # 계약일 (2자)
                "dealAmount": safe_int(item.get("거래금액") or item.get("dealAmount")),  # 거래금액(만원) (40자)

                # 건물 정보
                "floor": safe_str(item.get("층") or item.get("floor")),  # 층 (10자)
                "buildYear": safe_int(item.get("건축년도") or item.get("buildYear")),  # 건축년도 (4자)
                "aptDong": safe_str(item.get("aptDong")),  # 아파트 동명 (400자)

                # 거래 상세 정보
                "cdealType": safe_str(item.get("해제여부") or item.get("cancelDealType") or item.get("cdealType")),  # 해제여부 (1자)
                "cdealDay": safe_str(item.get("해제사유발생일") or item.get("cancelDealDate") or item.get("cdealDay")),  # 해제사유발생일 (8자)
                "dealingGbn": safe_str(item.get("dealingGbn")),  # 거래유형 중개 및 직거래여부 (10자)
                "estateAgentSggNm": safe_str(item.get("estateAgentSggNm")),  # 중개사소재지 시군구단위 (3000자)
                "rgstDate": safe_str(item.get("rgstDate")),  # 등기일자 (8자)

                # 거래 주체 정보
                "slerGbn": safe_str(item.get("slerGbn")),  # 매도자 거래주체정보 (100자)
                "buyerGbn": safe_str(item.get("buyerGbn")),  # 매수자 거래주체정보 (100자)
                "landLeaseholdGbn": safe_str(item.get("landLeaseholdGbn")),  # 토지임대부 아파트 여부 (1자)

                # 하위 호환성을 위한 기존 필드명 유지
                "aptName": apt_name,
                "dong": dong,
                "exclusiveArea": safe_int(item.get("전용면적") or item.get("exclusiveArea") or item.get("excluUseAr")),
                "cancelDealType": safe_str(item.get("해제여부") or item.get("cancelDealType") or item.get("cdealType")),
                "cancelDealDate": safe_str(item.get("해제사유발생일") or item.get("cancelDealDate") or item.get("cdealDay")),
            }

            normalized.append(normalized_item)

        return normalized


class AptRentAPIClient(BasePublicDataAPI):
    """국토교통부 아파트 전월세 실거래가 조회 API 클라이언트."""

    API_URL = "http://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent"

    def __init__(self, api_key: str, client: Optional[httpx.AsyncClient] = None, timeout: float = 30.0):
        super().__init__(api_key, client, timeout)

    async def get_apt_rent_transactions(
        self,
        lawd_cd: str,
        deal_ymd: str,
        page_no: int = 1,
        num_of_rows: int = 100
    ) -> Dict[str, Any]:
        """
        아파트 전월세 실거래가 조회.

        Args:
            lawd_cd: 법정동코드 5자리 (예: "11110")
            deal_ymd: 계약년월 6자리 (예: "202407")
            page_no: 페이지 번호 (기본값: 1)
            num_of_rows: 한 페이지 결과 수 (기본값: 100)

        Returns:
            전월세 거래 내역 딕셔너리

        Raises:
            PublicDataAPIError: API 호출 실패 시
        """
        logger.info(f"아파트 전월세 실거래가 조회: lawd_cd={lawd_cd}, deal_ymd={deal_ymd}")

        # 파라미터 검증
        if len(lawd_cd) != 5 or not lawd_cd.isdigit():
            raise PublicDataAPIError(f"Invalid lawd_cd: {lawd_cd} (must be 5 digits)")

        if len(deal_ymd) != 6 or not deal_ymd.isdigit():
            raise PublicDataAPIError(f"Invalid deal_ymd: {deal_ymd} (must be 6 digits YYYYMM)")

        # Ensure client is initialized
        if self.client is None:
            raise PublicDataAPIError("HTTP client not initialized. Use async context manager or provide client.")

        try:
            params = {
                "serviceKey": self.api_key,
                "LAWD_CD": lawd_cd,
                "DEAL_YMD": deal_ymd,
                "pageNo": str(page_no),
                "numOfRows": str(num_of_rows)
            }

            response = await self.client.get(self.API_URL, params=params)

            logger.info(f"아파트 전월세 실거래가 API 응답: status={response.status_code}")

            if not response.is_success:
                logger.error(f"아파트 전월세 실거래가 API HTTP 오류: {response.status_code}")
                raise PublicDataAPIError(f"HTTP {response.status_code}")

            # XML 파싱
            text = response.text.replace("\ufeff", "")  # BOM 제거
            data = xmltodict.parse(text)

            # 결과 코드 확인
            result_code = (
                data.get("response", {}).get("header", {}).get("resultCode") or
                data.get("OpenAPI_ServiceResponse", {}).get("cmmMsgHeader", {}).get("returnAuthMsg", {}).get("resultCode")
            )

            result_msg = (
                data.get("response", {}).get("header", {}).get("resultMsg") or
                data.get("OpenAPI_ServiceResponse", {}).get("cmmMsgHeader", {}).get("returnAuthMsg", {}).get("resultMessage")
            )

            # 성공 코드
            success_codes = ["00", "000", "0000", "INFO-000", "03", "INFO-003"]
            is_no_data = result_code in ["03", "INFO-003"] or "NO_DATA" in str(result_msg)

            if result_code and result_code not in success_codes and not is_no_data:
                logger.error(f"아파트 전월세 실거래가 API 오류: {result_code} - {result_msg}")
                raise PublicDataAPIError(f"API Error: {result_msg}")

            # NO_DATA 처리
            if is_no_data:
                logger.info(f"아파트 전월세 실거래가 조회: 데이터 없음 (lawd_cd={lawd_cd}, deal_ymd={deal_ymd})")
                return {
                    "header": {
                        "resultCode": result_code,
                        "resultMsg": result_msg or "NO_DATA"
                    },
                    "body": {
                        "items": [],
                        "totalCount": 0
                    }
                }

            # rows 추출
            rows = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
            items = rows if isinstance(rows, list) else ([rows] if rows else [])

            logger.info(f"아파트 전월세 실거래가 조회 성공: {len(items)}개 결과")

            return {
                "header": {
                    "resultCode": result_code or "000",
                    "resultMsg": result_msg or "OK"
                },
                "body": {
                    "items": self._normalize_apt_rent_items(items),
                    "totalCount": len(items)
                }
            }

        except httpx.HTTPError as e:
            logger.error(f"아파트 전월세 실거래가 API HTTP 오류: {e}")
            raise PublicDataAPIError(f"HTTP Error: {e}") from e
        except Exception as e:
            logger.error(f"아파트 전월세 실거래가 API 호출 실패: {e}")
            raise PublicDataAPIError(f"API call failed: {e}") from e

    def _normalize_apt_rent_items(self, items: List[Dict]) -> List[Dict[str, Any]]:
        """아파트 전월세 거래 데이터 정규화."""
        normalized = []

        for item in items:
            # 안전한 변환 헬퍼
            def safe_str(v) -> str:
                return str(v).strip() if v is not None else ""

            def safe_int(v) -> Optional[int]:
                s = safe_str(v).replace(" ", "").replace(",", "")
                try:
                    return int(s) if s else None
                except ValueError:
                    return None

            # PDF 스펙에 따른 필드 매핑
            normalized_item = {
                "sggCd": safe_str(item.get("sggCd")),  # 지역코드 (5자리)
                "umdNm": safe_str(item.get("umdNm")),  # 법정동 (30자)
                "aptNm": safe_str(item.get("aptNm")),  # 아파트명 (100자)
                "jibun": safe_str(item.get("jibun")),  # 지번 (20자)
                "excluUseAr": safe_str(item.get("excluUseAr")),  # 전용면적 (22자)
                "dealYear": safe_int(item.get("dealYear")),  # 계약년도 (4자)
                "dealMonth": safe_int(item.get("dealMonth")),  # 계약월 (2자)
                "dealDay": safe_int(item.get("dealDay")),  # 계약일 (2자)
                "deposit": safe_int(item.get("deposit")),  # 보증금액(만원) (40자)
                "monthlyRent": safe_int(item.get("monthlyRent")),  # 월세금액(만원) (40자)
                "floor": safe_str(item.get("floor")),  # 층 (10자)
                "buildYear": safe_int(item.get("buildYear")),  # 건축년도 (4자)
                "contractTerm": safe_str(item.get("contractTerm")),  # 계약기간 (12자)
                "contractType": safe_str(item.get("contractType")),  # 계약구분 (4자)
                "useRRRight": safe_str(item.get("useRRRight")),  # 갱신요구권사용 (4자)
                "preDeposit": safe_int(item.get("preDeposit")),  # 종전계약보증금 (40자)
                "preMonthlyRent": safe_int(item.get("preMonthlyRent")),  # 종전계약월세 (40자)
            }

            normalized.append(normalized_item)

        return normalized
