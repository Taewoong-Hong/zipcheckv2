"""
주소 변환 유틸리티

PDF에서 파싱된 한글 주소를 공공데이터 API가 요구하는 형식으로 변환합니다.

변환 결과:
- sigungu_cd: 시군구코드 5자리 (예: "11680")
- bjdong_cd: 법정동코드 5자리 (예: "10300")
- bun: 본번 (예: "12")
- ji: 지번 (예: "3")
- lawd_cd: 법정동코드 5자리 (실거래가 API용)
"""
import re
import logging
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass
from pydantic import BaseModel
import httpx

logger = logging.getLogger(__name__)


@dataclass
class ParsedAddress:
    """파싱된 주소 구조체"""
    # 원본
    raw_address: str

    # 행정구역
    sido: Optional[str] = None  # 시도 (예: "경기도", "서울특별시")
    sigungu: Optional[str] = None  # 시군구 (예: "파주시", "강남구")
    eupmyeondong: Optional[str] = None  # 읍면동 (예: "법원읍", "역삼동")
    ri: Optional[str] = None  # 리 (예: "동문리")

    # 도로명주소
    road_name: Optional[str] = None  # 도로명 (예: "하우고개길")
    building_main_no: Optional[str] = None  # 건물본번 (예: "356")
    building_sub_no: Optional[str] = None  # 건물부번 (예: "2")

    # 지번주소
    bun: Optional[str] = None  # 본번 (예: "123")
    ji: Optional[str] = None  # 지번 (예: "45")

    # 상세주소
    detail: Optional[str] = None  # 상세주소 (예: "101동 1001호")

    # API용 코드
    sigungu_cd: Optional[str] = None  # 시군구코드 5자리
    bjdong_cd: Optional[str] = None  # 법정동코드 5자리
    lawd_cd: Optional[str] = None  # 법정동코드 5자리 (실거래가용)

    @property
    def full_code(self) -> Optional[str]:
        """10자리 전체 법정동코드"""
        if self.sigungu_cd and self.bjdong_cd:
            return f"{self.sigungu_cd}{self.bjdong_cd}"
        return None


class AddressConvertResult(BaseModel):
    """주소 변환 결과"""
    success: bool
    parsed: Optional[Dict[str, Any]] = None
    sigungu_cd: Optional[str] = None
    bjdong_cd: Optional[str] = None
    bun: Optional[str] = None
    ji: Optional[str] = None
    lawd_cd: Optional[str] = None
    error: Optional[str] = None

    # 추가 정보
    juso_api_result: Optional[Dict[str, Any]] = None
    legal_dong_result: Optional[Dict[str, Any]] = None


