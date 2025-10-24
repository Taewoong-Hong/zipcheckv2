"""
공공데이터포털(data.go.kr) 공통 유틸리티

모든 RTMS(부동산 실거래가) API의 공통 로직을 제공합니다.
- URL 조립: serviceKey는 있는 그대로, 나머지는 urlencode
- HTTP 요청: Accept, User-Agent 헤더 추가
- 재시도: 지수 백오프 + jitter
- 성공 코드 판정
"""

import logging
import random
from typing import Dict, Any, Optional
from urllib.parse import urlencode

import httpx
import xmltodict
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

logger = logging.getLogger(__name__)

# 공공데이터포털 API 성공 코드
SUCCESS_CODES = {"00", "000", "0000", "INFO-000", "03", "INFO-003"}


def build_url(base_url: str, api_key: str, **params) -> str:
    """
    공공데이터포털 API URL 생성.

    Args:
        base_url: API 엔드포인트 (예: https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade)
        api_key: 공공데이터포털 API 키 (Decoding 버전, 있는 그대로 사용)
        **params: 쿼리 파라미터 (LAWD_CD, DEAL_YMD 등)

    Returns:
        완성된 URL

    Example:
        >>> url = build_url(
        ...     "https://apis.data.go.kr/.../AptTrade/getAptTrade",
        ...     api_key="196bfded...",
        ...     LAWD_CD="11680",
        ...     DEAL_YMD="202407"
        ... )
    """
    # serviceKey는 있는 그대로, 나머지만 urlencode
    query_string = "serviceKey=" + api_key
    if params:
        query_string += "&" + urlencode(params)

    url = f"{base_url}?{query_string}"

    # URL 로깅 (API 키는 마스킹)
    masked_url = url.replace(api_key, "***API_KEY***")
    logger.debug(f"[data.go.kr] 요청 URL: {masked_url}")

    return url


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=10),  # 0.5s, 1s, 2s, 4s, 8s (max 10s)
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
)
async def call_data_go_api(
    base_url: str,
    api_key: str,
    params: Dict[str, Any],
    *,
    timeout: float = 30.0,
    parse_xml: bool = True,
) -> Dict[str, Any] | str:
    """
    공공데이터포털 API 공통 호출 함수.

    Args:
        base_url: API 엔드포인트
        api_key: 공공데이터포털 API 키
        params: 쿼리 파라미터 딕셔너리
        timeout: 요청 타임아웃 (초)
        parse_xml: XML 파싱 여부 (False면 원본 XML 문자열 반환)

    Returns:
        parse_xml=True: 파싱된 딕셔너리
        parse_xml=False: XML 문자열

    Raises:
        httpx.HTTPStatusError: HTTP 오류 발생 시
        ValueError: API resultCode가 성공 코드가 아닐 때

    Example:
        >>> result = await call_data_go_api(
        ...     base_url="https://apis.data.go.kr/.../AptTrade/getAptTrade",
        ...     api_key="196bfded...",
        ...     params={"LAWD_CD": "11680", "DEAL_YMD": "202407"}
        ... )
    """
    # URL 생성
    url = build_url(base_url, api_key, **params)

    # HTTP 헤더 (공식 문서 권장)
    headers = {
        "Accept": "application/xml",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    # HTTP 요청
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.get(url, headers=headers)
            response.raise_for_status()

            logger.info(
                f"[data.go.kr] API 응답: status={response.status_code}, "
                f"length={len(response.content)}"
            )

            xml_text = response.text

            # XML 파싱하지 않고 원본 반환
            if not parse_xml:
                return xml_text

            # XML → 딕셔너리 변환
            data = xmltodict.parse(xml_text)

            # resultCode 체크
            response_data = data.get("response", {})
            header = response_data.get("header", {})
            result_code = header.get("resultCode", "")
            result_msg = header.get("resultMsg", "")

            logger.info(f"[data.go.kr] resultCode: {result_code} - {result_msg}")

            # 성공 코드가 아니면 에러
            if result_code and result_code not in SUCCESS_CODES:
                logger.error(f"[data.go.kr] API 오류: [{result_code}] {result_msg}")
                raise ValueError(f"API 오류 [{result_code}]: {result_msg}")

            return data

        except httpx.HTTPStatusError as e:
            logger.error(f"[data.go.kr] HTTP 오류: {e.response.status_code}")
            raise
        except httpx.TimeoutException as e:
            logger.warning(f"[data.go.kr] 타임아웃 (재시도 예정): {e}")
            raise
        except httpx.NetworkError as e:
            logger.warning(f"[data.go.kr] 네트워크 오류 (재시도 예정): {e}")
            raise


def normalize_response(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    공공데이터포털 XML 응답을 표준 형식으로 변환.

    Args:
        data: xmltodict로 파싱된 딕셔너리

    Returns:
        {
            "header": {"resultCode": "...", "resultMsg": "..."},
            "body": {"items": [...], "totalCount": 0}
        }
    """
    response_data = data.get("response", {})
    header = response_data.get("header", {})
    body = response_data.get("body", {})

    # items 추출 (item이 단일/배열일 수 있음)
    items_data = body.get("items", {})
    item = items_data.get("item", [])

    # 단일 객체면 배열로 변환
    if isinstance(item, dict):
        items = [item]
    elif isinstance(item, list):
        items = item
    else:
        items = []

    # 총 개수
    total_count = body.get("totalCount", len(items))
    if isinstance(total_count, str):
        total_count = int(total_count) if total_count.isdigit() else len(items)

    return {
        "header": {
            "resultCode": header.get("resultCode", "000"),
            "resultMsg": header.get("resultMsg", "OK"),
        },
        "body": {
            "items": items,
            "totalCount": total_count,
        },
    }
