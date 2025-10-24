"""
Cloudflare Turnstile 봇 검증 유틸리티

사용법:
    from core.security.turnstile import verify_turnstile

    is_valid = await verify_turnstile(token, remote_ip="1.2.3.4")
    if not is_valid:
        raise HTTPException(400, "Bot verification failed")
"""

import os
import httpx
from typing import Optional
import logging

logger = logging.getLogger(__name__)

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile(token: str, remote_ip: Optional[str] = None) -> bool:
    """
    Cloudflare Turnstile 토큰 검증

    Args:
        token: 클라이언트에서 받은 Turnstile 토큰
        remote_ip: 클라이언트 IP 주소 (선택사항)

    Returns:
        검증 성공 여부 (True/False)
    """
    secret = os.getenv("TURNSTILE_SECRET_KEY")

    if not secret:
        logger.error("TURNSTILE_SECRET_KEY environment variable not set")
        # 보안상 환경변수 누락 시 무조건 실패 처리
        return False

    if not token:
        logger.warning("Empty Turnstile token provided")
        return False

    try:
        data = {
            "secret": secret,
            "response": token,
        }

        # IP 주소가 제공된 경우 추가
        if remote_ip:
            data["remoteip"] = remote_ip

        # Cloudflare API 호출
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                TURNSTILE_VERIFY_URL,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            response.raise_for_status()

            result = response.json()
            success = bool(result.get("success", False))

            if not success:
                error_codes = result.get("error-codes", [])
                logger.warning(f"Turnstile verification failed: {error_codes}")

            return success

    except httpx.HTTPError as e:
        logger.error(f"HTTP error during Turnstile verification: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error during Turnstile verification: {e}")
        return False


async def verify_turnstile_sync(token: str, remote_ip: Optional[str] = None) -> bool:
    """
    동기 버전 (필요시 사용)

    Note: 비동기 버전 사용 권장
    """
    import requests

    secret = os.getenv("TURNSTILE_SECRET_KEY")

    if not secret:
        logger.error("TURNSTILE_SECRET_KEY environment variable not set")
        return False

    if not token:
        logger.warning("Empty Turnstile token provided")
        return False

    try:
        data = {"secret": secret, "response": token}
        if remote_ip:
            data["remoteip"] = remote_ip

        response = requests.post(TURNSTILE_VERIFY_URL, data=data, timeout=10)
        response.raise_for_status()

        result = response.json()
        success = bool(result.get("success", False))

        if not success:
            error_codes = result.get("error-codes", [])
            logger.warning(f"Turnstile verification failed: {error_codes}")

        return success

    except Exception as e:
        logger.error(f"Error during Turnstile verification: {e}")
        return False