class AddressConverter:
    """
    한글 주소를 공공데이터 API 형식으로 변환하는 유틸리티

    사용 예:
    ```python
    async with AddressConverter() as converter:
        result = await converter.convert("경기도 파주시 하우고개길 356")
        print(result.sigungu_cd)  # "41390"
        print(result.bjdong_cd)   # "25000"
        print(result.bun)         # "356"
    ```
    """

    def __init__(
        self,
        juso_api_key: Optional[str] = None,
        public_data_api_key: Optional[str] = None
    ):
        from core.settings import settings

        self.juso_api_key = juso_api_key or settings.keyword_juso_api_key
        self.public_data_api_key = public_data_api_key or settings.public_data_api_key
        self.client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()

    def parse_address_regex(self, address: str) -> ParsedAddress:
        """
        정규식으로 주소 파싱 (API 호출 없이)

        지원 형식:
        - 도로명주소: "경기도 파주시 하우고개길 356"
        - 지번주소: "서울특별시 강남구 역삼동 123-45"
        - 복합주소: "경기도 파주시 법원읍 동문리 356-2"
        """
        parsed = ParsedAddress(raw_address=address)

        # 정규화: 여러 공백을 하나로
        normalized = " ".join(address.split())

        # 시도 추출
        sido_pattern = r'^(서울특별시|서울시|서울|부산광역시|부산시|부산|대구광역시|대구시|대구|인천광역시|인천시|인천|광주광역시|광주시|광주|대전광역시|대전시|대전|울산광역시|울산시|울산|세종특별자치시|세종시|세종|경기도|경기|강원도|강원특별자치도|강원|충청북도|충북|충청남도|충남|전라북도|전북특별자치도|전북|전라남도|전남|경상북도|경북|경상남도|경남|제주특별자치도|제주도|제주)'
        sido_match = re.match(sido_pattern, normalized)
        if sido_match:
            parsed.sido = self._normalize_sido(sido_match.group(1))
            normalized = normalized[sido_match.end():].strip()

        # 시군구 추출
        sigungu_pattern = r'^([가-힣]+(?:시|군|구))'
        sigungu_match = re.match(sigungu_pattern, normalized)
        if sigungu_match:
            parsed.sigungu = sigungu_match.group(1)
            normalized = normalized[sigungu_match.end():].strip()

            # 추가 구 (예: "수원시 영통구")
            extra_gu_pattern = r'^([가-힣]+구)'
            extra_gu_match = re.match(extra_gu_pattern, normalized)
            if extra_gu_match:
                parsed.sigungu = f"{parsed.sigungu} {extra_gu_match.group(1)}"
                normalized = normalized[extra_gu_match.end():].strip()

        # 읍면동 추출
        eupmyeondong_pattern = r'^([가-힣]+(?:읍|면|동|가))'
        eupmyeondong_match = re.match(eupmyeondong_pattern, normalized)
        if eupmyeondong_match:
            parsed.eupmyeondong = eupmyeondong_match.group(1)
            normalized = normalized[eupmyeondong_match.end():].strip()

        # 리 추출
        ri_pattern = r'^([가-힣]+리)'
        ri_match = re.match(ri_pattern, normalized)
        if ri_match:
            parsed.ri = ri_match.group(1)
            normalized = normalized[ri_match.end():].strip()

        # 도로명 + 건물번호 추출
        road_pattern = r'^([가-힣\d]+(?:로|길))\s*(\d+)(?:-(\d+))?'
        road_match = re.match(road_pattern, normalized)
        if road_match:
            parsed.road_name = road_match.group(1)
            parsed.building_main_no = road_match.group(2)
            parsed.building_sub_no = road_match.group(3)
            parsed.bun = road_match.group(2)  # 도로명 건물번호를 본번으로 사용
            parsed.ji = road_match.group(3) or ""
            normalized = normalized[road_match.end():].strip()
        else:
            # 지번 추출
            jibun_pattern = r'^(\d+)(?:-(\d+))?'
            jibun_match = re.match(jibun_pattern, normalized)
            if jibun_match:
                parsed.bun = jibun_match.group(1)
                parsed.ji = jibun_match.group(2) or ""
                normalized = normalized[jibun_match.end():].strip()

        # 나머지는 상세주소
        if normalized:
            parsed.detail = normalized

        return parsed

    def _normalize_sido(self, sido: str) -> str:
        """시도명 정규화"""
        mappings = {
            "서울": "서울특별시",
            "서울시": "서울특별시",
            "부산": "부산광역시",
            "부산시": "부산광역시",
            "대구": "대구광역시",
            "대구시": "대구광역시",
            "인천": "인천광역시",
            "인천시": "인천광역시",
            "광주": "광주광역시",
            "광주시": "광주광역시",
            "대전": "대전광역시",
            "대전시": "대전광역시",
            "울산": "울산광역시",
            "울산시": "울산광역시",
            "세종": "세종특별자치시",
            "세종시": "세종특별자치시",
            "경기": "경기도",
            "강원": "강원특별자치도",
            "강원도": "강원특별자치도",
            "충북": "충청북도",
            "충남": "충청남도",
            "전북": "전북특별자치도",
            "전라북도": "전북특별자치도",
            "전남": "전라남도",
            "경북": "경상북도",
            "경남": "경상남도",
            "제주": "제주특별자치도",
            "제주도": "제주특별자치도",
        }
        return mappings.get(sido, sido)

    async def lookup_juso_api(self, address: str) -> Optional[Dict[str, Any]]:
        """
        도로명주소 API로 주소 검색

        Returns:
            {
                "roadAddr": "경기도 파주시 하우고개길 356",
                "jibunAddr": "경기도 파주시 법원읍 동문리 356-2",
                "zipNo": "10859",
                "bdNm": "건물명",
                "admCd": "4139025000",  # 행정동코드
                "rnMgtSn": "...",
                "bdMgtSn": "4139010300110356000200001",  # 건물관리번호
                ...
            }
        """
        if not self.juso_api_key:
            logger.warning("JUSO_API_KEY not configured")
            return None

        if not self.client:
            raise RuntimeError("Client not initialized. Use async context manager.")

        url = "https://www.juso.go.kr/addrlink/addrLinkApi.do"

        try:
            response = await self.client.post(
                url,
                data={
                    "confmKey": self.juso_api_key,
                    "currentPage": "1",
                    "countPerPage": "10",
                    "keyword": address,
                    "resultType": "json",
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                }
            )

            response.raise_for_status()
            data = response.json()

            results = data.get("results", {})
            common = results.get("common", {})

            if common.get("errorCode") != "0":
                logger.error(f"JusoAPI error: {common.get('errorMessage')}")
                return None

            juso_list = results.get("juso", [])
            if juso_list:
                return juso_list[0]

            return None

        except Exception as e:
            logger.error(f"JusoAPI lookup failed: {e}")
            return None

    async def lookup_legal_dong_code(self, address: str) -> Optional[Dict[str, Any]]:
        """
        법정동코드 API로 법정동코드 조회

        Returns:
            {
                "regionCd": "4139025000",
                "locataddNm": "경기도 파주시 법원읍",
                "lawd5": "41390",
                "sidoCd": "41",
                "sggCd": "390"
            }
        """
        from core.public_data_api import LegalDongCodeAPIClient

        if not self.client:
            raise RuntimeError("Client not initialized. Use async context manager.")

        try:
            legal_dong_client = LegalDongCodeAPIClient(
                api_key=self.public_data_api_key,
                client=self.client
            )
            result = await legal_dong_client.get_legal_dong_code(keyword=address)

            items = result.get("body", {}).get("items", [])
            if items:
                return items[0]

            return None

        except Exception as e:
            logger.error(f"LegalDongCode lookup failed: {e}")
            return None

    def extract_codes_from_bdMgtSn(self, bd_mgt_sn: str) -> Tuple[str, str, str, str]:
        """
        건물관리번호에서 코드 추출

        건물관리번호 형식: 4139010300110356000200001 (25자리)
        - [0:5] 시군구코드: 41390
        - [5:10] 법정동코드: 10300
        - [10:11] 대지구분: 1 (0:대지, 1:산, 2:블록)
        - [11:15] 본번: 0356
        - [15:19] 부번: 0002
        - [19:25] 일련번호: 000001

        Returns:
            (sigungu_cd, bjdong_cd, bun, ji)
        """
        if not bd_mgt_sn or len(bd_mgt_sn) < 19:
            return ("", "", "", "")

        sigungu_cd = bd_mgt_sn[0:5]
        bjdong_cd = bd_mgt_sn[5:10]
        bun = bd_mgt_sn[11:15].lstrip("0") or "0"
        ji = bd_mgt_sn[15:19].lstrip("0") or ""

        return (sigungu_cd, bjdong_cd, bun, ji)

    def extract_codes_from_admCd(self, adm_cd: str) -> Tuple[str, str]:
        """
        행정동코드에서 시군구코드, 법정동코드 추출

        행정동코드 형식: 4139025000 (10자리)
        - [0:5] 시군구코드: 41390
        - [5:10] 법정동코드: 25000

        Returns:
            (sigungu_cd, bjdong_cd)
        """
        if not adm_cd or len(adm_cd) < 10:
            return ("", "")

        sigungu_cd = adm_cd[0:5]
        bjdong_cd = adm_cd[5:10]

        return (sigungu_cd, bjdong_cd)

    async def convert(self, address: str, use_juso_api: bool = False) -> AddressConvertResult:
        """
        한글 주소를 공공데이터 API 형식으로 변환

        변환 전략:
        1. 정규식으로 주소 파싱 (본번/지번 추출)
        2. 법정동코드 API로 시군구코드/법정동코드 획득
        3. (선택) JusoAPI로 정확한 건물관리번호 조회

        Args:
            address: 한글 주소 (예: "경기도 파주시 하우고개길 356")
            use_juso_api: JusoAPI 사용 여부 (Lab에서는 False - PDF에서 이미 주소를 파싱했으므로)

        Returns:
            AddressConvertResult: 변환 결과
        """
        logger.info(f"주소 변환 시작: {address}")

        # Step 1: 정규식 파싱 (본번/지번 추출)
        parsed = self.parse_address_regex(address)
        logger.info(f"정규식 파싱 결과: sido={parsed.sido}, sigungu={parsed.sigungu}, bun={parsed.bun}, ji={parsed.ji}")

        # Step 2 (선택): JusoAPI 조회 - 상세주소 검색이 필요한 경우에만
        if use_juso_api:
            juso_result = await self.lookup_juso_api(address)

            if juso_result:
                logger.info(f"JusoAPI 조회 성공: {juso_result.get('roadAddr')}")

                # 건물관리번호에서 코드 추출
                bd_mgt_sn = juso_result.get("bdMgtSn", "")
                if bd_mgt_sn and len(bd_mgt_sn) >= 19:
                    sigungu_cd, bjdong_cd, bun, ji = self.extract_codes_from_bdMgtSn(bd_mgt_sn)

                    return AddressConvertResult(
                        success=True,
                        parsed=parsed.__dict__,
                        sigungu_cd=sigungu_cd,
                        bjdong_cd=bjdong_cd,
                        bun=bun or parsed.bun,
                        ji=ji or parsed.ji or "",
                        lawd_cd=sigungu_cd,  # 실거래가 API용
                        juso_api_result=juso_result,
                    )

                # 행정동코드에서 추출 (fallback)
                adm_cd = juso_result.get("admCd", "")
                if adm_cd and len(adm_cd) >= 10:
                    sigungu_cd, bjdong_cd = self.extract_codes_from_admCd(adm_cd)

                    return AddressConvertResult(
                        success=True,
                        parsed=parsed.__dict__,
                        sigungu_cd=sigungu_cd,
                        bjdong_cd=bjdong_cd,
                        bun=parsed.bun or "",
                        ji=parsed.ji or "",
                        lawd_cd=sigungu_cd,
                        juso_api_result=juso_result,
                    )

        # Step 3: 법정동코드 API로 시군구코드/법정동코드 획득
        logger.info("법정동코드 API로 코드 조회")

        # 검색 키워드 구성 (시도 + 시군구 + 읍면동)
        search_keyword = address
        if parsed.sido and parsed.sigungu:
            if parsed.eupmyeondong:
                search_keyword = f"{parsed.sido} {parsed.sigungu} {parsed.eupmyeondong}"
            else:
                search_keyword = f"{parsed.sido} {parsed.sigungu}"

        legal_dong_result = await self.lookup_legal_dong_code(search_keyword)

        if legal_dong_result:
            logger.info(f"법정동코드 조회 성공: {legal_dong_result.get('locataddNm')}")

            region_cd = legal_dong_result.get("regionCd", "")
            if region_cd and len(region_cd) >= 10:
                sigungu_cd = region_cd[0:5]
                bjdong_cd = region_cd[5:10]

                return AddressConvertResult(
                    success=True,
                    parsed=parsed.__dict__,
                    sigungu_cd=sigungu_cd,
                    bjdong_cd=bjdong_cd,
                    bun=parsed.bun or "",
                    ji=parsed.ji or "",
                    lawd_cd=legal_dong_result.get("lawd5", sigungu_cd),
                    legal_dong_result=legal_dong_result,
                )

        # API 실패
        logger.warning(f"주소 변환 실패: {address}")
        return AddressConvertResult(
            success=False,
            parsed=parsed.__dict__,
            bun=parsed.bun,
            ji=parsed.ji,
            error="법정동코드 API에서 주소 코드를 찾을 수 없습니다.",
        )


# 편의 함수
async def convert_address(address: str) -> AddressConvertResult:
    """
    한글 주소를 공공데이터 API 형식으로 변환 (편의 함수)

    Args:
        address: 한글 주소

    Returns:
        AddressConvertResult: 변환 결과
    """
    async with AddressConverter() as converter:
        return await converter.convert(address)


# 테스트용
if __name__ == "__main__":
    import asyncio

    async def test():
        test_addresses = [
            "경기도 파주시 하우고개길 356",
            "서울특별시 강남구 테헤란로 123",
            "서울 강남구 역삼동 123-45",
            "경기도 수원시 영통구 매탄동 1234",
        ]

        async with AddressConverter() as converter:
            for addr in test_addresses:
                print(f"\n{'='*60}")
                print(f"입력: {addr}")
                result = await converter.convert(addr)
                print(f"성공: {result.success}")
                print(f"시군구코드: {result.sigungu_cd}")
                print(f"법정동코드: {result.bjdong_cd}")
                print(f"본번: {result.bun}")
                print(f"지번: {result.ji}")
                if result.error:
                    print(f"오류: {result.error}")

    asyncio.run(test())
